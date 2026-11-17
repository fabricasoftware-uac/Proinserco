import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { RutaSiguiente } from '@/modules/iam'
import { obtenerActor } from '@/server/auth-context'
import { Icono } from '@/shared/ui/panel/iconos'
import { SelectorTema } from '@/shared/ui/tema/selector-tema'
import { usuariosDemo } from './demo'
import { FormularioAcceso } from './formulario-acceso'

export const metadata: Metadata = { title: 'Acceso al panel' }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** La flecha circular de la marca, a gran escala: se dibuja una vez y gira muy despacio. */
function AroMarca() {
  return (
    <div className="pn-acceso-aro" aria-hidden="true">
      <svg viewBox="0 0 400 400" focusable="false" aria-hidden="true">
        <circle className="pn-acceso-aro-eco" cx="200" cy="200" r="190" />
        <circle className="pn-acceso-aro-eco" cx="200" cy="200" r="118" />
        <g className="pn-acceso-aro-giro">
          <path className="pn-acceso-aro-trazo" d="M200 46a154 154 0 1 1-133.4 77" pathLength="600" />
          <path className="pn-acceso-aro-punta" d="M79 101.5L44.5 117.2L82.6 139.2Z" />
        </g>
      </svg>
    </div>
  )
}

/**
 * Login + segundo factor (TOTP). Si ya hay sesión válida con MFA, va directo al panel.
 * La caja de demostración la decide el servidor: `usuariosDemo()` devuelve null salvo en
 * modo memoria fuera de producción, así que en producción nunca llega al navegador.
 */
export default async function PaginaAcceso({ searchParams }: Props) {
  const consulta = await searchParams
  const bruto = Array.isArray(consulta.siguiente) ? consulta.siguiente[0] : consulta.siguiente
  // Solo rutas internas del panel: nada de redirecciones abiertas.
  const siguiente = RutaSiguiente.parse(bruto)

  if (await obtenerActor()) redirect(siguiente)

  const demo = await usuariosDemo()

  return (
    <main className="pn-acceso">
      <section className="pn-acceso-marca" aria-label="Fundación Proinserco">
        <div className="pn-acceso-marca-cab">
          {/* biome-ignore lint/performance/noImgElement: logo vectorial estático */}
          <img src="/marca/proinserco-simbolo.svg" alt="" width={44} height={44} />
          Proinserco
        </div>
        <p className="pn-acceso-lema">
          Lo que entra aquí <em>vuelve</em> a la comunidad.
        </p>
        <div className="pn-acceso-margen">
          <span>Panel de la fundación · acceso del equipo</span>
          <span>Popayán, Cauca</span>
        </div>
        <AroMarca />
      </section>

      <div className="pn-acceso-zona">
        <div className="pn-acceso-tema">
          <SelectorTema />
        </div>
        <div className="pn-acceso-caja">
          <h1>Entra al panel</h1>
          <p className="pn-acceso-sub">Con tu correo, tu contraseña y el código de tu app autenticadora.</p>
          <FormularioAcceso siguiente={siguiente} demo={demo} />
          <p className="pn-acceso-pie">
            <Link href="/">
              <Icono nombre="flecha-izq" tamano={15} />
              Volver al sitio
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
