import { z } from 'zod'
import { NoAutorizado } from './errores'

/**
 * Permisos con formato `recurso:accion`. El código comprueba SIEMPRE permisos,
 * nunca roles. Los roles (módulo iam) solo agrupan permisos.
 */
export const Permiso = z.enum([
  'panel:entrar',
  'donaciones:leer',
  'donaciones:exportar',
  'donaciones:reembolsar',
  'donantes:leer',
  'donantes:revelar',
  'donantes:exportar',
  'auditoria:leer',
  'ajustes:leer',
  'ajustes:editar',
])
export type Permiso = z.infer<typeof Permiso>

export type NivelAutenticacion = 'aal1' | 'aal2'

/** Quién ejecuta una operación del panel. Solo existe tras autenticar en servidor. */
export class Actor {
  readonly #permisos: ReadonlySet<Permiso>

  constructor(
    readonly usuarioId: string,
    readonly nombre: string,
    readonly correo: string,
    readonly rol: string,
    permisos: Iterable<Permiso>,
    readonly nivel: NivelAutenticacion,
  ) {
    this.#permisos = new Set(permisos)
  }

  puede(permiso: Permiso): boolean {
    return this.#permisos.has(permiso)
  }

  exigir(permiso: Permiso): void {
    if (!this.puede(permiso)) throw new NoAutorizado(permiso)
  }

  get permisos(): readonly Permiso[] {
    return [...this.#permisos]
  }
}

/** Origen de una operación que no hace una persona del panel (webhook, conciliación). */
export const ACTOR_SISTEMA = 'sistema'
