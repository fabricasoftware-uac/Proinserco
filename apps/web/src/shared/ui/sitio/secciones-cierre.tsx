import Image from 'next/image'
import Link from 'next/link'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { DonarAro, ValoresVivo } from './cierre-vivo'
import { FlechaTrazo } from './flecha'

const { aliados, valores, principios, equipo, donar, contacto } = CONTENIDO_SITIO

/* ─── 7. Valores y principios: editorial y sobrio ──────────────────── */
/*
 * Fondo arena calmado y el terracota solo como acento. A la izquierda,
 * fija, la cabecera con el conteo real (8 valores, 12 principios); a la
 * derecha, los valores en una lista tipográfica donde se enciende el que
 * pasa por el centro de la pantalla, y los principios como un índice
 * compacto. Sin definiciones: la fuente no las trae y no se inventan.
 */
export function Valores() {
  return (
    <section
      id="valores"
      data-nav="crema"
      data-nav-titulo="Valores"
      data-seccion-tema="crema"
      aria-labelledby="titulo-valores"
      className="plano plano-arena valores"
    >
      <div className="valores-composicion">
        <div className="valores-lado">
          <h2 id="titulo-valores" data-lineas="" className="valores-titulo mega">
            <span className="l">
              <span className="l-in">Valores</span>
            </span>
            <span className="l valores-titulo-2">
              <span className="l-in">
                <span className="enfasis">y</span> principios
              </span>
            </span>
          </h2>
          <p className="valores-cuenta">
            <span className="valores-cuenta-cifra">{valores.lista.length}</span> valores
            <span className="valores-cuenta-separador" aria-hidden="true" />
            <span className="valores-cuenta-cifra">{principios.lista.length}</span> principios
          </p>
        </div>

        <div className="valores-cuerpo">
          <h3 className="valores-subtitulo">{valores.titulo}</h3>
          <ol className="valores-lista" data-valores-lista="">
            {valores.lista.map((v) => (
              <li key={v} data-valor="" className="valores-item">
                {v}
              </li>
            ))}
          </ol>

          <h3 className="valores-subtitulo">{principios.titulo}</h3>
          <ol className="principios-indice">
            {principios.lista.map((p, i) => (
              <li key={p} className="principio">
                <span className="principio-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {p}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <ValoresVivo />
    </section>
  )
}

/* ─── 8. Aliados: rejilla uniforme, logos normalizados ─────────────── */
/*
 * Medidas REALES de cada archivo (sharp, trim con umbral 18 sobre el fondo
 * blanco): tamaño del archivo y caja del contenido visible. Cada logo se
 * recorta a su contenido con CSS y se escala a la MISMA área visual dentro
 * de una celda blanca común (los horizontales salen más anchos, los
 * verticales más altos), centrado y sin recortes. Si cambian los archivos,
 * hay que volver a medir.
 */
const MEDIDAS: Record<string, { w: number; h: number; tw: number; th: number; x: number; y: number }> = {
  'universidad-del-cauca': { w: 412, h: 580, tw: 332, th: 516, x: 40, y: 32 },
  'cabildo-indigena-guambia': { w: 423, h: 109, tw: 423, th: 109, x: 0, y: 0 },
  'ips-mama-dominga-guambia': { w: 960, h: 240, tw: 931, th: 216, x: 12, y: 11 },
  osteosalud: { w: 225, h: 225, tw: 225, th: 135, x: 0, y: 73 },
  'fes-ips-sas': { w: 257, h: 196, tw: 256, th: 196, x: 1, y: 0 },
  'forjadores-del-futuro': { w: 960, h: 343, tw: 874, th: 343, x: 86, y: 0 },
  'integrales-colombia': { w: 200, h: 154, tw: 134, th: 46, x: 33, y: 54 },
}
/** Área visual común, en % de la celda (celda 100 × 66,7). */
const AREA = 1500
function cajaLogo(tw: number, th: number) {
  const r = tw / th
  let ancho = Math.sqrt(AREA * r)
  let alto = Math.sqrt(AREA / r)
  if (ancho > 78) {
    ancho = 78
    alto = ancho / r
  }
  if (alto > 54) {
    alto = 54
    ancho = alto * r
  }
  return { ancho, alto }
}

export function Aliados() {
  return (
    <section
      id="aliados"
      data-nav="crema"
      data-nav-titulo="Aliados"
      data-seccion-tema="crema"
      aria-labelledby="titulo-aliados"
      className="plano aliados"
    >
      <div className="aliados-cabeza">
        <h2 id="titulo-aliados" data-lineas="" className="aliados-titulo mega">
          <span className="l">
            <span className="l-in">
              Lo bueno se hace <span className="enfasis">en</span> compañía
            </span>
          </span>
        </h2>
        <p data-rev="subir" className="aliados-texto">
          {aliados.titulo}: universidades, cabildos, instituciones de salud y empresas.
        </p>
      </div>
      <ul className="aliados-rejilla">
        {aliados.lista.map((a, i) => {
          const m = MEDIDAS[a.id] ?? { w: a.logo.ancho, h: a.logo.alto, tw: a.logo.ancho, th: a.logo.alto, x: 0, y: 0 }
          const { ancho } = cajaLogo(m.tw, m.th)
          return (
            <li key={a.id} data-rev="subir" data-rev-orden={i} className="aliados-celda" title={a.nombre}>
              <div className="aliados-recorte" style={{ width: `${ancho}%`, aspectRatio: `${m.tw} / ${m.th}` }}>
                <Image
                  src={a.logo.src}
                  alt={a.nombre}
                  width={m.w}
                  height={m.h}
                  sizes="16rem"
                  className="aliados-logo"
                  style={{
                    width: `${(m.w / m.tw) * 100}%`,
                    height: `${(m.h / m.th) * 100}%`,
                    left: `${(-m.x / m.tw) * 100}%`,
                    top: `${(-m.y / m.th) * 100}%`,
                  }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Giro fijo de cada polaroid: compuesto a mano, pero quieto. */
const GIROS_POLAROID = [-2.5, 1.8, -1.2, 2.2, -1.8]

/* ─── 9. Equipo: retratos con vida (E8) ─────────────────────────────── */
export function Equipo() {
  const miembros = equipo.miembros.map((m) => ({
    id: m.id,
    nombre: m.nombre,
    rol: m.rol,
    descripcion: 'descripcion' in m ? m.descripcion : '',
    foto: m.foto.src,
  }))
  return (
    <section
      id="equipo"
      data-nav="bosque"
      data-nav-titulo="Equipo"
      data-seccion-tema="bosque"
      aria-labelledby="titulo-equipo"
      className="plano equipo"
    >
      <div className="equipo-cabeza">
        <h2 id="titulo-equipo" data-lineas="" className="equipo-titulo mega">
          <span className="l">
            <span className="l-in">
              Nuestro <span className="enfasis">equipo</span>
            </span>
          </span>
        </h2>
        <p data-rev="subir" className="equipo-intro">
          {equipo.introduccion}
        </p>
      </div>
      {/* Polaroids en una rejilla ordenada; subgrid alinea foto, nombre, cargo y texto en las 5 tarjetas. */}
      <ul className="equipo-rejilla">
        {miembros.map((m, i) => (
          <li key={m.id} data-rev="subir" data-rev-orden={i} className="equipo-tarjeta">
            <figure className="polaroid" style={{ rotate: `${GIROS_POLAROID[i] ?? 0}deg` }}>
              <div className="polaroid-foto">
                <Image
                  src={m.foto}
                  alt={`Retrato de ${m.nombre}`}
                  fill
                  sizes="(min-width: 1024px) 12rem, 40vw"
                  quality={85}
                  className="object-cover"
                />
              </div>
              <figcaption className="polaroid-pie enfasis">{m.nombre.split(' ')[0]}</figcaption>
            </figure>
            <h3 className="equipo-nombre">{m.nombre}</h3>
            <p className="equipo-rol">{m.rol}</p>
            {m.descripcion ? (
              <p className="equipo-descripcion">{m.descripcion}</p>
            ) : (
              <span aria-hidden="true" className="equipo-descripcion equipo-sin-texto">
                <FlechaTrazo grosor={10} className="equipo-sin-texto-flecha" />
              </span>
            )}
          </li>
        ))}
      </ul>
      <p data-rev="subir" className="equipo-cierre enfasis">
        {equipo.cierre}
      </p>
    </section>
  )
}

/* ─── 10. Donar: el aro que se llena (E7) ──────────────────────────── */
export function DonarCta() {
  return (
    <section
      id="donar-cta"
      data-nav="bosque"
      data-nav-titulo="Donar"
      data-seccion-tema="bosque"
      aria-labelledby="titulo-donar"
      className="plano donar"
    >
      <DonarAro titulo={donar.titulo} llamado={donar.llamado} montos={donar.montosSugeridosPesos} />
    </section>
  )
}

/* ─── 11. Contacto ──────────────────────────────────────────────────── */
export function Contacto() {
  return (
    <section
      id="contacto"
      data-nav="crema"
      data-nav-titulo="Contacto"
      data-seccion-tema="crema"
      aria-labelledby="titulo-contacto"
      className="plano contacto"
    >
      <h2 id="titulo-contacto" data-lineas="" className="contacto-titulo mega">
        <span className="l">
          <span className="l-in">Hablemos.</span>
        </span>
        <span className="l contacto-titulo-2">
          <span className="l-in enfasis">El tinto lo ponemos nosotros.</span>
        </span>
      </h2>
      <div className="contacto-cuerpo">
        <a
          href={contacto.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Escribir por WhatsApp al ${contacto.telefono}`}
          data-rev="subir"
          data-cursor="WhatsApp"
          className="contacto-telefono"
        >
          <span className="contacto-telefono-numero">{contacto.telefono}</span>
          <span className="contacto-telefono-flecha" aria-hidden="true">
            <FlechaTrazo grosor={11} className="size-full" />
          </span>
        </a>
        <address data-rev="caer" data-seccion-tema="sol" className="contacto-sello">
          <span className="contacto-sello-titulo display">Visítanos</span>
          <span className="contacto-sello-calle">{contacto.direccion}</span>
          <span>
            Barrio {contacto.barrio}, {contacto.ciudad}, {contacto.departamento}
          </span>
        </address>
        <Link href="/donar" data-rev="zoom" data-seccion-tema="bosque" className="contacto-donar boton-juego" data-cursor="Donar">
          O mejor, <span className="enfasis">dona</span> hoy
        </Link>
      </div>
    </section>
  )
}
