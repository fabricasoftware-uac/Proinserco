-- ============================================================================
-- Migración 7: Acción de auditoría `conciliacion.alerta`
--
-- La conciliación diaria (y el cruce con el listado de cargos de Openpay) deja de
-- avisar solo por log: registra un evento auditable con severidad en `detalles`
-- y, además, notifica por el puerto `Notificador` (log + webhook opcional).
-- Espejo de `AccionAuditable` en apps/web/src/shared/domain/evento-auditable.ts.
-- ============================================================================

ALTER TABLE public.auditoria
  DROP CONSTRAINT IF EXISTS auditoria_accion_chk,
  ADD CONSTRAINT auditoria_accion_chk CHECK (
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
      'ajustes.cambiados',
      'conciliacion.alerta'
    )
  );

ALTER POLICY auditoria_insercion_sistema
  ON public.auditoria
  WITH CHECK (
    accion IN (
      'sesion.iniciada',
      'sesion.fallida',
      'sesion.mfa_fallido',
      'sesion.cerrada',
      'donacion.transicion',
      'donacion.discrepancia',
      'donacion.creada',
      'consentimiento.registrado',
      'conciliacion.alerta'
    )
  );
