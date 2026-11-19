import type { Alerta, Notificador } from '../application/ports/notificador'

type Escritor = (mensaje: string, datos: Record<string, unknown>) => void

/** Adaptador de log: siempre activo. `critica` sale como error; el resto como advertencia. */
export function crearNotificadorRegistro(salida: { advertencia: Escritor; error: Escritor }): Notificador {
  return {
    async notificar(alerta: Alerta) {
      const escribir = alerta.severidad === 'critica' ? salida.error : salida.advertencia
      escribir(`ALERTA: ${alerta.titulo}`, { severidad: alerta.severidad, ...alerta.detalles })
    },
  }
}

/** Reparte la alerta a varios canales; el fallo de uno no impide los demás. */
export function crearNotificadorCompuesto(canales: readonly Notificador[]): Notificador {
  return {
    async notificar(alerta) {
      await Promise.allSettled(canales.map((c) => c.notificar(alerta)))
    },
  }
}
