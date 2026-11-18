-- ============================================================================
-- Migración 4: RLS habilitado y forzado, privilegios mínimos, inmutabilidad
-- y validación de máquina de estados
-- ============================================================================

-- 1. Cero permisos por defecto para PUBLIC, anon y authenticated en todas las tablas
REVOKE ALL ON TABLE
  public.donantes,
  public.consentimientos,
  public.donaciones,
  public.donaciones_transiciones,
  public.auditoria,
  public.idempotencia_webhooks,
  public.bloqueos_acceso,
  public.usuario_roles,
  public.perfiles
FROM PUBLIC, anon, authenticated;

-- 2. Habilitar y FORZAR Row Level Security en todas las tablas de `public`
ALTER TABLE public.donantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donantes FORCE ROW LEVEL SECURITY;

ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimientos FORCE ROW LEVEL SECURITY;

ALTER TABLE public.donaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donaciones FORCE ROW LEVEL SECURITY;

ALTER TABLE public.donaciones_transiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donaciones_transiciones FORCE ROW LEVEL SECURITY;

ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria FORCE ROW LEVEL SECURITY;

ALTER TABLE public.idempotencia_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotencia_webhooks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.bloqueos_acceso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bloqueos_acceso FORCE ROW LEVEL SECURITY;

ALTER TABLE public.usuario_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles FORCE ROW LEVEL SECURITY;

-- 3. Funciones auxiliares en `private` para leer `request.jwt.claims`
-- Pensadas para invocarse envueltas en `(SELECT private.jwt_...())` en políticas RLS.
CREATE OR REPLACE FUNCTION private.jwt_claims()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  crudo text;
BEGIN
  crudo := NULLIF(current_setting('request.jwt.claims', true), '');
  IF crudo IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN crudo::jsonb;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN '{}'::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION private.jwt_sub()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  valor text;
BEGIN
  valor := NULLIF(private.jwt_claims()->>'sub', '');
  IF valor IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN valor::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION private.jwt_aal()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT NULLIF(private.jwt_claims()->>'aal', '');
$$;

CREATE OR REPLACE FUNCTION private.jwt_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT NULLIF(private.jwt_claims()->'app_metadata'->>'rol', '');
$$;

REVOKE ALL ON FUNCTION private.jwt_claims() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.jwt_sub() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.jwt_aal() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.jwt_rol() FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA private TO proinserco_panel;
GRANT EXECUTE ON FUNCTION
  private.jwt_claims(),
  private.jwt_sub(),
  private.jwt_aal(),
  private.jwt_rol()
TO proinserco_panel;

-- 4. Privilegios mínimos por tabla y rol
-- `public.donantes`
GRANT SELECT, INSERT, UPDATE ON TABLE public.donantes TO proinserco_publico;
GRANT SELECT ON TABLE public.donantes TO proinserco_sistema;
GRANT SELECT ON TABLE public.donantes TO proinserco_panel;
GRANT SELECT, INSERT, UPDATE ON TABLE public.donantes TO service_role;

-- `public.consentimientos` (solo inserción; jamás UPDATE, DELETE ni TRUNCATE)
GRANT INSERT ON TABLE public.consentimientos TO proinserco_publico;
GRANT SELECT, INSERT ON TABLE public.consentimientos TO proinserco_sistema;
GRANT SELECT ON TABLE public.consentimientos TO proinserco_panel;
GRANT SELECT, INSERT ON TABLE public.consentimientos TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.consentimientos
  FROM PUBLIC, anon, authenticated, service_role, proinserco_publico, proinserco_sistema, proinserco_panel;

-- `public.donaciones`
GRANT SELECT, INSERT, UPDATE ON TABLE public.donaciones TO proinserco_publico;
GRANT SELECT, UPDATE ON TABLE public.donaciones TO proinserco_sistema;
GRANT SELECT ON TABLE public.donaciones TO proinserco_panel;
GRANT SELECT ON TABLE public.donaciones TO service_role;

-- `public.donaciones_transiciones` (solo inserción; jamás UPDATE, DELETE ni TRUNCATE)
GRANT SELECT, INSERT ON TABLE public.donaciones_transiciones TO proinserco_publico;
GRANT SELECT, INSERT ON TABLE public.donaciones_transiciones TO proinserco_sistema;
GRANT SELECT ON TABLE public.donaciones_transiciones TO proinserco_panel;
GRANT SELECT, INSERT ON TABLE public.donaciones_transiciones TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.donaciones_transiciones
  FROM PUBLIC, anon, authenticated, service_role, proinserco_publico, proinserco_sistema, proinserco_panel;

