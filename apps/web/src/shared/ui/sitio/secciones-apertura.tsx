import Image from 'next/image'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { HacemosVivo, HeroVivo } from './apertura-vivo'
import { FlechaTrazo } from './flecha'
import { fotoDemo, partirResaltadas } from './fotos'
import { GlifoHacemos } from './glifos'
import { HeroFotos } from './hero-fotos'

const { organizacion, quienesSomos, misionVision, queHacemos, contacto } = CONTENIDO_SITIO

/* ─── 1. Hero: la frase que se abre como una ventana (E4) ──────────── */
/*
 * La foto llena la pantalla; una capa verde en mix-blend-mode multiply la
 * oscurece y las letras (claras) son una VENTANA a la foto a plena luz. La
 * "O" de comunidad es la flecha de la marca: al bajar, la cámara entra por
 * ella dando la vuelta (scrub) y desemboca en el sitio. Sección alta con
 * contenido sticky: sin pin-spacer, robusta a recargas a mitad de página.
 */
export function Hero() {
  // Rotación del hero: primero el valle (más luminoso: las letras-ventana se leen mejor).
  const fotosHero = ['hero-15699964', 'hero-13795169', 'hero-32190390', 'hero-32419583'].map(fotoDemo)
  return (
    <section id="inicio" data-hero="" data-nav="bosque" data-nav-titulo="Inicio" aria-labelledby="titulo-hero" className="hero">
      <div className="hero-fijo">
        <div data-hero-foto="" className="hero-foto">
          <HeroFotos fotos={fotosHero.map((f) => ({ src: f.src, alt: f.alt }))} />
        </div>

        <div data-hero-capa="" className="hero-capa">
          <div data-hero-letras="" className="hero-letras">
            <h1 id="titulo-hero" data-hero-deriva="" data-lineas="" className="hero-titulo mega" aria-label={organizacion.lema}>
              <span aria-hidden="true" className="l hero-l1">
                <span className="l-in">Al servicio</span>
              </span>
              <span aria-hidden="true" className="l hero-l2">
                <span className="l-in enfasis">de la</span>
              </span>
              <span aria-hidden="true" className="l hero-l3">
                <span className="l-in">
                  C
                  <span data-hero-o="" className="hero-o">
                    <FlechaTrazo data-hero-o-flecha="" grosor={14} className="hero-o-flecha" />
                  </span>
                  munidad
                </span>
              </span>
            </h1>
          </div>
        </div>

        <div data-hero-sale="" className="hero-sale">
          <p data-rev="subir" data-rev-orden="1" className="hero-margen hero-margen-lugar">
            {contacto.ciudad}, {contacto.departamento}
            <span className="enfasis"> · desde hace </span>
            {organizacion.aniosExperiencia} años
          </p>
          <p data-rev="subir" data-rev-orden="2" className="hero-margen hero-margen-texto">
            {organizacion.descripcionCorta}
          </p>
          <a
            href="#donar-cta"
            data-rev="zoom"
            data-rev-orden="3"
            data-cursor="Entra"
            className="hero-bajar"
            data-sin-transicion=""
          >
            <FlechaTrazo grosor={9} className="hero-bajar-flecha" />
            <span>
              Baja y entra <span className="enfasis">por la</span> O
            </span>
          </a>
        </div>
      </div>
      <HeroVivo />
    </section>
  )
}

/* ─── 2. Quiénes somos: el dato con aro y el texto que se enciende ─── */
export function QuienesSomos() {
  const [p1, p2] = quienesSomos.parrafos
  const fotoA = fotoDemo('comunidad-27611557')
  const fotoB = fotoDemo('territorio-16976135')
  return (
    <section
      id="quienes-somos"
      data-nav="crema"
      data-nav-titulo="Quiénes somos"
      data-seccion-tema="crema"
      aria-labelledby="titulo-quienes"
      className="plano quienes"
    >
      <div className="quienes-rejilla">
        <h2 id="titulo-quienes" data-lineas="" className="quienes-titulo mega">
          <span className="l">
            <span className="l-in">¿Quiénes</span>
          </span>
          <span className="l quienes-titulo-2">
            <span className="l-in">
              <span className="enfasis">somos</span>?
            </span>
          </span>
        </h2>

        <div data-rev="zoom" className="quienes-dato">
          <svg viewBox="0 0 100 100" className="quienes-dato-aro" aria-hidden="true" fill="none">
            <path
              data-dibujar="2.2"
              d="M18.05 61.63 A34 34 0 1 0 20.56 33"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
          <span data-contar={quienesSomos.cifra.valor} className="quienes-dato-cifra">
            {quienesSomos.cifra.valor}
          </span>
          <span className="quienes-dato-etiqueta">
            años <span className="enfasis">de</span> experiencia
          </span>
        </div>

        <p data-texto-luz="" className="quienes-parrafo">
          {partirResaltadas(p1 ?? '', quienesSomos.resaltadas).map((t) =>
            t.resaltada ? (
              <mark key={t.clave} className="resaltada">
                {t.trozo}
              </mark>
            ) : (
              <span key={t.clave}>{t.trozo}</span>
            ),
          )}
        </p>

        <figure data-rev="clip" className="quienes-foto quienes-foto-a">
          <div data-capa="0.18" className="quienes-foto-capa">
            <Image
              src={fotoA.src}
              alt={fotoA.alt}
              fill
              sizes="(min-width: 1024px) 34vw, 92vw"
              quality={85}
              className="object-cover"
            />
          </div>
        </figure>
        <figure data-rev="clip" data-rev-orden="1" className="quienes-foto quienes-foto-b">
          <div data-capa="-0.12" className="quienes-foto-capa">
            <Image
              src={fotoB.src}
              alt={fotoB.alt}
              fill
              sizes="(min-width: 1024px) 24vw, 60vw"
              quality={85}
              className="object-cover"
            />
          </div>
        </figure>

        <p data-rev="subir" className="quienes-segundo">
          {p2}
        </p>

        <article data-rev="izq" className="quienes-mv quienes-mision" data-seccion-tema="bosque">
          <h3 className="quienes-mv-titulo display">Misión</h3>
          <p className="quienes-mv-texto">{misionVision.mision}</p>
        </article>
        <article data-rev="der" className="quienes-mv quienes-vision" data-seccion-tema="sol">
          <h3 className="quienes-mv-titulo display">Visión</h3>
          {misionVision.vision.map((v) => (
            <p key={v.slice(0, 20)} className="quienes-mv-texto">
              {v}
            </p>
          ))}
        </article>
      </div>
    </section>
  )
}

