import 'server-only'
import { cookies } from 'next/headers'
import type { AlmacenCookies } from '@/modules/iam'

/**
 * AlmacenCookies sobre `cookies()` de Next. En un Server Component las
 * cookies son de solo lectura: establecer/eliminar solo funciona en Server
 * Actions y Route Handlers (Next lanza si se intenta en un componente).
 */
export async function almacenCookiesNext(): Promise<AlmacenCookies> {
  const almacen = await cookies()
  return {
    obtener: (nombre) => almacen.get(nombre)?.value,
    todas: () => almacen.getAll().map((c) => ({ nombre: c.name, valor: c.value })),
    establecer: (nombre, valor, o) => {
      almacen.set(nombre, valor, {
        httpOnly: o.httpOnly,
        secure: o.secure,
        sameSite: o.sameSite,
        path: o.path,
        ...(o.maxAgeSegundos ? { maxAge: o.maxAgeSegundos } : {}),
      })
    },
    eliminar: (nombre) => {
      almacen.delete(nombre)
    },
  }
}
