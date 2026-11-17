/** Identificadores impredecibles. Es un puerto para poder fijarlos en tests. */
export interface GeneradorIds {
  /** UUID v4. */
  uuid(): string
  /** Referencia pública de donación: sin caracteres ambiguos y con ≥ 100 bits de entropía. */
  referencia(): string
}
