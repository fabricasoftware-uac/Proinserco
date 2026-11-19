import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { PlantillaLegal, type SeccionLegal } from '@/shared/ui/legal/plantilla-legal'

export const metadata: Metadata = { title: 'Aviso de privacidad' }

const { organizacion, contacto } = CONTENIDO_SITIO

const secciones: readonly SeccionLegal[] = [
  {
    id: 'quien',
    titulo: 'Quién trata tus datos',
    contenido: (
      <p>
        La {organizacion.nombre} ({organizacion.razonSocial}, NIT {organizacion.nit}), con domicilio en {contacto.direccion},
        barrio {contacto.barrio}, {contacto.ciudad}, {contacto.departamento}, es responsable del tratamiento de los datos
        personales que nos entregas en este sitio.
      </p>
    ),
  },
  {
    id: 'para-que',
    titulo: 'Para qué los usamos',
    contenido: (
      <ul>
        <li>Gestionar tu donación y enviarte el comprobante.</li>
        <li>Expedir el certificado de donación, si lo pides y es posible.</li>
        <li>Contactarte sobre tu donación.</li>
        <li>Cumplir obligaciones legales y tributarias.</li>
      </ul>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos y cómo ejercerlos',
    contenido: (
      <p>
        Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar tu autorización, escribiendo a {contacto.correo} o
        llamando al {contacto.telefono}.
      </p>
    ),
  },
  {
    id: 'sensibles',
    titulo: 'Datos sensibles',
    contenido: (
      <p>
        No recogemos datos sensibles. Nunca pedimos ni guardamos datos de tarjeta: el pago se hace en la página segura de Openpay.
      </p>
    ),
  },
  {
    id: 'politica',
    titulo: 'Política completa',
    contenido: (
      <p>
        Encuentra todos los detalles (encargados, conservación, procedimiento y plazos) en la{' '}
        <Link href="/legal/tratamiento-de-datos">Política de tratamiento de datos personales</Link>.
      </p>
    ),
  },
]

export default function PaginaAvisoDePrivacidad() {
  return (
    <PlantillaLegal
      titulo="Aviso de privacidad"
      resumen="La versión corta: quién usa tus datos, para qué y cómo ejercer tus derechos."
      secciones={secciones}
      actual="/legal/aviso-de-privacidad"
    />
  )
}
