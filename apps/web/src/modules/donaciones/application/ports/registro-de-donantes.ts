/**
 * Puerto PROPIO del módulo donaciones para registrar al donante (y su
 * autorización de datos) sin importar el módulo donantes. El composition
 * root lo conecta con el caso de uso de donantes.
 */
export type ContextoConsentimiento = Readonly<{ ip: string | null; userAgent: string | null }>

export interface RegistroDeDonantes {
  /** Valida y guarda al donante + consentimientos. Devuelve su id y los datos del pagador. */
  registrar(
    datosDonante: unknown,
    quiereCertificado: boolean,
    contexto: ContextoConsentimiento,
  ): Promise<{ donanteId: string; nombres: string; apellidos: string; correo: string }>
}
