import { z } from 'zod'

/** Mínimo 12 caracteres (NIST SP 800-63B); máximo para no aceptar cuerpos enormes. */
export const Credenciales = z.strictObject({
  correo: z
    .email('Correo no válido')
    .max(254)
    .transform((v) => v.toLowerCase()),
  contrasena: z.string().min(12, 'Mínimo 12 caracteres').max(256),
})
export type Credenciales = z.infer<typeof Credenciales>

export const CodigoMfa = z.strictObject({
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
})
export type CodigoMfa = z.infer<typeof CodigoMfa>

/** Ruta interna a la que volver tras el login. Solo rutas del panel: nada de open redirect. */
export const RutaSiguiente = z
  .string()
  .max(300)
  .regex(/^\/panel(\/[\w\-/?=&%.]*)?$/)
  .catch('/panel')
