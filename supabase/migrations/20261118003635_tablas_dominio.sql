-- ============================================================================
-- Migración 2: Tablas de dominio, restricciones CHECK e índices
-- Contratos de referencia:
--   - apps/web/src/modules/donaciones/domain/*
--   - apps/web/src/modules/donantes/domain/*
--   - apps/web/src/modules/auditoria/domain/*
--   - apps/web/src/shared/domain/*
-- ============================================================================

-- 1. Donantes
CREATE TABLE public.donantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombres text NOT NULL
    CONSTRAINT donantes_nombres_chk CHECK (char_length(btrim(nombres)) BETWEEN 2 AND 80 AND char_length(nombres) <= 80),
  apellidos text NOT NULL
    CONSTRAINT donantes_apellidos_chk CHECK (char_length(btrim(apellidos)) BETWEEN 2 AND 80 AND char_length(apellidos) <= 80),
  tipo_documento text NOT NULL
    CONSTRAINT donantes_tipo_documento_chk CHECK (tipo_documento IN ('CC', 'CE', 'TI', 'PA', 'PPT', 'NIT')),
  numero_documento text NOT NULL
    CONSTRAINT donantes_numero_documento_chk CHECK (numero_documento ~ '^[0-9A-Za-z-]{4,20}$'),
  correo text NOT NULL
    CONSTRAINT donantes_correo_chk CHECK (
      char_length(correo) BETWEEN 3 AND 254
      AND correo = lower(btrim(correo))
      AND correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  celular text NOT NULL
    CONSTRAINT donantes_celular_chk CHECK (celular ~ '^\+573[0-9]{9}$'),
  quiere_certificado boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT donantes_documento_uq UNIQUE (tipo_documento, numero_documento)
);

CREATE INDEX donantes_correo_idx
  ON public.donantes (correo);
CREATE INDEX donantes_creado_en_id_desc_idx
  ON public.donantes (creado_en DESC, id DESC);
CREATE INDEX donantes_correo_trgm_idx
  ON public.donantes USING gin (correo extensions.gin_trgm_ops);
CREATE INDEX donantes_busqueda_trgm_idx
  ON public.donantes USING gin ((nombres || ' ' || apellidos || ' ' || correo) extensions.gin_trgm_ops);

-- 2. Consentimientos (Ley 1581: estrictamente solo inserción; revocación = nueva fila con otorgada = false)
CREATE TABLE public.consentimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donante_id uuid NOT NULL REFERENCES public.donantes(id) ON DELETE RESTRICT,
  correo text NOT NULL
    CONSTRAINT consentimientos_correo_chk CHECK (
      char_length(correo) BETWEEN 3 AND 254
      AND correo = lower(btrim(correo))
      AND correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  finalidad text NOT NULL
    CONSTRAINT consentimientos_finalidad_chk CHECK (finalidad IN ('gestion_donacion', 'certificado_donacion', 'boletin')),
  version_texto text NOT NULL
    CONSTRAINT consentimientos_version_texto_chk CHECK (char_length(btrim(version_texto)) BETWEEN 1 AND 120),
  otorgada boolean NOT NULL,
  ip inet NULL,
  user_agent text NULL
    CONSTRAINT consentimientos_user_agent_chk CHECK (user_agent IS NULL OR char_length(user_agent) <= 300),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX consentimientos_donante_creado_idx
  ON public.consentimientos (donante_id, creado_en DESC, id DESC);

-- 3. Donaciones
CREATE TABLE public.donaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referencia text NOT NULL
    CONSTRAINT donaciones_referencia_uq UNIQUE
    CONSTRAINT donaciones_referencia_chk CHECK (referencia ~ '^DON-[0-9A-HJKMNP-TV-Z]{21}$'),
  clave_idempotencia uuid NOT NULL
    CONSTRAINT donaciones_clave_idempotencia_uq UNIQUE,
  estado text NOT NULL DEFAULT 'creada'
    CONSTRAINT donaciones_estado_chk CHECK (
      estado IN ('creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo')
    ),
  importe_centavos bigint NOT NULL
    CONSTRAINT donaciones_importe_centavos_chk CHECK (importe_centavos > 0),
  moneda char(3) NOT NULL DEFAULT 'COP'
    CONSTRAINT donaciones_moneda_chk CHECK (moneda = 'COP'),
  linea text NOT NULL DEFAULT 'donde-mas-se-necesite'
    CONSTRAINT donaciones_linea_chk CHECK (linea IN ('donde-mas-se-necesite', 'educacion', 'salud', 'agricola')),
  donante_id uuid NOT NULL REFERENCES public.donantes(id) ON DELETE RESTRICT,
  pagador_nombres text NOT NULL
    CONSTRAINT donaciones_pagador_nombres_chk CHECK (
      char_length(btrim(pagador_nombres)) BETWEEN 2 AND 80 AND char_length(pagador_nombres) <= 80
    ),
  pagador_apellidos text NOT NULL
    CONSTRAINT donaciones_pagador_apellidos_chk CHECK (
      char_length(btrim(pagador_apellidos)) BETWEEN 2 AND 80 AND char_length(pagador_apellidos) <= 80
    ),
  pagador_correo text NOT NULL
    CONSTRAINT donaciones_pagador_correo_chk CHECK (
      char_length(pagador_correo) BETWEEN 3 AND 254
      AND pagador_correo = lower(btrim(pagador_correo))
      AND pagador_correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  quiere_certificado boolean NOT NULL,
  id_cargo text NULL
    CONSTRAINT donaciones_id_cargo_uq UNIQUE
    CONSTRAINT donaciones_id_cargo_chk CHECK (id_cargo IS NULL OR char_length(btrim(id_cargo)) BETWEEN 1 AND 120),
  url_pago text NULL
    CONSTRAINT donaciones_url_pago_chk CHECK (
      url_pago IS NULL OR (char_length(url_pago) <= 2048 AND url_pago ~ '^https?://')
    ),
  metodo_pago text NULL
    CONSTRAINT donaciones_metodo_pago_chk CHECK (metodo_pago IS NULL OR char_length(btrim(metodo_pago)) BETWEEN 1 AND 60),
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX donaciones_creada_en_id_desc_idx
  ON public.donaciones (creada_en DESC, id DESC);
CREATE INDEX donaciones_estado_creada_en_idx
  ON public.donaciones (estado, creada_en DESC);
CREATE INDEX donaciones_linea_creada_en_idx
  ON public.donaciones (linea, creada_en DESC);
CREATE INDEX donaciones_donante_id_idx
  ON public.donaciones (donante_id);
CREATE INDEX donaciones_pagador_correo_trgm_idx
  ON public.donaciones USING gin ((lower(pagador_correo)) extensions.gin_trgm_ops);
CREATE INDEX donaciones_referencia_trgm_idx
  ON public.donaciones USING gin (referencia extensions.gin_trgm_ops);

-- 4. Historial de transiciones de donaciones (estrictamente solo inserción)
CREATE TABLE public.donaciones_transiciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donacion_id uuid NOT NULL REFERENCES public.donaciones(id) ON DELETE RESTRICT,
  desde text NOT NULL
    CONSTRAINT donaciones_transiciones_desde_chk CHECK (
      desde IN ('creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo')
    ),
  hacia text NOT NULL
    CONSTRAINT donaciones_transiciones_hacia_chk CHECK (
      hacia IN ('creada', 'pendiente', 'aprobada', 'rechazada', 'expirada', 'reembolsada', 'contracargo')
    ),
  en timestamptz NOT NULL DEFAULT now(),
  origen text NOT NULL
    CONSTRAINT donaciones_transiciones_origen_chk CHECK (origen IN ('servidor', 'conciliacion', 'webhook', 'panel')),
  CONSTRAINT donaciones_transiciones_valida_chk CHECK (
    (desde = 'creada' AND hacia = 'pendiente')
    OR (desde = 'pendiente' AND hacia IN ('aprobada', 'rechazada', 'expirada'))
    OR (desde = 'aprobada' AND hacia IN ('reembolsada', 'contracargo'))
  )
);

CREATE INDEX donaciones_transiciones_donacion_en_idx
  ON public.donaciones_transiciones (donacion_id, en ASC, id ASC);

-- 5. Auditoría del sistema (estrictamente solo inserción)
CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  accion text NOT NULL
    CONSTRAINT auditoria_accion_chk CHECK (
      accion IN (
        'sesion.iniciada',
        'sesion.fallida',
        'sesion.mfa_fallido',
        'sesion.cerrada',
        'donacion.creada',
        'donacion.transicion',
        'donacion.discrepancia',
        'donacion.consultada',
        'donaciones.exportadas',
        'donante.registrado',
        'donante.dato_revelado',
        'donantes.exportados',
        'consentimiento.registrado',
        'ajustes.cambiados'
      )
    ),
  actor_id text NOT NULL
    CONSTRAINT auditoria_actor_id_chk CHECK (char_length(btrim(actor_id)) BETWEEN 1 AND 80),
  recurso text NOT NULL
    CONSTRAINT auditoria_recurso_chk CHECK (char_length(btrim(recurso)) BETWEEN 1 AND 60),
  recurso_id text NULL
    CONSTRAINT auditoria_recurso_id_chk CHECK (recurso_id IS NULL OR char_length(recurso_id) <= 120),
  ip inet NULL,
  detalles jsonb NOT NULL DEFAULT '{}'::jsonb
    CONSTRAINT auditoria_detalles_chk CHECK (jsonb_typeof(detalles) = 'object')
);

CREATE INDEX auditoria_ocurrido_en_id_desc_idx
  ON public.auditoria (ocurrido_en DESC, id DESC);
CREATE INDEX auditoria_recurso_idx
  ON public.auditoria (recurso, recurso_id, ocurrido_en DESC, id DESC);
CREATE INDEX auditoria_accion_ocurrido_idx
  ON public.auditoria (accion, ocurrido_en DESC, id DESC);
CREATE INDEX auditoria_actor_ocurrido_idx
  ON public.auditoria (actor_id, ocurrido_en DESC, id DESC);

-- 6. Idempotencia de webhooks (deduplicación y trazabilidad de avisos Openpay)
CREATE TABLE public.idempotencia_webhooks (
  clave text PRIMARY KEY
    CONSTRAINT idempotencia_webhooks_clave_chk CHECK (char_length(btrim(clave)) BETWEEN 1 AND 200),
  resultado text NULL
    CONSTRAINT idempotencia_webhooks_resultado_chk CHECK (resultado IS NULL OR char_length(resultado) <= 120),
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idempotencia_webhooks_creado_en_idx
  ON public.idempotencia_webhooks (creado_en DESC);

-- 7. Bloqueos progresivos de acceso al panel (por hash del identificador; sin revelar existencia)
CREATE TABLE public.bloqueos_acceso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identificador_hash text NOT NULL
    CONSTRAINT bloqueos_acceso_identificador_uq UNIQUE
    CONSTRAINT bloqueos_acceso_identificador_chk CHECK (char_length(btrim(identificador_hash)) BETWEEN 16 AND 128),
  fallos_consecutivos integer NOT NULL DEFAULT 0
    CONSTRAINT bloqueos_acceso_fallos_chk CHECK (fallos_consecutivos >= 0),
  primer_fallo_en timestamptz NULL,
  ultimo_fallo_en timestamptz NULL,
  bloqueado_hasta timestamptz NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bloqueos_acceso_bloqueado_hasta_idx
  ON public.bloqueos_acceso (bloqueado_hasta)
  WHERE bloqueado_hasta IS NOT NULL;
