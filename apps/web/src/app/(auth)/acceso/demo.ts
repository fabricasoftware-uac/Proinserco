import 'server-only'
import { createHmac } from 'node:crypto'
import { obtenerContenedor } from '@/server/container'
import { obtenerEnv } from '@/server/env'

/**
 * SOLO DEMOSTRACIÓN. Los usuarios del adaptador en memoria están documentados en el
 * repositorio; aquí se repiten para poder mostrarlos en /acceso, y únicamente cuando el
 * servidor corre con ADAPTADORES=memoria Y fuera de producción. La decisión se toma en el
 * servidor: en cualquier otro caso esta página nunca recibe ni imprime estos valores.
 */
const USUARIOS = [
  {
    rol: 'Administrador',
    correo: 'admin@demo.proinserco.test',
    contrasena: 'Demo-Proinserco-2026!',
    secretoTotp: 'PROINSERCODEMOADMINTOTPSECRET234',
    nota: 'Todos los permisos',
  },
  {
    rol: 'Solo lectura',
    correo: 'consulta@demo.proinserco.test',
    contrasena: 'Consulta-Proinserco-2026!',
    secretoTotp: 'PROINSERCODEMOCONSULTATOTPKEY567',
    nota: 'No revela datos ni exporta',
  },
] as const

export async function demoActivo(): Promise<boolean> {
  const { modo } = await obtenerContenedor()
  return modo === 'memoria' && obtenerEnv().NODE_ENV !== 'production'
}

export type UsuarioDemoVista = Readonly<{ rol: string; correo: string; contrasena: string; secretoTotp: string; nota: string }>

export async function usuariosDemo(): Promise<readonly UsuarioDemoVista[] | null> {
  return (await demoActivo()) ? USUARIOS : null
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function decodificarBase32(texto: string): Buffer {
  let bits = 0
  let valor = 0
  const salida: number[] = []
  for (const c of texto.toUpperCase()) {
    const indice = BASE32.indexOf(c)
    if (indice < 0) continue
    valor = (valor << 5) | indice
    bits += 5
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(salida)
}

/** Código TOTP actual (RFC 6238, SHA-1, 30 s, 6 dígitos) de un usuario demo. */
export function codigoTotpDemo(correo: string, ahora: Date): string | null {
  const usuario = USUARIOS.find((u) => u.correo === correo)
  if (!usuario) return null
  const mensaje = Buffer.alloc(8)
  mensaje.writeBigUInt64BE(BigInt(Math.floor(ahora.getTime() / 30_000)))
  const hmac = createHmac('sha1', decodificarBase32(usuario.secretoTotp)).update(mensaje).digest()
  const desplazamiento = (hmac.at(-1) ?? 0) & 0x0f
  const binario = hmac.readUInt32BE(desplazamiento) & 0x7fffffff
  return String(binario % 1_000_000).padStart(6, '0')
}
