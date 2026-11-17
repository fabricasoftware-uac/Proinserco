import type { EventoDeDominio, PublicadorEventos } from '../application/ports/publicador-eventos'

type Suscriptor = (evento: EventoDeDominio) => Promise<void> | void

/**
 * Publicador síncrono en proceso. Un fallo de un suscriptor no rompe la
 * operación que publicó: se registra y se sigue (el evento es secundario).
 */
export function crearPublicadorEventosMemoria(
  alFallar: (error: unknown, evento: EventoDeDominio) => void = () => {},
): PublicadorEventos & { suscribir(tipo: string, s: Suscriptor): void; publicados: EventoDeDominio[] } {
  const suscriptores = new Map<string, Suscriptor[]>()
  const publicados: EventoDeDominio[] = []
  return {
    publicados,
    suscribir(tipo, s) {
      suscriptores.set(tipo, [...(suscriptores.get(tipo) ?? []), s])
    },
    async publicar(evento) {
      publicados.push(evento)
      if (publicados.length > 500) publicados.shift()
      for (const s of suscriptores.get(evento.tipo) ?? []) {
        try {
          await s(evento)
        } catch (error) {
          alFallar(error, evento)
        }
      }
    },
  }
}
