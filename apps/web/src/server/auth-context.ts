import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import type { Actor, Permiso } from '@/shared/domain/actor'
import { obtenerContenedor } from './container'
import { almacenCookiesNext } from './cookies-next'

/**
 * CAPA 2 de autorización: el borde autentica de verdad.
 * `cache()` deduplica dentro de la misma petición (layout + página + componentes).
 * La identidad se VALIDA en servidor (equivalente a getUser()), no se lee de la cookie.
 */
export const obtenerActor = cache(async (): Promise<Actor | null> => {
  const contenedor = await obtenerContenedor()
  return contenedor.iam.obtenerActor(await almacenCookiesNext())
})

/**
 * Para CADA página del panel (y su layout). Sin sesión aal2 → /acceso.
 * Con sesión pero sin el permiso → 404 (no se confirma que el recurso exista).
 *
 *   const actor = await requireActor('donaciones:leer')
 */
export async function requireActor(permiso: Permiso = 'panel:entrar'): Promise<Actor> {
  const actor = await obtenerActor()
  if (!actor) redirect('/acceso')
  if (!actor.puede(permiso)) notFound()
  return actor
}
