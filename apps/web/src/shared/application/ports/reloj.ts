/** El dominio nunca lee el reloj del sistema: lo recibe por este puerto. */
export interface Reloj {
  ahora(): Date
}
