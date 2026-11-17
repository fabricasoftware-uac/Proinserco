import type { Metadata } from 'next'
import Link from 'next/link'
import { PlantillaLegal, PorDefinir, type SeccionLegal } from '@/shared/ui/legal/plantilla-legal'

export const metadata: Metadata = { title: 'Política de donaciones' }

const secciones: readonly SeccionLegal[] = [
  {
    id: 'voluntaria',
    titulo: 'Carácter voluntario',
    contenido: (
      <p>
        Toda donación es voluntaria, libre y sin contraprestación. Tú decides si donas y cuánto, dentro de los límites que indica
        el formulario.
      </p>
    ),
  },
  {
    id: 'destino',
    titulo: 'Destino de los fondos',
    contenido: (
      <p>
        Los aportes apoyan los proyectos comunitarios de la fundación. Puedes indicar una línea de apoyo (educación, salud,
        agrícola o donde más se necesite).{' '}
        <PorDefinir>confirmar con la fundación el destino y la política de uso de los fondos</PorDefinir>
      </p>
    ),
  },
  {
    id: 'medios',
    titulo: 'Medios de pago',
    contenido: (
      <>
        <p>
          El pago se hace en la página segura de Openpay, no en este sitio. Los medios disponibles son los que Openpay habilite:{' '}
          <PorDefinir>medios de pago habilitados en la cuenta de la fundación</PorDefinir>.
        </p>
        <p>Nunca te pedimos ni guardamos datos de tarjeta. El monto se valida en nuestro servidor antes de enviarte al pago.</p>
      </>
    ),
  },
  {
    id: 'comprobantes',
    titulo: 'Comprobantes y certificado',
    contenido: (
      <>
        <p>
          Cuando el pago se aprueba, te enviamos un comprobante al correo que indicaste. Si marcaste la casilla de certificado, la
          fundación lo tramitará con tus datos.
        </p>
        <p>
          La expedición del certificado y sus efectos tributarios dependen del régimen tributario de la fundación.{' '}
          <PorDefinir>
            régimen tributario y calificación en el Régimen Tributario Especial, por confirmar con el contador
          </PorDefinir>
        </p>
      </>
    ),
  },
  {
    id: 'estados',
    titulo: 'Qué pasa con tu pago',
    contenido: (
      <ul>
        <li>Aprobada: la donación queda registrada.</li>
        <li>Pendiente: el banco aún no confirma; no repitas el pago, escríbenos con la referencia.</li>
        <li>Rechazada: no se cobra; puedes intentarlo de nuevo.</li>
      </ul>
    ),
  },
  {
    id: 'correcciones',
    titulo: 'Correcciones y reversiones',
    contenido: (
      <p>
        Si te equivocaste de monto, cobramos dos veces o tus datos del certificado están mal, escríbenos pronto a{' '}
        <PorDefinir>correo oficial de la fundación</PorDefinir> o llama al +57 300 651 8013, con tu referencia. Estudiaremos cada
        caso; las devoluciones se hacen por el mismo medio de pago.{' '}
        <PorDefinir>plazo y condiciones para solicitar una reversión, a definir con la fundación y el abogado</PorDefinir>
      </p>
    ),
  },
  {
    id: 'datos',
    titulo: 'Tus datos',
    contenido: (
      <p>
        Cómo tratamos tus datos está en la <Link href="/legal/tratamiento-de-datos">Política de tratamiento de datos</Link>.
      </p>
    ),
  },
]

export default function PaginaPoliticaDonaciones() {
  return (
    <PlantillaLegal
      titulo="Política de donaciones"
      resumen="Cómo funcionan las donaciones: pago, comprobantes, certificado y correcciones."
      secciones={secciones}
      actual="/legal/donaciones"
    />
  )
}