-- `public.auditoria` (solo inserción; jamás UPDATE, DELETE ni TRUNCATE)
GRANT INSERT ON TABLE public.auditoria TO proinserco_publico;
GRANT INSERT ON TABLE public.auditoria TO proinserco_sistema;
GRANT SELECT, INSERT ON TABLE public.auditoria TO proinserco_panel;
GRANT SELECT, INSERT ON TABLE public.auditoria TO service_role;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.auditoria
  FROM PUBLIC, anon, authenticated, service_role, proinserco_publico, proinserco_sistema, proinserco_panel;

-- `public.idempotencia_webhooks`
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.idempotencia_webhooks TO proinserco_sistema;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.idempotencia_webhooks TO service_role;

-- `public.bloqueos_acceso`
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloqueos_acceso TO proinserco_sistema;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bloqueos_acceso TO service_role;

-- `public.usuario_roles`
GRANT SELECT ON TABLE public.usuario_roles TO supabase_auth_admin;
GRANT SELECT ON TABLE public.usuario_roles TO proinserco_panel;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usuario_roles TO service_role;

-- `public.perfiles`
GRANT SELECT ON TABLE public.perfiles TO proinserco_sistema;
GRANT SELECT ON TABLE public.perfiles TO proinserco_panel;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.perfiles TO service_role;

-- 5. Políticas RLS explícitas por tabla, rol y operación

-- 5.1 `public.donantes`
CREATE POLICY donantes_lectura_publico
  ON public.donantes
  FOR SELECT
  TO proinserco_publico
  USING (true);

CREATE POLICY donantes_insercion_publico
  ON public.donantes
  FOR INSERT
  TO proinserco_publico
  WITH CHECK (
    char_length(btrim(numero_documento)) >= 4
    AND char_length(btrim(correo)) >= 3
  );

CREATE POLICY donantes_actualizacion_publico
  ON public.donantes
  FOR UPDATE
  TO proinserco_publico
  USING (char_length(btrim(numero_documento)) >= 4)
  WITH CHECK (
    char_length(btrim(numero_documento)) >= 4
    AND char_length(btrim(correo)) >= 3
  );

CREATE POLICY donantes_lectura_sistema
  ON public.donantes
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY donantes_lectura_panel
  ON public.donantes
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND (SELECT private.jwt_rol()) IN ('administrador', 'consulta')
  );

-- 5.2 `public.consentimientos`
CREATE POLICY consentimientos_insercion_publico
  ON public.consentimientos
  FOR INSERT
  TO proinserco_publico
  WITH CHECK (
    finalidad IN ('gestion_donacion', 'certificado_donacion', 'boletin')
    AND char_length(btrim(version_texto)) >= 1
  );

CREATE POLICY consentimientos_lectura_sistema
  ON public.consentimientos
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY consentimientos_insercion_sistema
  ON public.consentimientos
  FOR INSERT
  TO proinserco_sistema
  WITH CHECK (
    finalidad IN ('gestion_donacion', 'certificado_donacion', 'boletin')
    AND char_length(btrim(version_texto)) >= 1
  );

CREATE POLICY consentimientos_lectura_panel
  ON public.consentimientos
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND (SELECT private.jwt_rol()) IN ('administrador', 'consulta')
  );

-- 5.3 `public.donaciones`
CREATE POLICY donaciones_lectura_publico
  ON public.donaciones
  FOR SELECT
  TO proinserco_publico
  USING (true);

CREATE POLICY donaciones_insercion_publico
  ON public.donaciones
  FOR INSERT
  TO proinserco_publico
  WITH CHECK (
    estado = 'creada'
    AND id_cargo IS NULL
    AND url_pago IS NULL
    AND metodo_pago IS NULL
    AND importe_centavos > 0
  );

CREATE POLICY donaciones_actualizacion_publico
  ON public.donaciones
  FOR UPDATE
  TO proinserco_publico
  USING (estado = 'creada')
  WITH CHECK (
    estado = 'pendiente'
    AND id_cargo IS NOT NULL
    AND url_pago IS NOT NULL
  );

CREATE POLICY donaciones_lectura_sistema
  ON public.donaciones
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY donaciones_actualizacion_sistema
  ON public.donaciones
  FOR UPDATE
  TO proinserco_sistema
  USING (estado IN ('creada', 'pendiente', 'aprobada'))
  WITH CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo'));

