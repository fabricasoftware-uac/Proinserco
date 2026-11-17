export type EventoDeDominio = Readonly<{
  tipo: string
  ocurridoEn: Date
  datos: Readonly<Record<string, string | number | boolean | null>>
}>

/** Permite añadir asincronía (una cola) después sin tocar los casos de uso. */
export interface PublicadorEventos {
  publicar(evento: EventoDeDominio): Promise<void>
}
