import { z } from 'zod'
import { Permiso } from '@/shared/domain/actor'

/**
 * Roles = agrupaciones de permisos. El código nunca pregunta por el rol,
 * solo por permisos (`actor.puede('donaciones:leer')`).
 * En producción el rol sale de una tabla del servidor proyectada en
 * `app_metadata` del JWT, NUNCA de `user_metadata`.
 */
export const Rol = z.enum(['administrador', 'consulta'])
export type Rol = z.infer<typeof Rol>

export const PERMISOS_POR_ROL: Readonly<Record<Rol, readonly Permiso[]>> = {
  administrador: Permiso.options,
  consulta: ['panel:entrar', 'donaciones:leer', 'donantes:leer', 'auditoria:leer', 'ajustes:leer'],
}
