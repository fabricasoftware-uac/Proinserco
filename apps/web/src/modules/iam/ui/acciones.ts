'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { accionPanel, accionPublica, conLimiteDeTasa } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { contextoPeticion } from '@/server/contexto-peticion'
import { almacenCookiesNext } from '@/server/cookies-next'
import { DemasiadasPeticiones } from '@/shared/domain/errores'
import { CodigoMfa, Credenciales, RutaSiguiente } from '../domain/esquemas'

const CorreoSinValidar = z.object({ correo: z.string().max(254) })

/**
 * Paso 1 del acceso: correo + contraseña. Límite 10/15 min por IP y
 * 5/15 min por correo ANTES de tocar el proveedor de identidad.
 * Éxito: `{ requiereSegundoFactor: true }` → la interfaz pide el código TOTP.
 */
export const iniciarSesionAccion = accionPublica
  .metadata({ nombre: 'iniciar-sesion' })
  .use(
    conLimiteDeTasa({
      limite: 10,
      ventanaSegundos: 900,
      limiteIdentidad: 5,
      identidad: (e) => {
        const r = CorreoSinValidar.safeParse(e)
        return r.success ? r.data.correo : null
      },
    }),
  )
  .inputSchema(Credenciales)
  .action(async ({ parsedInput }) => {
    const { iam } = await obtenerContenedor()
    const { ip } = await contextoPeticion()
    return iam.iniciarSesion(parsedInput, await almacenCookiesNext(), ip)
  })

/**
 * Paso 2: código TOTP. Límite por IP y por usuario del desafío pendiente
 * (5 intentos / 15 min). Éxito: redirige a `siguiente` (solo rutas /panel).
 */
export const verificarSegundoFactorAccion = accionPublica
  .metadata({ nombre: 'verificar-mfa' })
  .use(conLimiteDeTasa({ limite: 10, ventanaSegundos: 900 }))
  .inputSchema(CodigoMfa.extend({ siguiente: z.string().max(300).optional() }))
  .action(async ({ parsedInput }) => {
    const { iam, transversal } = await obtenerContenedor()
    const cookies = await almacenCookiesNext()
    const usuario = await iam.desafioPendiente(cookies)
    if (usuario) {
      const lim = await transversal.limitador.consumir(`verificar-mfa:usuario:${usuario}`, 5, 900)
      if (!lim.permitido) throw new DemasiadasPeticiones(lim.reintentarEnSegundos)
    }
    const { ip } = await contextoPeticion()
    await iam.verificarSegundoFactor({ codigo: parsedInput.codigo }, cookies, ip)
    redirect(RutaSiguiente.parse(parsedInput.siguiente))
  })

/** Cierra sesión: revoca en servidor, borra cookies y vuelve a /acceso. */
export const cerrarSesionAccion = accionPanel.metadata({ nombre: 'cerrar-sesion' }).action(async () => {
  const { iam } = await obtenerContenedor()
  const { ip } = await contextoPeticion()
  await iam.cerrarSesion(await almacenCookiesNext(), ip)
  redirect('/acceso')
})
