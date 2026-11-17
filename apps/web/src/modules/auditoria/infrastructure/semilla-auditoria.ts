/*
 *  DATOS DE DEMOSTRACIÓN — entradas de auditoría ficticias de los usuarios
 *  demo del panel. Solo con ADAPTADORES=memoria.
 */

import type { AccionAuditable } from '@/shared/domain/evento-auditable'
import type { AleatorioDeterminista } from '@/shared/infrastructure/aleatorio-determinista'
import type { RegistroAuditoria } from '../application/ports/registro-auditoria'

export async function sembrarAuditoria(deps: {
  registro: RegistroAuditoria
  aleatorio: AleatorioDeterminista
  ahora: Date
  usuarios: readonly string[]
}): Promise<void> {
  const acciones: readonly AccionAuditable[] = [
    'sesion.iniciada',
    'sesion.iniciada',
    'sesion.cerrada',
    'donacion.consultada',
    'donante.dato_revelado',
    'donaciones.exportadas',
    'sesion.fallida',
  ]
  for (let i = 0; i < 30; i++) {
    const accion = deps.aleatorio.elegir(acciones)
    const actorId = accion === 'sesion.fallida' ? 'desconocido' : deps.aleatorio.elegir(deps.usuarios)
    await deps.registro.insertar({
      id: `00000000-0000-4000-b000-${String(i + 1).padStart(12, '0')}`,
      ocurridoEn: new Date(deps.ahora.getTime() - deps.aleatorio.entero(60, 30 * 86_400) * 1000),
      accion,
      actorId,
      recurso: accion.startsWith('sesion') ? 'sesion' : accion.startsWith('donante') ? 'donante' : 'donacion',
      recursoId: null,
      // 192.0.2.0/24 es un rango reservado para documentación (RFC 5737).
      ip: `192.0.2.${deps.aleatorio.entero(1, 254)}`,
      detalles: accion === 'donante.dato_revelado' ? { campo: 'correo' } : { demo: true },
    })
  }
}
