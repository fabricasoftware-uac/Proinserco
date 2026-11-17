import Image from 'next/image'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { FlechaTrazo } from './flecha'
import { fotoDemo } from './fotos'
import { SemilleroVivo, TerritorioVivo } from './trabajo-vivo'

const { comoTrabajamos, capacitaciones, territorio, contacto } = CONTENIDO_SITIO

/* ─── 4. Cómo trabajamos: dos fases en clave editorial ──────────────── */
/*
 * Se lee completo sin interactuar: cada fase es un bloque tipográfico con
 * su nombre en grande y sus cuatro pasos; la numeración (01–08, el camino
 * entero) es tipografía en contorno, no círculos ni líneas. Ritmo
 * asimétrico: la segunda fase entra desplazada, como una página que sigue.
 */
export function ComoTrabajamos() {
  const fases = [
    { clave: 'elaboracion', nombre: comoTrabajamos.elaboracion.titulo, pasos: comoTrabajamos.elaboracion.puntos, desde: 1 },
    { clave: 'ejecucion', nombre: comoTrabajamos.ejecucion.titulo, pasos: comoTrabajamos.ejecucion.puntos, desde: 5 },
  ]
  return (
    <section
      id="como-trabajamos"
      data-nav="crema"
      data-nav-titulo="Cómo trabajamos"
      data-seccion-tema="crema"
      aria-labelledby="titulo-como"
      className="plano plano-arena como"
    >
      <div className="como-cabeza">
        <h2 id="titulo-como" data-lineas="" className="como-titulo mega">
          <span className="l">
            <span className="l-in">
              Cómo <span className="enfasis">trabajamos</span>
            </span>
          </span>
        </h2>
        <p data-rev="subir" className="como-intro">
          Acompañamos cada proyecto de principio a fin: primero lo diseñamos con la comunidad y luego lo ejecutamos y rendimos
          cuentas.
        </p>
      </div>

      {fases.map((f, n) => {
        const [primera, ...resto] = f.nombre.split(' ')
        return (
          <article key={f.clave} className={`como-fase como-fase-${n + 1}`} aria-labelledby={`fase-${f.clave}`}>
            <h3 id={`fase-${f.clave}`} data-rev={n === 0 ? 'izq' : 'der'} className="como-fase-nombre mega">
              <span className="sr-only">Fase {n + 1}: </span>
              {primera} <span className="enfasis">{resto.join(' ')}</span>
            </h3>
            <ol className="como-pasos" start={f.desde}>
              {f.pasos.map((p, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: dos pasos tienen el mismo texto en el contenido.
                  key={`${i}-${p.slice(0, 16)}`}
                  data-rev="subir"
                  data-rev-orden={i}
                  className="como-paso"
                >
                  <span className="como-paso-num" aria-hidden="true">
                    {String(i + f.desde).padStart(2, '0')}
                  </span>
                  <p className="como-paso-texto">{p}</p>
                </li>
              ))}
            </ol>
          </article>
        )
      })}
    </section>
  )
}

/* ─── 5. Capacitaciones: el resultado y los tres sectores ──────────── */
/*
 * Como lo presentaría una fundación seria a un donante: un resultado
 * verificable (103 certificados frente a una meta de 80) con una barra
 * sobria, y los tres sectores en columnas alineadas con lo que se hace.
 */
