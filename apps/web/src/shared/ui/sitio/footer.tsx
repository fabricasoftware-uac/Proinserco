import Image from 'next/image'
import Link from 'next/link'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { BotonCookies } from './boton-cookies'
import { ENLACES_LEGALES, ENLACES_SECCION } from './enlaces'
import { FlechaTrazo } from './flecha'
import { FranjaSiembra, LetrasReactivas, PieVivo } from './pie-vivo'

const { organizacion, contacto, creditos, cierre } = CONTENIDO_SITIO
/** Crédito único del footer: Created by Fábrica de Software. */
const credito = creditos.find((x) => x.texto.startsWith('Created by')) ?? { url: 'https://www.fabsoft.app/' }

/**
 * E9 — "El último acto". El footer sube como tres cordilleras de color
 * (sol, terracota, bosque) que se mueven a distinta velocidad; arriba
 * reserva la ranura donde se acopla el navbar y, al fusionarse, un bisel
 * lima se despliega en el sentido de las agujas del reloj desde el navbar
 * (data-fusion lo pone navbar.tsx). Titular gigante con letras que se
 * apartan del cursor, el símbolo de la marca (transparente), filas-botón con
 * su nota y una franja donde brotan matas al pasar el ratón. Crédito único:
 * "Created by Fábrica de Software".
 */
export function Footer() {
  const anio = new Date().getFullYear()
  return (
    <footer
      data-pie=""
      data-fusion="no"
      data-nav="bosque"
      data-nav-titulo="Hasta pronto"
      data-seccion-tema="bosque"
      className="pie"
    >
      <div aria-hidden="true" className="pie-cordilleras">
        <svg
          aria-hidden="true"
          data-cordillera="0.5"
          viewBox="0 0 1440 220"
          preserveAspectRatio="none"
          className="pie-cordillera text-pintura-sol"
        >
          <path
            d="M0 220V120c90-40 170-96 280-78s170 70 280 52 190-90 330-84 220 80 330 70 150-44 220-60v190Z"
            fill="currentColor"
          />
        </svg>
        <svg
          aria-hidden="true"
          data-cordillera="0.3"
          viewBox="0 0 1440 220"
          preserveAspectRatio="none"
          className="pie-cordillera text-pintura-terracota"
        >
          <path
            d="M0 220V150c120-30 210-80 330-70s200 66 320 60 200-70 320-74 230 60 330 66 100-20 140-30v118Z"
            fill="currentColor"
          />
        </svg>
        <svg
          data-cordillera="0"
          viewBox="0 0 1440 220"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pie-cordillera text-superficie"
        >
          <path d="M0 220V182c140-26 260-62 400-56s230 44 370 40 240-50 380-52 200 30 290 40v66Z" fill="currentColor" />
        </svg>
      </div>

      <div aria-hidden="true" className="pie-bisel">
        <span data-bisel="arriba" />
        <span data-bisel="derecha" />
        <span data-bisel="abajo" />
        <span data-bisel="izquierda" />
      </div>

      <div className="pie-interior">
        <div data-pie-ranura="" aria-hidden="true" className="pie-ranura" />

        <div className="pie-escenario">
          <div className="pie-titular-bloque">
            <LetrasReactivas texto="Sigamos dando *la* vuelta" className="pie-titular" />
            <p className="pie-cierre">{cierre}</p>
          </div>
          <Image src="/marca/proinserco-simbolo.svg" alt="" width={240} height={240} unoptimized className="pie-simbolo" />
        </div>

        <ul className="pie-filas">
          <li>
            <Link href="/donar" className="pie-fila" data-cursor="Donar">
              <span className="pie-fila-bloque">
                <span className="pie-fila-texto">Donar ahora</span>
                <span className="pie-fila-nota">Pago seguro en la pasarela</span>
              </span>
              <FlechaTrazo grosor={11} className="pie-fila-flecha" />
            </Link>
          </li>
          <li>
            <a
              href={contacto.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Escribir por WhatsApp al ${contacto.telefono}`}
              className="pie-fila"
              data-cursor="WhatsApp"
            >
              <span className="pie-fila-bloque">
                <span className="pie-fila-texto tabular-nums">{contacto.telefono}</span>
                <span className="pie-fila-nota">Escríbenos por WhatsApp, el tinto lo ponemos nosotros</span>
              </span>
              <FlechaTrazo grosor={11} className="pie-fila-flecha" />
            </a>
          </li>
        </ul>

        <div className="pie-columnas">
          <nav aria-label="Secciones del sitio">
            <h2 className="pie-columna-titulo">Explora</h2>
            <ul>
              {ENLACES_SECCION.map((e) => (
                <li key={e.id}>
                  <Link href={`/#${e.id}`} className="pie-enlace">
                    {e.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Legal">
            <h2 className="pie-columna-titulo">Legal</h2>
            <ul>
              {ENLACES_LEGALES.map((e) => (
                <li key={e.href}>
                  <Link href={e.href} className="pie-enlace">
                    {e.etiqueta}
                  </Link>
                </li>
              ))}
              <li>
                <BotonCookies className="pie-enlace pie-enlace-boton" />
              </li>
            </ul>
          </nav>
          <div>
            <h2 className="pie-columna-titulo">Visítanos</h2>
            <address className="pie-direccion">
              {contacto.direccion}
              <br />
              Barrio {contacto.barrio}
              <br />
              {contacto.ciudad}, {contacto.departamento}, {contacto.pais}
            </address>
          </div>
        </div>

        <FranjaSiembra />

        <div className="pie-base">
          <p className="pie-copy">
            <Image src="/marca/proinserco-simbolo.svg" alt="" width={28} height={28} unoptimized className="pie-copy-sello" />©{' '}
            {anio} {organizacion.nombre}. Hecho en el Cauca con cariño y mucho tinto.
          </p>
          <p className="pie-creditos">
            Created by{' '}
            <a href={credito.url} target="_blank" rel="noopener noreferrer" className="pie-credito-enlace">
              Fábrica de Software
            </a>
          </p>
        </div>
      </div>
      <PieVivo />
    </footer>
  )
}