CREATE POLICY donaciones_lectura_panel
  ON public.donaciones
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND (SELECT private.jwt_rol()) IN ('administrador', 'consulta')
  );

-- 5.4 `public.donaciones_transiciones`
CREATE POLICY donaciones_transiciones_lectura_publico
  ON public.donaciones_transiciones
  FOR SELECT
  TO proinserco_publico
  USING (true);

CREATE POLICY donaciones_transiciones_insercion_publico
  ON public.donaciones_transiciones
  FOR INSERT
  TO proinserco_publico
  WITH CHECK (
    desde = 'creada'
    AND hacia = 'pendiente'
    AND origen = 'servidor'
  );

CREATE POLICY donaciones_transiciones_lectura_sistema
  ON public.donaciones_transiciones
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY donaciones_transiciones_insercion_sistema
  ON public.donaciones_transiciones
  FOR INSERT
  TO proinserco_sistema
  WITH CHECK (
    desde <> hacia
    AND origen IN ('servidor', 'conciliacion', 'webhook')
  );

CREATE POLICY donaciones_transiciones_lectura_panel
  ON public.donaciones_transiciones
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND (SELECT private.jwt_rol()) IN ('administrador', 'consulta')
  );

-- 5.5 `public.auditoria`
CREATE POLICY auditoria_insercion_publico
  ON public.auditoria
  FOR INSERT
  TO proinserco_publico
  WITH CHECK (
    actor_id = 'sistema'
    AND accion IN ('donacion.creada', 'consentimiento.registrado')
  );

CREATE POLICY auditoria_insercion_sistema
  ON public.auditoria
  FOR INSERT
  TO proinserco_sistema
  WITH CHECK (
    accion IN (
      'sesion.iniciada',
      'sesion.fallida',
      'sesion.mfa_fallido',
      'sesion.cerrada',
      'donacion.transicion',
      'donacion.discrepancia',
      'donacion.creada',
      'consentimiento.registrado'
    )
  );

CREATE POLICY auditoria_lectura_panel
  ON public.auditoria
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND (SELECT private.jwt_rol()) IN ('administrador', 'consulta')
  );

CREATE POLICY auditoria_insercion_panel
  ON public.auditoria
  FOR INSERT
  TO proinserco_panel
  WITH CHECK (
    (SELECT private.jwt_aal()) = 'aal2'
    AND actor_id = ((SELECT private.jwt_sub()))::text
    AND (
      (SELECT private.jwt_rol()) = 'administrador'
      OR (
        (SELECT private.jwt_rol()) = 'consulta'
        AND accion IN ('donacion.consultada', 'sesion.cerrada')
      )
    )
  );

-- 5.6 `public.idempotencia_webhooks`
CREATE POLICY idempotencia_webhooks_lectura_sistema
  ON public.idempotencia_webhooks
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY idempotencia_webhooks_insercion_sistema
  ON public.idempotencia_webhooks
  FOR INSERT
  TO proinserco_sistema
  WITH CHECK (char_length(btrim(clave)) >= 1);

CREATE POLICY idempotencia_webhooks_actualizacion_sistema
  ON public.idempotencia_webhooks
  FOR UPDATE
  TO proinserco_sistema
  USING (char_length(btrim(clave)) >= 1)
  WITH CHECK (char_length(btrim(clave)) >= 1);

CREATE POLICY idempotencia_webhooks_eliminacion_sistema
  ON public.idempotencia_webhooks
  FOR DELETE
  TO proinserco_sistema
  USING (creado_en < now() - interval '7 days');

-- 5.7 `public.bloqueos_acceso`
CREATE POLICY bloqueos_acceso_lectura_sistema
  ON public.bloqueos_acceso
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY bloqueos_acceso_insercion_sistema
  ON public.bloqueos_acceso
  FOR INSERT
  TO proinserco_sistema
  WITH CHECK (
    char_length(btrim(identificador_hash)) >= 16
    AND fallos_consecutivos >= 0
  );

CREATE POLICY bloqueos_acceso_actualizacion_sistema
  ON public.bloqueos_acceso
  FOR UPDATE
  TO proinserco_sistema
  USING (char_length(btrim(identificador_hash)) >= 16)
  WITH CHECK (
    char_length(btrim(identificador_hash)) >= 16
    AND fallos_consecutivos >= 0
  );

CREATE POLICY bloqueos_acceso_eliminacion_sistema
  ON public.bloqueos_acceso
  FOR DELETE
  TO proinserco_sistema
  USING (char_length(btrim(identificador_hash)) >= 16);