export function Capacitaciones() {
  const [educacion, salud, agricola] = capacitaciones.sectores
  const destacado = educacion?.destacado
  const sectores = [
    {
      id: 'educacion',
      titulo: educacion?.titulo ?? 'Educación',
      puntos: [`${(educacion?.puntos[0] ?? '').split('. ')[0]}.`],
      foto: fotoDemo('educacion-19884802'),
    },
    { id: 'salud', titulo: salud?.titulo ?? 'Salud', puntos: [...(salud?.puntos ?? [])], foto: fotoDemo('salud-37191912') },
    {
      id: 'agricola',
      titulo: agricola?.titulo ?? 'Agrícola',
      puntos: [...(agricola?.puntos ?? [])],
      foto: fotoDemo('agricola-36040319'),
    },
  ]
  const tope = destacado ? Math.max(destacado.valor, destacado.meta) : 1
  return (
    <section
      id="capacitaciones"
      data-nav="crema"
      data-nav-titulo="Capacitaciones"
      data-seccion-tema="crema"
      aria-labelledby="titulo-capacitaciones"
      className="plano capa"
    >
      <div className="capa-cabeza">
        <h2 id="titulo-capacitaciones" data-lineas="" className="capa-titulo mega">
          <span className="l">
            <span className="l-in">Capacitaciones</span>
          </span>
          <span className="l capa-titulo-2">
            <span className="l-in">
              <span className="enfasis">por</span> sector
            </span>
          </span>
        </h2>

        {destacado ? (
          <figure data-rev="subir" className="capa-dato">
            <p className="capa-dato-cifra">
              <span data-contar={destacado.valor}>{destacado.valor}</span>
            </p>
            <figcaption className="capa-dato-texto">
              {destacado.etiqueta} en el Diplomado en Ciencia, Tecnología e Innovación con la Universidad del Cauca.
            </figcaption>
            <div
              className="capa-barra"
              role="img"
              aria-label={`${destacado.valor} certificadas frente a una meta de ${destacado.meta}`}
            >
              <span className="capa-barra-relleno" data-capa-barra="" />
              <span className="capa-barra-meta" style={{ left: `${(destacado.meta / tope) * 100}%` }}>
                <span className="capa-barra-meta-texto">Meta: {destacado.meta}</span>
              </span>
            </div>
          </figure>
        ) : null}
      </div>

      <ul className="capa-sectores">
        {sectores.map((s, i) => (
          <li key={s.id} data-rev="subir" data-rev-orden={i} className="capa-sector">
            <div className="capa-sector-foto">
              <Image
                src={s.foto.src}
                alt={s.foto.alt}
                fill
                sizes="(min-width: 1024px) 30vw, 92vw"
                quality={85}
                className="object-cover"
              />
            </div>
            <h3 className="capa-sector-titulo">{s.titulo}</h3>
            {/* Texto corrido: cada acción abre con la flecha de la marca, sin listas de líneas finas. */}
            <p className="capa-sector-texto">
              {s.puntos.map((p) => (
                <span key={p} className="capa-sector-frase">
                  <FlechaTrazo grosor={12} className="capa-sector-flecha" />
                  {p}{' '}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
      <SemilleroVivo />
    </section>
  )
}

/* ─── 6. Territorio: el mapa que se recorre (E6) ───────────────────── */
/*
 * Pista horizontal movida por el scroll vertical (contenido sticky, sin
 * pin-spacer): la flecha recorre la ruta que se dibuja entre las paradas
 * reales (sede en Popayán, El Tambo y La Plata), con cordilleras en tres
 * capas. La pista termina en la última parada (sin pantalla vacía). En
 * móvil, la ruta es vertical.
 */
const RUTA_D =
  'M150 640 C 520 420, 760 760, 1150 560 S 1700 300, 2050 520 S 2650 800, 2950 520 S 3500 330, 3820 560 S 4200 640, 4400 600'

export function Territorio() {
  const paradas = [
    {
      id: 'popayan',
      nombre: contacto.ciudad,
      lugar: `${contacto.departamento} · la casa`,
      hecho: `Aquí tenemos la sede: ${contacto.direccion}, barrio ${contacto.barrio}. De aquí salimos a trabajar hombro a hombro con las comunidades.`,
      foto: fotoDemo('territorio-18823845'),
      rev: 'clip',
    },
    {
      id: 'el-tambo',
      nombre: territorio.municipios[0]?.nombre ?? 'El Tambo',
      lugar: territorio.municipios[0]?.departamento ?? 'Cauca',
      hecho: comoTrabajamos.elaboracion.puntos[0] ?? '',
      foto: fotoDemo('agricola-36040319'),
      rev: 'giro',
    },
    {
      id: 'la-plata',
      nombre: territorio.municipios[1]?.nombre ?? 'La Plata',
      lugar: territorio.municipios[1]?.departamento ?? 'Huila',
      hecho: capacitaciones.sectores[2]?.puntos[1] ?? '',
      foto: fotoDemo('agricola-35629751'),
      rev: 'caer',
    },
  ] as const

  return (
    <section
      id="territorio"
      data-nav="bosque"
      data-nav-titulo="Territorio"
      data-seccion-tema="bosque"
      aria-labelledby="titulo-territorio"
      className="terri"
    >
      <div className="terri-fijo">
        <div data-terri-pista="" className="terri-pista">
          <svg
            aria-hidden="true"
            className="terri-cordillera terri-cordillera-1"
            data-terri-capa="0.12"
            viewBox="0 0 4400 300"
            preserveAspectRatio="none"
          >
            <path
              d="M0 300V170l260-90 300 110 380-150 320 120 420-130 360 140 380-110 340 120 420-150 360 130 380-90 280 60V300Z"
              fill="currentColor"
            />
          </svg>
          <svg
            aria-hidden="true"
            className="terri-cordillera terri-cordillera-2"
            data-terri-capa="0.24"
            viewBox="0 0 4400 300"
            preserveAspectRatio="none"
          >
            <path
              d="M0 300V220l340-70 280 90 420-110 300 80 460-100 300 110 420-80 360 90 400-120 380 100 440-60V300Z"
              fill="currentColor"
            />
          </svg>

          <svg aria-hidden="true" className="terri-ruta" viewBox="0 0 4400 1000" preserveAspectRatio="none" fill="none">
            <path
              d={RUTA_D}
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="2 12"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.35"
            />
            <path data-terri-ruta="" d={RUTA_D} className="terri-ruta-trazo" strokeWidth="6" strokeLinecap="round" />
          </svg>

          <div className="terri-panel terri-intro">
            <h2 id="titulo-territorio" data-lineas="" className="terri-titulo mega">
              <span className="l">
                <span className="l-in">{territorio.titulo}</span>
              </span>
              <span className="l terri-titulo-2">
                <span className="l-in">
                  <span className="enfasis">de</span> ida <span className="enfasis">y</span> vuelta
                </span>
              </span>
            </h2>
            <p data-rev="subir" className="terri-intro-texto">
              Tenemos casa en {contacto.ciudad}, en el corazón del {territorio.departamento}, y salimos a trabajar donde están los
              proyectos. Baja y acompáñanos en el recorrido.
            </p>
          </div>

          {paradas.map((p, i) => (
            <article key={p.id} data-terri-parada="" className={`terri-parada terri-parada-${i}`}>
              <figure data-terri-rev={p.rev} className="terri-foto">
                <Image
                  src={p.foto.src}
                  alt={p.foto.alt}
                  fill
                  sizes="(min-width: 1024px) 34vw, 92vw"
                  quality={85}
                  className="object-cover"
                />
              </figure>
              <div className="terri-texto">
                <h3 className="terri-nombre mega">{p.nombre}</h3>
                <p className="terri-lugar enfasis">{p.lugar}</p>
                <p className="terri-hecho">{p.hecho}</p>
              </div>
            </article>
          ))}
        </div>
        <FlechaTrazo data-terri-viajera="" grosor={12} className="terri-viajera" />
      </div>
      <TerritorioVivo />
    </section>
  )
}
