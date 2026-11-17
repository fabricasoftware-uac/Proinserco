import type { NivelAutenticacion } from '@/shared/domain/actor'
import type { Rol } from './roles'

/** Lo que el proveedor de identidad confirma de quien trae la sesión. */
export type Identidad = Readonly<{
  usuarioId: string
  correo: string
  nombre: string
  rol: Rol
  /** aal2 = segundo factor superado. El panel exige aal2. */
  nivel: NivelAutenticacion
  /** Para el aviso de "tu sesión expira en…" (solo interfaz). */
  expiraEn: Date
}>
