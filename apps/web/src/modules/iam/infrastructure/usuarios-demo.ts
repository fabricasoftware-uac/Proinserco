/*
 * ════════════════════════════════════════════════════════════════════════
 *  USUARIOS DE DEMOSTRACIÓN DEL PANEL — SOLO desarrollo local y E2E
 *  (ADAPTADORES=memoria y NODE_ENV distinto de production). El contenedor no
 *  los carga en producción, ni siquiera con ADAPTADORES_MEMORIA_EN_PRODUCCION=si,
 *  y `usuariosDemo()` lanza si se llama con NODE_ENV=production.
 *
 *  Son públicos (están en el repositorio): JAMÁS reutilizar estas contraseñas
 *  ni estos secretos TOTP en ningún entorno real.
 *
 *  Segundo factor: añade el secreto TOTP a cualquier app autenticadora
 *  (Google Authenticator, 1Password, Aegis…) o calcúlalo en los E2E con
 *  `src/modules/iam/infrastructure/totp.ts`.
 * ════════════════════════════════════════════════════════════════════════
 */
import { exigirEntornoNoProductivo } from '@/shared/infrastructure/solo-desarrollo'
import type { Rol } from '../domain/roles'

export type UsuarioDemo = Readonly<{
  id: string
  correo: string
  nombre: string
  rol: Rol
  contrasena: string
  secretoTotp: string
}>

const USUARIOS_DEMO: readonly UsuarioDemo[] = [
  {
    id: 'usr_demo_admin',
    correo: 'admin@demo.proinserco.test',
    nombre: 'Administración (demo)',
    rol: 'administrador',
    contrasena: 'Demo-Proinserco-2026!',
    secretoTotp: 'PROINSERCODEMOADMINTOTPSECRET234',
  },
  {
    id: 'usr_demo_consulta',
    correo: 'consulta@demo.proinserco.test',
    nombre: 'Consulta (demo)',
    rol: 'consulta',
    contrasena: 'Consulta-Proinserco-2026!',
    secretoTotp: 'PROINSERCODEMOCONSULTATOTPKEY567',
  },
]

/** Usuarios demo para el adaptador en memoria. Lanza con NODE_ENV=production. */
export function usuariosDemo(): readonly UsuarioDemo[] {
  exigirEntornoNoProductivo('Los usuarios demo del panel')
  return USUARIOS_DEMO
}
