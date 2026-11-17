import type { Metadata } from 'next'
import Link from 'next/link'
import { PlantillaLegal, PorDefinir, type SeccionLegal } from '@/shared/ui/legal/plantilla-legal'

export const metadata: Metadata = { title: 'Aviso de privacidad' }

const secciones: readonly SeccionLegal[] = [
  {
    id: 'quien',
    titulo: 'Quién trata tus datos',
    contenido: (
      <p>
        La Fundación Proinserco (<PorDefinir>razón social y NIT</PorDefinir>), con domicilio en Calle 55 CN # 9B-66, barrio Santa
        Lucía, Popayán, Cauca, es responsable del tratamiento de los datos personales que nos entregas en este sitio.
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
        Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar tu autorización, escribiendo a{' '}
        <PorDefinir>correo oficial de la fundación</PorDefinir> o llamando al +57 300 651 8013.
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