-- 5.8 `public.usuario_roles`
CREATE POLICY usuario_roles_lectura_auth_admin
  ON public.usuario_roles
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

CREATE POLICY usuario_roles_lectura_propio_panel
  ON public.usuario_roles
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND user_id = (SELECT private.jwt_sub())
  );

-- 5.9 `public.perfiles`
CREATE POLICY perfiles_lectura_sistema
  ON public.perfiles
  FOR SELECT
  TO proinserco_sistema
  USING (true);

CREATE POLICY perfiles_lectura_panel
  ON public.perfiles
  FOR SELECT
  TO proinserco_panel
  USING (
    (SELECT private.jwt_aal()) = 'aal2'
    AND (
      user_id = (SELECT private.jwt_sub())
      OR (SELECT private.jwt_rol()) = 'administrador'
    )
  );

-- 6. Triggers de inmutabilidad (consentimientos, donaciones_transiciones, auditoria)
CREATE OR REPLACE FUNCTION private.rechazar_mutacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'La tabla %.% es inmutable (solo inserción): operación % rechazada',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION private.rechazar_mutacion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER consentimientos_sin_mutacion_fila
  BEFORE UPDATE OR DELETE ON public.consentimientos
  FOR EACH ROW
  EXECUTE FUNCTION private.rechazar_mutacion();

CREATE TRIGGER consentimientos_sin_truncate
  BEFORE TRUNCATE ON public.consentimientos
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.rechazar_mutacion();

CREATE TRIGGER donaciones_transiciones_sin_mutacion_fila
  BEFORE UPDATE OR DELETE ON public.donaciones_transiciones
  FOR EACH ROW
  EXECUTE FUNCTION private.rechazar_mutacion();

CREATE TRIGGER donaciones_transiciones_sin_truncate
  BEFORE TRUNCATE ON public.donaciones_transiciones
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.rechazar_mutacion();

CREATE TRIGGER auditoria_sin_mutacion_fila
  BEFORE UPDATE OR DELETE ON public.auditoria
  FOR EACH ROW
  EXECUTE FUNCTION private.rechazar_mutacion();

CREATE TRIGGER auditoria_sin_truncate
  BEFORE TRUNCATE ON public.auditoria
  FOR EACH STATEMENT
  EXECUTE FUNCTION private.rechazar_mutacion();

-- 7. Trigger de máquina de estados e integridad en `public.donaciones`
-- Espejo exacto de `TRANSICIONES` en `apps/web/src/modules/donaciones/domain/estado-donacion.ts`:
--   creada     -> pendiente
--   pendiente  -> aprobada | rechazada | expirada
--   aprobada   -> reembolsada | contracargo
CREATE OR REPLACE FUNCTION private.validar_transicion_donacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  transicion_valida boolean;
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.referencia IS DISTINCT FROM OLD.referencia
    OR NEW.clave_idempotencia IS DISTINCT FROM OLD.clave_idempotencia
    OR NEW.importe_centavos IS DISTINCT FROM OLD.importe_centavos
    OR NEW.moneda IS DISTINCT FROM OLD.moneda
    OR NEW.linea IS DISTINCT FROM OLD.linea
    OR NEW.donante_id IS DISTINCT FROM OLD.donante_id
    OR NEW.pagador_nombres IS DISTINCT FROM OLD.pagador_nombres
    OR NEW.pagador_apellidos IS DISTINCT FROM OLD.pagador_apellidos
    OR NEW.pagador_correo IS DISTINCT FROM OLD.pagador_correo
    OR NEW.quiere_certificado IS DISTINCT FROM OLD.quiere_certificado
    OR NEW.creada_en IS DISTINCT FROM OLD.creada_en
  THEN
    RAISE EXCEPTION 'Los atributos inmutables de la donación no pueden modificarse'
      USING ERRCODE = '23514';
  END IF;

  transicion_valida :=
    (OLD.estado = 'creada' AND NEW.estado = 'pendiente')
    OR (OLD.estado = 'pendiente' AND NEW.estado IN ('aprobada', 'rechazada', 'expirada'))
    OR (OLD.estado = 'aprobada' AND NEW.estado IN ('reembolsada', 'contracargo'));

  IF NOT transicion_valida THEN
    RAISE EXCEPTION 'Transición de estado inválida en donaciones: % -> %',
      OLD.estado, NEW.estado
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.validar_transicion_donacion() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER donaciones_validar_transicion
  BEFORE UPDATE ON public.donaciones
  FOR EACH ROW
  EXECUTE FUNCTION private.validar_transicion_donacion();
