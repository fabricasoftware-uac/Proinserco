-- ============================================================================
-- Migración 5: Permitir expiración de donaciones abandonadas en estado `creada`
-- ============================================================================

-- 1. Ampliar la máquina de estados en `public.donaciones_transiciones`
ALTER TABLE public.donaciones_transiciones
  DROP CONSTRAINT IF EXISTS donaciones_transiciones_valida_chk,
  ADD CONSTRAINT donaciones_transiciones_valida_chk CHECK (
    (desde = 'creada' AND hacia IN ('pendiente', 'expirada'))
    OR (desde = 'pendiente' AND hacia IN ('aprobada', 'rechazada', 'expirada'))
    OR (desde = 'aprobada' AND hacia IN ('reembolsada', 'contracargo'))
  );

-- 2. Ampliar el trigger de máquina de estados en `public.donaciones`
-- Espejo de las transiciones permitidas en servidor:
--   creada     -> pendiente | expirada
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
    (OLD.estado = 'creada' AND NEW.estado IN ('pendiente', 'expirada'))
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
