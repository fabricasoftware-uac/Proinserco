-- ============================================================================
-- Migración 6: Flujo público solo a través de funciones SECURITY DEFINER acotadas
--
-- Hallazgo (revisión 2026-11-18): `proinserco_publico` tenía `SELECT ... USING (true)`
-- sobre donantes, donaciones y donaciones_transiciones, y UPDATE sobre cualquier donante.
-- Una inyección o un fallo en el flujo público permitía listar a todos los donantes y
-- sobrescribir los datos de contacto de otra persona que ya existiera con su documento.
--
-- Desde aquí `proinserco_publico` NO tiene privilegios de tabla sobre donantes,
-- donaciones ni donaciones_transiciones. Solo puede EJECUTAR estas funciones:
--   1. public.registrar_donante_publico      → inserta el donante; si el documento ya
--      existe NO toca sus datos de contacto (solo puede activar quiere_certificado) y
--      devuelve su id para asociar la donación. Los cambios de datos van por el panel.
--   2. public.crear_donacion_publica         → inserta UNA donación en estado `creada`.
--   3. public.registrar_cargo_donacion_publica → `creada` → `pendiente` con el cargo.
--   4. public.intento_donacion_por_clave     → idempotencia del formulario (por clave).
--   5. public.resultado_donacion_publica     → lee UNA donación por referencia (sin PII).
--   6. public.reservar_consulta_pasarela_publica → como mucho una consulta a la
--      pasarela cada N segundos por donación (página de resultado).
--
-- Las funciones son propiedad de `proinserco_flujo_publico` (NOLOGIN, sin BYPASSRLS):
-- aunque son SECURITY DEFINER, también ese rol está sujeto a RLS forzado y a
-- privilegios por columna. `search_path` vacío y EXECUTE revocado a PUBLIC.
-- ============================================================================

-- 1. Rol propietario de las funciones del flujo público
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'proinserco_flujo_publico') THEN
    CREATE ROLE proinserco_flujo_publico NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

-- Quien aplica la migración debe poder asignar la propiedad de las funciones.
GRANT proinserco_flujo_publico TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO proinserco_flujo_publico;

-- 2. Quitar al rol público el acceso directo a las tablas
DROP POLICY IF EXISTS donantes_lectura_publico ON public.donantes;
DROP POLICY IF EXISTS donantes_insercion_publico ON public.donantes;
DROP POLICY IF EXISTS donantes_actualizacion_publico ON public.donantes;
DROP POLICY IF EXISTS donaciones_lectura_publico ON public.donaciones;
DROP POLICY IF EXISTS donaciones_insercion_publico ON public.donaciones;
DROP POLICY IF EXISTS donaciones_actualizacion_publico ON public.donaciones;
DROP POLICY IF EXISTS donaciones_transiciones_lectura_publico ON public.donaciones_transiciones;
DROP POLICY IF EXISTS donaciones_transiciones_insercion_publico ON public.donaciones_transiciones;

REVOKE ALL ON TABLE public.donantes, public.donaciones, public.donaciones_transiciones FROM proinserco_publico;

