import Link from 'next/link'
import type { ReactNode } from 'react'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { FlechaMarca } from '@/shared/ui/sitio/flecha'

export type SeccionLegal = Readonly<{ id: string; titulo: string; contenido: ReactNode }>

const FECHA_BORRADOR = '16 de noviembre de 2026'

const PAGINAS = [
  { href: '/legal/tratamiento-de-datos', nombre: 'Tratamiento de datos' },
  { href: '/legal/aviso-de-privacidad', nombre: 'Aviso de privacidad' },
  { href: '/legal/cookies', nombre: 'Cookies' },
  { href: '/legal/terminos', nombre: 'Términos y condiciones' },
  { href: '/legal/donaciones', nombre: 'Política de donaciones' },
] as const

/** Marcador visible para todo dato que el cliente aún no ha entregado. Nunca se inventa. */
export function PorDefinir({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded-sm bg-marca/20 px-1 font-semibold text-texto outline outline-1 outline-marca [box-decoration-break:clone]">
      [POR DEFINIR: {children}]
    </mark>
  )
}

/** Datos del responsable: lo conocido sale del contenido fuente; lo demás, marcador. */
export function DatosResponsable() {
  const { organizacion, contacto: c } = CONTENIDO_SITIO
  return (
    <ul>
      <li>
        <strong>Nombre:</strong> {organizacion.nombre} (PROINSERCO), fundación sin ánimo de lucro. Razón social:{' '}
        {organizacion.razonSocial}.
      </li>
      <li>
        <strong>NIT:</strong> {organizacion.nit}
      </li>
      <li>
        <strong>Domicilio:</strong> {c.direccion}, barrio {c.barrio}, {c.ciudad}, {c.departamento}, {c.pais}.
      </li>
      <li>
        <strong>Teléfono:</strong> {c.telefono}
      </li>
      <li>
        <strong>Correo para asuntos de datos personales:</strong> {c.correo}
      </li>
      <li>
        <strong>Área o persona responsable de atender consultas y reclamos:</strong>{' '}
        <PorDefinir>nombre del cargo o persona</PorDefinir>
      </li>
    </ul>
  )
}

type Props = Readonly<{
  titulo: string
  resumen: string
  secciones: readonly SeccionLegal[]
  actual: (typeof PAGINAS)[number]['href']
}>

/**
 * Plantilla común de las páginas legales: aviso de borrador, versión y fecha,
 * índice lateral en escritorio (plegable en móvil) y ancho de lectura cómodo.
 */
export function PlantillaLegal({ titulo, resumen, secciones, actual }: Props) {
  const indice = (
    <ol className="space-y-1 text-pequeno">
      {secciones.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="flex min-h-11 items-center gap-2 rounded-control px-2 text-texto-suave hover:text-texto hover:underline"
          >
            <span aria-hidden="true" className="w-5 shrink-0 text-micro">
              {i + 1}.
            </span>
            {s.titulo}
          </a>
        </li>
      ))}
    </ol>
  )

  const [dia, mes, anio] = FECHA_BORRADOR.split(' de ')
  return (
    <main data-seccion-tema="crema" data-nav="crema" data-nav-titulo="Legal" className="min-h-dvh bg-superficie pb-20 text-texto">
      <header data-seccion-tema="bosque" data-nav="bosque" data-nav-titulo="Legal" className="legal-cabecera">
        <FlechaMarca className="legal-cabecera-flecha" />
        <div className="relative mx-auto grid max-w-6xl gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <h1 data-lineas="" className="legal-titulo mega">
              <span className="l">
                <span className="l-in">{titulo}</span>
              </span>
            </h1>
            <p data-rev="subir" className="mt-5 max-w-2xl text-realce text-texto-suave">
              {resumen}
            </p>
          </div>
          <p data-rev="giro" className="legal-sello">
            <span className="legal-sello-dia">{dia}</span>
            <span className="legal-sello-mes enfasis">{mes}</span>
            <span className="legal-sello-anio">{anio}</span>
            <span className="legal-sello-version">
              Versión <span className="tabular-nums">{CONTENIDO_SITIO.legal.versionPoliticaDatos}</span>
            </span>
            <span className="sr-only">Actualizado el {FECHA_BORRADOR}</span>
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-gutter pt-10">
        <div className="max-w-3xl">
          <div role="note" className="legal-nota">
            <p className="font-semibold">Borrador pendiente de validación jurídica</p>
            <p className="mt-1 text-pequeno text-texto-suave">
              {CONTENIDO_SITIO.legal.aviso} Los datos que la fundación aún no ha entregado aparecen resaltados como{' '}
              <PorDefinir>dato pendiente</PorDefinir>.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
          <aside aria-label="Índice de esta página" className="lg:sticky lg:top-28 lg:h-fit">
            <details className="rounded-control border-2 border-borde-sutil bg-superficie-elevada px-3 lg:hidden">
              <summary className="flex min-h-12 cursor-pointer items-center font-semibold">Contenido de esta página</summary>
              <div className="pb-3">{indice}</div>
            </details>
            <nav className="hidden lg:block" aria-label="Secciones">
              <p className="mb-2 px-2 font-enfasis text-realce italic">En esta página</p>
              {indice}
            </nav>
            <nav className="mt-6 hidden border-t border-borde-sutil pt-4 lg:block" aria-label="Otros documentos legales">
              <p className="mb-2 px-2 font-enfasis text-realce italic">Otros documentos</p>
              <ul className="space-y-1 text-pequeno">
                {PAGINAS.filter((p) => p.href !== actual).map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      className="flex min-h-11 items-center rounded-control px-2 text-texto-suave hover:text-texto hover:underline"
                    >
                      {p.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <article className="max-w-[68ch] text-cuerpo [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-1.5 [&_p]:mt-3 [&_table]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
            {secciones.map((s, i) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="mb-10 scroll-mt-28">
                <h2 id={`${s.id}-t`} className="legal-h2">
                  <span className="legal-h2-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="sr-only">{i + 1}. </span>
                  {s.titulo}
                </h2>
                {s.contenido}
              </section>
            ))}
            <nav aria-label="Otros documentos legales" className="mt-12 border-t border-borde-sutil pt-6 lg:hidden">
              <p className="font-semibold">Otros documentos</p>
              <ul>
                {PAGINAS.filter((p) => p.href !== actual).map((p) => (
                  <li key={p.href}>
                    <Link href={p.href}>{p.nombre}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          </article>
        </div>
      </div>
    </main>
  )
}

/** Tabla con desplazamiento propio: nunca provoca scroll horizontal de la página. */
export function TablaLegal({
  cabeceras,
  filas,
  descripcion,
}: {
  cabeceras: readonly string[]
  filas: readonly (readonly ReactNode[])[]
  descripcion: string
}) {
  return (
    <section
      className="mt-3 overflow-x-auto rounded-control border-2 border-borde-sutil"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: región con scroll propio: debe ser alcanzable con teclado
      tabIndex={0}
      aria-label={descripcion}
    >
      <table className="w-full min-w-[34rem] border-collapse text-left text-pequeno">
        <caption className="sr-only">{descripcion}</caption>
        <thead className="bg-superficie-elevada">
          <tr>
            {cabeceras.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde-sutil">
          {filas.map((f) => (
            <tr key={String(f[0])}>
              {f.map((celda, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: columnas fijas
                <td key={i} className="px-3 py-2 align-top">
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
