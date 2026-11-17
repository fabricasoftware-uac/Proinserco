import type { Consentimiento } from '../../domain/consentimiento'

/** Registro de autorizaciones de datos. SOLO INSERCIÓN: no hay actualizar ni borrar. */
export interface RegistroConsentimientos {
  insertar(consentimiento: Consentimiento): Promise<void>
  listarPorDonante(donanteId: string): Promise<readonly Consentimiento[]>
}
