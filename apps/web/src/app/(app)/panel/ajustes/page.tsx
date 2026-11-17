import type { Metadata } from 'next'
import { requireActor } from '@/server/auth-context'
import { obtenerContenedor } from '@/server/container'
import { obtenerEnv } from '@/server/env'
import { Aro, Estado } from '@/shared/ui/panel/aro'
import { iniciales } from '@/shared/ui/panel/formato'
import { EncabezadoPagina, Tarjeta } from '@/shared/ui/panel/primitivas'
import { SelectorTema } from '@/shared/ui/tema/selector-tema'

export const metadata: Metadata = { title: 'Ajustes' }

type Integracion = { nombre: string; memoria: string; real: string }

const INTEGRACIONES: readonly Integracion[] = [
  { nombre: 'Base de datos', memoria: 'En memoria: los datos se pierden al reiniciar', real: 'PostgreSQL (Supabase)' },
  { nombre: 'Identidad y segundo factor', memoria: 'Usuarios de demostración con TOTP', real: 'Supabase Auth con MFA' },
  { nombre: 'Pasarela de pagos', memoria: 'Pasarela simulada interna', real: 'Openpay (checkout hospedado)' },
]

/** Perfil, apariencia, seguridad e integraciones (informativo, sin secretos). */
export default async function PaginaAjustes() {
  const actor = await requireActor('ajustes:leer')
  const { modo } = await obtenerContenedor()
  const env = obtenerEnv()
  const esMemoria = modo === 'memoria'

  return (
    <>
      <EncabezadoPagina titulo="Ajustes" descripcion="Tu cuenta, cómo se ve el panel y con qué está conectado." />

      <section className="pn-perfil" aria-label="Tu perfil">
        <span className="pn-avatar" aria-hidden="true">
          {iniciales(actor.nombre)}
        </span>
        <span className="pn-perfil-texto">
          <strong>{actor.nombre}</strong>
          <span>{actor.correo}</span>
        </span>
        <span className="pn-perfil-rol">
          <b>{actor.rol}</b>
          <small>{actor.permisos.length} permisos en tu rol</small>
        </span>
      </section>

      <div className="pn-ajustes">
        <Tarjeta titulo="Seguridad" id="seguridad">
          <ul className="pn-lista-ajustes">
            <li>
              <span>
                <strong>Segundo factor (TOTP)</strong>
                <small>Obligatorio para entrar al panel.</small>
              </span>
              <Estado tono="ok">Activo</Estado>
            </li>
            <li>
              <span>
                <strong>Nivel de sesión</strong>
                <small>Contraseña y código verificados en el servidor.</small>
              </span>
              <Estado tono="ok">{actor.nivel === 'aal2' ? 'AAL2' : actor.nivel}</Estado>
            </li>
            <li>
              <span>
                <strong>Sesiones abiertas</strong>
                <small>El proveedor de identidad actual no expone la lista de sesiones ni su expiración.</small>
              </span>
              <Estado tono="neutro" forma="punteado">
                No disponible
              </Estado>
            </li>
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Apariencia" nota="Se guarda en este navegador. «Sistema» sigue a tu dispositivo." id="apariencia">
          <SelectorTema />
        </Tarjeta>

        <Tarjeta
          titulo="Integraciones"
          nota="Informativo: aquí nunca se muestran claves ni secretos."
          id="integraciones"
          className="pn-ajustes-ancho"
          acciones={<Estado tono={esMemoria ? 'aviso' : 'ok'}>{esMemoria ? 'Modo demostración' : 'Modo real'}</Estado>}
        >
          {esMemoria ? (
            <p className="pn-aviso pn-tono-aviso" style={{ marginBottom: '1rem' }}>
              <Aro forma="marca" tamano={18} />
              <span>
                Los adaptadores están en memoria: los datos son ficticios y no se conservan. No es un entorno de producción.
              </span>
            </p>
          ) : null}
          <ul className="pn-lista-ajustes">
            {INTEGRACIONES.map((i) => (
              <li key={i.nombre}>
                <span>
                  <strong>{i.nombre}</strong>
                  <small>{esMemoria ? i.memoria : i.real}</small>
                </span>
                <Estado tono={esMemoria ? 'aviso' : 'ok'}>{esMemoria ? 'Memoria' : 'Real'}</Estado>
              </li>
            ))}
            <li>
              <span>
                <strong>Anti-bots</strong>
                <small>
                  {env.antibots === 'turnstile' ? 'Cloudflare Turnstile' : 'Verificador en memoria (acepta cualquier token)'}
                </small>
              </span>
              <Estado tono={env.antibots === 'turnstile' ? 'ok' : 'aviso'}>
                {env.antibots === 'turnstile' ? 'Turnstile' : 'Memoria'}
              </Estado>
            </li>
            <li>
              <span>
                <strong>Límite de peticiones</strong>
                <small>{env.LIMITADOR_URL ? 'Compartido entre instancias' : 'En memoria: válido con una sola instancia'}</small>
              </span>
              <Estado tono={env.LIMITADOR_URL ? 'ok' : 'aviso'}>{env.LIMITADOR_URL ? 'Redis' : 'Memoria'}</Estado>
            </li>
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Lo que tu rol puede hacer" id="permisos" plana className="pn-ajustes-ancho">
          <ul className="pn-permisos" aria-label="Permisos de tu rol">
            {actor.permisos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </>
  )
}
