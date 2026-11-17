/*
 * ════════════════════════════════════════════════════════════════════════
 *  USUARIOS DE DEMOSTRACIÓN DEL PANEL — solo con ADAPTADORES=memoria.
 *  En producción el arranque falla con memoria salvo autorización expresa
 *  (ADAPTADORES_MEMORIA_EN_PRODUCCION=si, ver src/server/env.ts).
 *
 *  Segundo factor: añade el secreto TOTP a cualquier app autenticadora
 *  (Google Authenticator, 1Password, Aegis…) (Google Authenticator, Aegis…).
 * ════════════════════════════════════════════════════════════════════════
 */
import type { Rol } from '../domain/roles'

export type UsuarioDemo = Readonly<{
  id: string
  correo: string
  nombre: string
  rol: Rol
  contrasena: string
  secretoTotp: string
}>

export const USUARIOS_DEMO: readonly UsuarioDemo[] = [
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
