'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { accionPanel, accionPublica, conLimiteDeTasa } from '@/server/acciones'
import { obtenerContenedor } from '@/server/container'
import { contextoPeticion } from '@/server/contexto-peticion'
import { almacenCookiesNext } from '@/server/cookies-next'
import { ejecutarConContextoDb } from '@/server/db/contexto-db'
import { DemasiadasPeticiones } from '@/shared/domain/errores'
import { CodigoMfa, Credenciales, RutaSiguiente } from '../domain/esquemas'

const CorreoSinValidar = z.object({ correo: z.string().max(254) })

/**
 * Paso 1 del acceso: correo + contraseña. Límite 10/15 min por IP y 5/15 min por
 * correo + IP ANTES de tocar el proveedor de identidad. El límite por identidad incluye
 * la IP a propósito: solo por correo, 5 intentos de un tercero dejarían fuera al
 * administrador. Contra el ataque distribuido el proveedor aplica un retardo por correo.
 * Éxito: `{ requiereSegundoFactor: true }` → la interfaz pide el código TOTP.
 */
export const iniciarSesionAccion = accionPublica
  .metadata({ nombre: 'iniciar-sesion' })
  .use(
    conLimiteDeTasa({
      limite: 10,
      ventanaSegundos: 900,
      limiteIdentidad: 5,
      identidadConIp: true,
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
    const cookies = await almacenCookiesNext()
    return ejecutarConContextoDb({ modo: 'sistema' }, () => iam.iniciarSesion(parsedInput, cookies, ip))
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
    const { ip } = await contextoPeticion()
    await ejecutarConContextoDb({ modo: 'sistema' }, async () => {
      const usuario = await iam.desafioPendiente(cookies)
      if (usuario) {
        const lim = await transversal.limitador.consumir(`verificar-mfa:usuario:${usuario}`, 5, 900)
        if (!lim.permitido) throw new DemasiadasPeticiones(lim.reintentarEnSegundos)
      }
      await iam.verificarSegundoFactor({ codigo: parsedInput.codigo }, cookies, ip)
    })
    redirect(RutaSiguiente.parse(parsedInput.siguiente))
  })

/** Cierra sesión: revoca en servidor, borra cookies y vuelve a /acceso. */
export const cerrarSesionAccion = accionPanel.metadata({ nombre: 'cerrar-sesion' }).action(async () => {
  const { iam } = await obtenerContenedor()
  const { ip } = await contextoPeticion()
  const cookies = await almacenCookiesNext()
  await ejecutarConContextoDb({ modo: 'sistema' }, () => iam.cerrarSesion(cookies, ip))
  redirect('/acceso')
})
