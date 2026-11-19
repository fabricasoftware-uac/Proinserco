import type { Metadata } from 'next'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { CookiesPreferencias } from '@/shared/ui/legal/cookies-preferencias'
import { PlantillaLegal, PorDefinir, type SeccionLegal, TablaLegal } from '@/shared/ui/legal/plantilla-legal'

export const metadata: Metadata = { title: 'Política de cookies' }

const { contacto } = CONTENIDO_SITIO

const secciones: readonly SeccionLegal[] = [
  {
    id: 'que-son',
    titulo: 'Qué son las cookies',
    contenido: (
      <p>
        Son pequeños archivos que el sitio guarda en tu navegador para recordar cosas, como tu decisión sobre cookies o que ya
        iniciaste sesión.
      </p>
    ),
  },
  {
    id: 'hoy',
    titulo: 'Qué usamos hoy',
    contenido: (
      <p>
        Hoy este sitio <strong>solo usa cookies necesarias</strong>. No usamos cookies de analítica, publicidad ni seguimiento. Si
        algún día las añadimos, actualizaremos esta página y te pediremos permiso antes de activarlas.
      </p>
    ),
  },
  {
    id: 'tabla',
    titulo: 'Cookies que existen',
    contenido: (
      <>
        <TablaLegal
          descripcion="Cookies y almacenamiento del sitio"
          cabeceras={['Nombre', 'Proveedor', 'Finalidad', 'Tipo', 'Duración']}
          filas={[
            [
              'proinserco_consentimiento',
              'Propia',
              'Recordar tu elección sobre cookies (con la versión del texto y la fecha)',
              'Necesaria',
              '6 meses',
            ],
            [
              'proinserco_sesion (en HTTPS: __Host-proinserco_sesion)',
              'Propia',
              'Mantener la sesión del equipo de la fundación en el panel. No se crea si solo donas o navegas',
              'Necesaria',
              'Hasta 8 horas (o 30 minutos de inactividad)',
            ],
            [
              'proinserco_mfa (en HTTPS: __Host-proinserco_mfa)',
              'Propia',
              'Completar el segundo factor al iniciar sesión el equipo',
              'Necesaria',
              '5 minutos',
            ],
            [
              'Cloudflare Turnstile',
              'Cloudflare',
              'Verificación anti-bots en el formulario de donación',
              'Necesaria (seguridad)',
              <PorDefinir key="d3">
                confirmar con la documentación de Cloudflare si guarda cookies o almacenamiento local
              </PorDefinir>,
            ],
          ]}
        />
        <p>
          El pago se completa en la página de Openpay, que tiene sus propias cookies y políticas; no las controlamos.{' '}
          <PorDefinir>enlace a la política de cookies de Openpay</PorDefinir>
        </p>
      </>
    ),
  },
  {
    id: 'cambiar',
    titulo: 'Cómo cambiar tu elección',
    contenido: (
      <>
        <p>
          Puedes revisar o cambiar tu decisión cuando quieras. También puedes borrar las cookies desde la configuración de tu
          navegador (las necesarias podrían volver a crearse).
        </p>
        <CookiesPreferencias />
      </>
    ),
  },
  {
    id: 'contacto',
    titulo: 'Contacto',
    contenido: (
      <p>
        Para dudas sobre esta política: {contacto.correo} · {contacto.telefono}.
      </p>
    ),
  },
]

export default function PaginaLegalCookies() {
  return (
    <PlantillaLegal
      titulo="Política de cookies"
      resumen="Qué cookies usa este sitio, para qué y cómo cambiar tu elección."
      secciones={secciones}
      actual="/legal/cookies"
    />
  )
}
