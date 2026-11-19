export type SeveridadAlerta = 'info' | 'advertencia' | 'critica'

/** Alerta operativa para una persona responsable. NUNCA datos personales ni secretos. */
export type Alerta = Readonly<{
  titulo: string
  severidad: SeveridadAlerta
  detalles: Readonly<Record<string, string | number | boolean | null>>
}>

/**
 * Canal de alertas (log, webhook de chat, correo…). Lo elige el composition root.
 * `notificar` NO lanza: una alerta que no sale no debe tumbar el proceso que la emite
 * (el adaptador registra su propio fallo).
 */
export interface Notificador {
  notificar(alerta: Alerta): Promise<void>
}