-- 3. Caché de consultas a la pasarela desde la página de resultado
CREATE TABLE public.donaciones_consultas_pasarela (
  donacion_id uuid PRIMARY KEY REFERENCES public.donaciones(id) ON DELETE CASCADE,
  consultada_en timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.donaciones_consultas_pasarela FROM PUBLIC, anon, authenticated;
ALTER TABLE public.donaciones_consultas_pasarela ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donaciones_consultas_pasarela FORCE ROW LEVEL SECURITY;

-- 4. Privilegios mínimos del rol propietario (por columna donde aplica)
GRANT SELECT (id, tipo_documento, numero_documento, quiere_certificado) ON TABLE public.donantes TO proinserco_flujo_publico;
GRANT INSERT (id, nombres, apellidos, tipo_documento, numero_documento, correo, celular, quiere_certificado, creado_en, actualizado_en)
  ON TABLE public.donantes TO proinserco_flujo_publico;
GRANT UPDATE (quiere_certificado, actualizado_en) ON TABLE public.donantes TO proinserco_flujo_publico;

GRANT SELECT (id, referencia, clave_idempotencia, estado, importe_centavos, moneda, quiere_certificado, url_pago, id_cargo, creada_en)
  ON TABLE public.donaciones TO proinserco_flujo_publico;
GRANT INSERT ON TABLE public.donaciones TO proinserco_flujo_publico;
GRANT UPDATE (estado, id_cargo, url_pago, actualizada_en) ON TABLE public.donaciones TO proinserco_flujo_publico;

GRANT INSERT ON TABLE public.donaciones_transiciones TO proinserco_flujo_publico;
GRANT SELECT, INSERT, UPDATE ON TABLE public.donaciones_consultas_pasarela TO proinserco_flujo_publico;

-- El sistema (conciliación) puede leer la caché para diagnóstico; nadie más.
GRANT SELECT ON TABLE public.donaciones_consultas_pasarela TO proinserco_sistema;

-- 5. Políticas RLS del rol propietario (estrechas: solo lo que hacen las funciones)
CREATE POLICY donantes_lectura_flujo_publico ON public.donantes
  FOR SELECT TO proinserco_flujo_publico USING (true);
CREATE POLICY donantes_insercion_flujo_publico ON public.donantes
  FOR INSERT TO proinserco_flujo_publico WITH CHECK (true);
CREATE POLICY donantes_certificado_flujo_publico ON public.donantes
  FOR UPDATE TO proinserco_flujo_publico USING (true) WITH CHECK (quiere_certificado);

CREATE POLICY donaciones_lectura_flujo_publico ON public.donaciones
  FOR SELECT TO proinserco_flujo_publico USING (true);
CREATE POLICY donaciones_insercion_flujo_publico ON public.donaciones
  FOR INSERT TO proinserco_flujo_publico
  WITH CHECK (estado = 'creada' AND id_cargo IS NULL AND url_pago IS NULL AND metodo_pago IS NULL AND importe_centavos > 0);
CREATE POLICY donaciones_cargo_flujo_publico ON public.donaciones
  FOR UPDATE TO proinserco_flujo_publico
  USING (estado = 'creada' AND id_cargo IS NULL)
  WITH CHECK (estado = 'pendiente' AND id_cargo IS NOT NULL AND url_pago IS NOT NULL);

CREATE POLICY donaciones_transiciones_insercion_flujo_publico ON public.donaciones_transiciones
  FOR INSERT TO proinserco_flujo_publico
  WITH CHECK (desde = 'creada' AND hacia = 'pendiente' AND origen = 'servidor');

CREATE POLICY consultas_pasarela_flujo_publico ON public.donaciones_consultas_pasarela
  FOR ALL TO proinserco_flujo_publico USING (true) WITH CHECK (true);
CREATE POLICY consultas_pasarela_lectura_sistema ON public.donaciones_consultas_pasarela
  FOR SELECT TO proinserco_sistema USING (true);

-- 6. Funciones acotadas
CREATE OR REPLACE FUNCTION public.registrar_donante_publico(
  p_id uuid,
  p_nombres text,
  p_apellidos text,
  p_tipo_documento text,
  p_numero_documento text,
  p_correo text,
  p_celular text,
  p_quiere_certificado boolean,
  p_en timestamptz
)
RETURNS TABLE (donante_id uuid, existia boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Si el documento ya existe NO se tocan nombres, correo ni celular: solo se puede
  -- activar el certificado (nunca desactivarlo). Así nadie sobrescribe los datos de
  -- contacto de otra persona escribiendo su documento en el formulario público.
  RETURN QUERY
  INSERT INTO public.donantes AS d (
    id, nombres, apellidos, tipo_documento, numero_documento, correo, celular, quiere_certificado, creado_en, actualizado_en
  )
  VALUES (
    p_id, p_nombres, p_apellidos, p_tipo_documento, p_numero_documento, p_correo, p_celular, p_quiere_certificado, p_en, p_en
  )
  ON CONFLICT ON CONSTRAINT donantes_documento_uq DO UPDATE
    SET quiere_certificado = true,
        actualizado_en = p_en
    WHERE p_quiere_certificado AND NOT d.quiere_certificado
  RETURNING d.id, (d.id IS DISTINCT FROM p_id);

  IF NOT FOUND THEN
    -- Conflicto sin cambios (ya existía y no hay nada que activar): devolver su id.
    RETURN QUERY
    SELECT d.id, true
      FROM public.donantes AS d
     WHERE d.tipo_documento = p_tipo_documento
       AND d.numero_documento = p_numero_documento;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.crear_donacion_publica(
  p_id uuid,
  p_referencia text,
  p_clave_idempotencia uuid,
  p_importe_centavos bigint,
  p_moneda text,
  p_linea text,
  p_donante_id uuid,
  p_pagador_nombres text,
  p_pagador_apellidos text,
  p_pagador_correo text,
  p_quiere_certificado boolean,
  p_en timestamptz
)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.donaciones (
    id, referencia, clave_idempotencia, estado, importe_centavos, moneda, linea, donante_id,
    pagador_nombres, pagador_apellidos, pagador_correo, quiere_certificado, creada_en, actualizada_en
  )
  VALUES (
    p_id, p_referencia, p_clave_idempotencia, 'creada', p_importe_centavos, p_moneda, p_linea, p_donante_id,
    p_pagador_nombres, p_pagador_apellidos, p_pagador_correo, p_quiere_certificado, p_en, p_en
  );
$$;

CREATE OR REPLACE FUNCTION public.registrar_cargo_donacion_publica(
  p_id uuid,
  p_id_cargo text,
  p_url_pago text,
  p_en timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.donaciones
     SET estado = 'pendiente',
         id_cargo = p_id_cargo,
         url_pago = p_url_pago,
         actualizada_en = p_en
   WHERE id = p_id
     AND estado = 'creada'
     AND id_cargo IS NULL;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.donaciones_transiciones (donacion_id, desde, hacia, en, origen)
  VALUES (p_id, 'creada', 'pendiente', p_en, 'servidor');
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.intento_donacion_por_clave(p_clave_idempotencia uuid)
RETURNS TABLE (referencia text, estado text, url_pago text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.referencia,
         d.estado,
         CASE WHEN d.estado = 'pendiente' THEN d.url_pago ELSE NULL END
    FROM public.donaciones AS d
   WHERE d.clave_idempotencia = p_clave_idempotencia
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resultado_donacion_publica(p_referencia text)
RETURNS TABLE (
  referencia text,
  estado text,
  importe_centavos bigint,
  moneda text,
  creada_en timestamptz,
  quiere_certificado boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.referencia, d.estado, d.importe_centavos, d.moneda::text, d.creada_en, d.quiere_certificado
    FROM public.donaciones AS d
   WHERE p_referencia ~ '^DON-[0-9A-HJKMNP-TV-Z]{21}$'
     AND d.referencia = p_referencia
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.reservar_consulta_pasarela_publica(p_referencia text, p_intervalo_segundos integer)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_intervalo interval := make_interval(secs => LEAST(GREATEST(COALESCE(p_intervalo_segundos, 60), 5), 3600));
  v_reservada boolean;
BEGIN
  SELECT d.id INTO v_id
    FROM public.donaciones AS d
   WHERE d.referencia = p_referencia
     AND d.estado IN ('creada', 'pendiente');
  IF v_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.donaciones_consultas_pasarela AS c (donacion_id, consultada_en)
  VALUES (v_id, now())
  ON CONFLICT (donacion_id) DO UPDATE
    SET consultada_en = now()
    WHERE c.consultada_en <= now() - v_intervalo
  RETURNING true INTO v_reservada;

  RETURN COALESCE(v_reservada, false);
END;
$$;

-- ALTER ... OWNER exige que el nuevo dueño tenga CREATE en el esquema: se concede solo
-- durante el cambio de propietario y se retira enseguida.
GRANT CREATE ON SCHEMA public TO proinserco_flujo_publico;

ALTER FUNCTION public.registrar_donante_publico(uuid, text, text, text, text, text, text, boolean, timestamptz)
  OWNER TO proinserco_flujo_publico;
ALTER FUNCTION public.crear_donacion_publica(uuid, text, uuid, bigint, text, text, uuid, text, text, text, boolean, timestamptz)
  OWNER TO proinserco_flujo_publico;
ALTER FUNCTION public.registrar_cargo_donacion_publica(uuid, text, text, timestamptz) OWNER TO proinserco_flujo_publico;
ALTER FUNCTION public.intento_donacion_por_clave(uuid) OWNER TO proinserco_flujo_publico;
ALTER FUNCTION public.resultado_donacion_publica(text) OWNER TO proinserco_flujo_publico;
ALTER FUNCTION public.reservar_consulta_pasarela_publica(text, integer) OWNER TO proinserco_flujo_publico;

REVOKE CREATE ON SCHEMA public FROM proinserco_flujo_publico;

REVOKE ALL ON FUNCTION
  public.registrar_donante_publico(uuid, text, text, text, text, text, text, boolean, timestamptz),
  public.crear_donacion_publica(uuid, text, uuid, bigint, text, text, uuid, text, text, text, boolean, timestamptz),
  public.registrar_cargo_donacion_publica(uuid, text, text, timestamptz),
  public.intento_donacion_por_clave(uuid),
  public.resultado_donacion_publica(text),
  public.reservar_consulta_pasarela_publica(text, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.registrar_donante_publico(uuid, text, text, text, text, text, text, boolean, timestamptz),
  public.crear_donacion_publica(uuid, text, uuid, bigint, text, text, uuid, text, text, text, boolean, timestamptz),
  public.registrar_cargo_donacion_publica(uuid, text, text, timestamptz),
  public.intento_donacion_por_clave(uuid),
  public.resultado_donacion_publica(text),
  public.reservar_consulta_pasarela_publica(text, integer)
TO proinserco_publico;