/* ─── 3. Qué hacemos: persiana + lista gigante (E5) ────────────────── */
/** Nombre corto (abreviatura del título real) para la tipografía gigante. */
const CORTOS: Record<string, string> = {
  elaboracion: 'Proyectos',
  impulso: 'Impulso',
  asesoramiento: 'Asesoría',
  capacitaciones: 'Formación',
  estudios: 'Estudios',
  'programas-sociales': 'Programas sociales',
}
const FOTOS_HACEMOS: Record<string, string> = {
  elaboracion: 'territorio-18823845',
  impulso: 'comunidad-28168018',
  asesoramiento: 'educacion-11629479',
  capacitaciones: 'educacion-28175940',
  estudios: 'agricola-13802103',
  'programas-sociales': 'salud-37191912',
}
const TEMAS_TARJETA = ['terracota', 'sol', 'lima', 'crema', 'cielo', 'terracota'] as const
const VERBOS = ['Elaboramos', 'Impulsamos', 'Asesoramos', 'Formamos', 'Investigamos', 'Acompañamos']
const BARRAS = 9

export function QueHacemos() {
  return (
    <section
      id="que-hacemos"
      data-nav="bosque"
      data-nav-titulo="Qué hacemos"
      aria-labelledby="titulo-hacemos"
      className="hacemos"
    >
      <div
        data-hacemos-persiana=""
        data-nav="crema"
        data-nav-titulo="Qué hacemos"
        data-seccion-tema="crema"
        className="hacemos-persiana"
      >
        <div className="hacemos-persiana-fijo">
          <div aria-hidden="true" className="hacemos-cinta">
            <p data-hacemos-cinta="" className="hacemos-cinta-texto mega">
              {[...VERBOS, ...VERBOS].map((v, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: la cinta repite la lista dos veces.
                <span key={`${v}-${i}`} className="hacemos-cinta-palabra">
                  {v}
                  <FlechaTrazo grosor={12} className="hacemos-cinta-flecha" />
                </span>
              ))}
            </p>
          </div>
          <div aria-hidden="true" className="hacemos-barras">
            {Array.from({ length: BARRAS }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: barras idénticas.
              <span key={i} data-hacemos-barra="" data-nav="bosque" className="hacemos-barra" />
            ))}
          </div>
        </div>
      </div>

      <div data-seccion-tema="bosque" className="hacemos-cuerpo">
        <h2 id="titulo-hacemos" data-lineas="" className="hacemos-titulo mega">
          <span className="l">
            <span className="l-in">
              ¿Qué <span className="enfasis">hacemos</span>?
            </span>
          </span>
        </h2>
        <ol className="hacemos-lista">
          {queHacemos.items.map((item, i) => {
            const foto = fotoDemo(FOTOS_HACEMOS[item.id] ?? 'hero-32419583')
            return (
              <li
                key={item.id}
                // biome-ignore lint/a11y/noNoninteractiveTabindex: el foco activa el frente y muestra su descripción (equivalente al hover).
                tabIndex={0}
                data-hacemos-item=""
                data-activo={i === 0 ? 'si' : 'no'}
                data-seccion-tema={TEMAS_TARJETA[i]}
                className="hacemos-item"
              >
                <div className="hacemos-item-cabeza">
                  <GlifoHacemos id={item.id} className="hacemos-glifo" />
                  <h3 className="hacemos-corto mega">{CORTOS[item.id] ?? item.titulo}</h3>
                </div>
                {/* Panel fijo (columna derecha en escritorio): foto + título + descripción del frente activo. */}
                <div className="hacemos-panel">
                  <div aria-hidden="true" className="hacemos-foto">
                    <Image
                      src={foto.src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 34vw, 92vw"
                      quality={75}
                      className="hacemos-foto-img object-cover"
                    />
                  </div>
                  <p aria-hidden="true" className="hacemos-panel-titulo">
                    {CORTOS[item.id] ?? item.titulo}
                  </p>
                  <p className="hacemos-largo">{item.titulo}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <HacemosVivo />
    </section>
  )
}
