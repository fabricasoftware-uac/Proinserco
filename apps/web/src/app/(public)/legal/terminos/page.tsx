import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { PlantillaLegal, PorDefinir, type SeccionLegal } from '@/shared/ui/legal/plantilla-legal'

export const metadata: Metadata = { title: 'Términos y condiciones' }

const { organizacion, contacto } = CONTENIDO_SITIO

const secciones: readonly SeccionLegal[] = [
  {
    id: 'quienes',
    titulo: 'Quiénes somos',
    contenido: (
      <p>
        Este sitio es de la {organizacion.nombre} ({organizacion.razonSocial}, NIT {organizacion.nit}), fundación sin ánimo de
        lucro con domicilio en {contacto.direccion}, barrio {contacto.barrio}, {contacto.ciudad}, {contacto.departamento},{' '}
        {contacto.pais}. Al usarlo aceptas estos términos.
      </p>
    ),
  },
  {
    id: 'uso',
    titulo: 'Uso del sitio',
    contenido: (
      <ul>
        <li>Puedes navegar y consultar el sitio libremente.</li>
        <li>No puedes usarlo para fines ilícitos, intentar vulnerar su seguridad ni automatizar el formulario de donación.</li>
        <li>
          Los textos, logos e imágenes pertenecen a la fundación o a sus titulares y no puedes reutilizarlos sin permiso.{' '}
          <PorDefinir>créditos y licencias de imágenes, cuando el cliente entregue las definitivas</PorDefinir>
        </li>
      </ul>
    ),
  },
  {
    id: 'donaciones',
    titulo: 'Donaciones',
    contenido: (
      <p>
        Las donaciones se rigen por la <Link href="/legal/donaciones">Política de donaciones</Link>: son voluntarias y se pagan en
        la página segura de Openpay.
      </p>
    ),
  },
  {
    id: 'datos',
    titulo: 'Datos personales y cookies',
    contenido: (
      <p>
        Tratamos tus datos según la <Link href="/legal/tratamiento-de-datos">Política de tratamiento de datos</Link> y usamos
        cookies según la <Link href="/legal/cookies">Política de cookies</Link>.
      </p>
    ),
  },
  {
    id: 'responsabilidad',
    titulo: 'Disponibilidad y responsabilidad',
    contenido: (
      <p>
        Procuramos que el sitio esté disponible, pero puede haber interrupciones por mantenimiento o fallas de terceros (hosting,
        pasarela, conexión). La fundación no responde por daños derivados de esas interrupciones en la medida que la ley lo
        permita. <PorDefinir>alcance exacto de la limitación de responsabilidad, a validar con el abogado</PorDefinir>
      </p>
    ),
  },
  {
    id: 'enlaces',
    titulo: 'Enlaces a terceros',
    contenido: (
      <p>
        El sitio puede enlazar a páginas de terceros (como la pasarela de pagos). Sus contenidos y políticas son responsabilidad
        de ellos.
      </p>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios y ley aplicable',
    contenido: (
      <p>
        Podemos actualizar estos términos; la versión vigente es la publicada aquí. Se rigen por las leyes de Colombia.{' '}
        <PorDefinir>fuero y jurisdicción competente, a validar con el abogado</PorDefinir>
      </p>
    ),
  },
  {
    id: 'contacto',
    titulo: 'Contacto',
    contenido: (
      <p>
        Teléfono {contacto.telefono} · Correo {contacto.correo} · Dirección: {contacto.direccion}, barrio {contacto.barrio},{' '}
        {contacto.ciudad}, {contacto.departamento}
      </p>
    ),
  },
]

export default function PaginaTerminos() {
  return (
    <PlantillaLegal
      titulo="Términos y condiciones"
      resumen="Las reglas básicas para usar este sitio."
      secciones={secciones}
      actual="/legal/terminos"
    />
  )
}
