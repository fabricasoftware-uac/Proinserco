/**
 * Glifos propios de trazo grueso, un poco irregulares, dibujados para cada
 * frente de "Qué hacemos" (nada de iconos de librería). Decorativos.
 */
const TRAZOS: Record<string, string[]> = {
  // Plano con un camino que se dobla: diseñar el proyecto.
  elaboracion: ['M14 20h52l-4 46H18Z', 'M24 54c8-14 18 2 26-12s6-10 10-14'],
  // Brote que empuja hacia arriba: impulso.
  impulso: ['M40 68V30', 'M40 40c-12-2-18-10-18-20 12 0 18 8 18 20Z', 'M40 34c10-4 16-12 16-20-12 2-16 10-16 20Z', 'M24 68h32'],
  // Dos voces que se cruzan: asesoría.
  asesoramiento: ['M12 22h34v22H26l-10 8v-8h-4Z', 'M36 38h30v20h-4v8l-10-8H36Z'],
  // Cuaderno abierto: formación.
  capacitaciones: ['M12 24c10-4 20-4 28 4v38c-8-8-18-8-28-4Z', 'M68 24c-10-4-20-4-28 4v38c8-8 18-8 28-4Z'],
  // Lupa sobre una hoja: estudios.
  estudios: ['M34 16a18 18 0 1 1 0 36 18 18 0 0 1 0-36Z', 'M47 49l17 17', 'M28 38c4-8 10-10 14-8'],
  // Manos en círculo: programas sociales.
  'programas-sociales': ['M40 14a26 26 0 1 1-24 16', 'M16 30l-2-12 12 4', 'M30 44c6 6 14 6 20 0'],
}

export function GlifoHacemos({ id, className }: { id: string; className?: string }) {
  const trazos = TRAZOS[id] ?? TRAZOS.elaboracion ?? []
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false" className={className}>
      {trazos.map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}
