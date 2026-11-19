import type { Metadata } from 'next'
import Link from 'next/link'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { DatosResponsable, PlantillaLegal, PorDefinir, type SeccionLegal, TablaLegal } from '@/shared/ui/legal/plantilla-legal'

export const metadata: Metadata = { title: 'Política de tratamiento de datos personales' }

const { contacto } = CONTENIDO_SITIO

const secciones: readonly SeccionLegal[] = [
  { id: 'responsable', titulo: 'Responsable del tratamiento', contenido: <DatosResponsable /> },
  {
    id: 'marco',
    titulo: 'Marco normativo',
    contenido: (
      <p>
        Esta política se basa en la Ley 1581 de 2012 y sus normas reglamentarias (compiladas en el Decreto 1074 de 2015). La
        autoridad de control es la Superintendencia de Industria y Comercio (SIC).{' '}
        <PorDefinir>normas adicionales que indique el abogado de la fundación</PorDefinir>
      </p>
    ),
  },
  {
    id: 'datos',
    titulo: 'Datos que recogemos',
    contenido: (
      <>
        <p>
          Solo pedimos lo necesario para recibir y soportar tu donación. No recogemos datos sensibles ni de menores de edad. Nunca
          recibimos datos de tarjeta: el pago ocurre en la página de la pasarela.
        </p>
        <TablaLegal
          descripcion="Datos personales que se recogen al donar"
          cabeceras={['Categoría', 'Datos', 'Origen']}
          filas={[
            ['Identificación', 'Nombres, apellidos, tipo y número de documento', 'Formulario de donación'],
            ['Contacto', 'Correo electrónico y celular', 'Formulario de donación'],
            [
              'Donación',
              'Monto, línea de apoyo, referencia, estado del pago, si pediste certificado',
              'Formulario y pasarela de pagos',
            ],
            ['Técnicos', 'Dirección IP y navegador (para seguridad y prueba de la autorización)', 'Se generan al usar el sitio'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'finalidades',
    titulo: 'Finalidades del tratamiento',
    contenido: (
      <ul>
        <li>Gestionar tu donación: crear el registro, enviarte al pago, confirmar su resultado y enviarte el comprobante.</li>
        <li>Expedir el certificado de donación, si lo solicitas y si la fundación puede expedirlo.</li>
        <li>Contactarte sobre tu donación (por ejemplo, si el pago queda pendiente o rechazado).</li>
        <li>Cumplir obligaciones legales, contables y tributarias, y proteger el sitio contra fraude y abusos.</li>
        <li>Conservar la prueba de tu autorización.</li>
      </ul>
    ),
  },
  {
    id: 'sensibles',
    titulo: 'Datos sensibles y de menores',
    contenido: (
      <p>
        No recogemos datos sensibles ni datos de niños, niñas o adolescentes. Si crees que alguien menor de edad nos entregó
        datos, escríbenos para suprimirlos.
      </p>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos',
    contenido: (
      <>
        <p>Como titular puedes, en cualquier momento:</p>
        <ul>
          <li>Conocer, actualizar y rectificar tus datos.</li>
          <li>Solicitar prueba de la autorización que nos diste.</li>
          <li>Ser informado del uso que se ha dado a tus datos.</li>
          <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
          <li>
            Revocar la autorización y solicitar la supresión de tus datos, salvo cuando la ley nos obligue a conservarlos (por
            ejemplo, soportes contables).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'procedimiento',
    titulo: 'Cómo ejercer tus derechos',
    contenido: (
      <>
        <p>
          Escribe a {contacto.correo} o llama al {contacto.telefono}, indicando tu nombre, documento, qué quieres (consulta,
          corrección, supresión o revocación) y dónde responderte. Podemos pedirte confirmar tu identidad.
        </p>
        <ul>
          <li>Consultas: respuesta en un máximo de 10 días hábiles (prorrogable, avisándote el motivo).</li>
          <li>Reclamos: respuesta en un máximo de 15 días hábiles (prorrogable, avisándote el motivo).</li>
        </ul>
        <p>
          <PorDefinir>confirmación de plazos y procedimiento por el abogado</PorDefinir>
        </p>
      </>
    ),
  },
  {
    id: 'encargados',
    titulo: 'Encargados y transferencia internacional',
    contenido: (
      <>
        <p>Para operar el sitio, algunos proveedores tratan datos por cuenta de la fundación, bajo sus términos de servicio:</p>
        <TablaLegal
          descripcion="Encargados del tratamiento"
          cabeceras={['Encargado', 'Servicio', 'País']}
          filas={[
            [
              'Openpay',
              'Pasarela de pagos (procesa el pago; recibe los datos que necesite para cobrar)',
              <PorDefinir key="p1">país de procesamiento, según contrato</PorDefinir>,
            ],
            [
              'Proveedor de hosting y base de datos',
              'Alojamiento del sitio y almacenamiento',
              <PorDefinir key="p2">proveedor y país</PorDefinir>,
            ],
            [
              'Cloudflare',
              'Protección contra ataques y verificación anti-bots (Turnstile)',
              <PorDefinir key="p3">país, según contrato</PorDefinir>,
            ],
            ['Proveedor de correo', 'Envío de comprobantes', <PorDefinir key="p4">proveedor y país</PorDefinir>],
          ]}
        />
        <p>
          Si alguno de estos proveedores trata datos fuera de Colombia, habrá transferencia o transmisión internacional. La
          fundación la realizará conforme a la ley, con contratos que exijan un nivel adecuado de protección.{' '}
          <PorDefinir>países de destino y fundamento legal, a validar con el abogado</PorDefinir>
        </p>
      </>
    ),
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    contenido: (
      <p>
        Usamos conexión cifrada, acceso restringido y con segundo factor para el equipo, registro de acciones sobre los datos y
        límites contra abusos. Ninguna medida es infalible; si ocurre un incidente que te afecte, actuaremos conforme a la ley.
      </p>
    ),
  },
  {
    id: 'conservacion',
    titulo: 'Conservación',
    contenido: (
      <p>
        Conservamos tus datos mientras exista la relación de donación y el tiempo que exijan las normas contables, tributarias y
        de prescripción. Al vencer, los suprimimos o anonimizamos.{' '}
        <PorDefinir>plazos exactos, a definir con el contador y el abogado</PorDefinir>
      </p>
    ),
  },
  {
    id: 'vigencia',
    titulo: 'Vigencia y cambios',
    contenido: (
      <p>
        Esta política rige desde su publicación. Si cambia de forma sustancial, te lo comunicaremos y, si cambian las finalidades,
        te pediremos una nueva autorización. Lee también el <Link href="/legal/aviso-de-privacidad">Aviso de privacidad</Link> y
        la <Link href="/legal/cookies">Política de cookies</Link>.
      </p>
    ),
  },
]

export default function PaginaTratamientoDeDatos() {
  return (
    <PlantillaLegal
      titulo="Política de tratamiento de datos personales"
      resumen="Qué datos tuyos usamos cuando donas, para qué, con quién los compartimos y cómo ejercer tus derechos."
      secciones={secciones}
      actual="/legal/tratamiento-de-datos"
    />
  )
}
