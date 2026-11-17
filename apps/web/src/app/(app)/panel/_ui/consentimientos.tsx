import type { DonanteDetalleVM } from '@/modules/donantes'
import { Estado } from '@/shared/ui/panel/aro'
import { Fecha } from '@/shared/ui/panel/datos'

const FINALIDAD: Readonly<Record<DonanteDetalleVM['consentimientos'][number]['finalidad'], string>> = {
  gestion_donacion: 'Gestión de la donación',
  certificado_donacion: 'Certificado de donación',
  boletin: 'Boletín informativo',
}

/** Autorizaciones de tratamiento de datos: finalidad, versión del texto legal mostrado y fecha. */
export function ListaConsentimientos({ items }: { items: DonanteDetalleVM['consentimientos'] }) {
  if (items.length === 0) return <p className="pn-tarjeta-nota">No hay autorizaciones registradas.</p>
  return (
    <ul className="pn-lista-ajustes">
      {items.map((c) => (
        <li key={`${c.finalidad}-${c.creadoEn}-${c.versionTexto}`}>
          <span>
            <strong>{FINALIDAD[c.finalidad]}</strong>
            <small>
              Texto <span className="pn-mono">{c.versionTexto}</span> · <Fecha iso={c.creadoEn} variante="linea" />
            </small>
          </span>
          {c.otorgada ? (
            <Estado tono="ok">Autorizada</Estado>
          ) : (
            <Estado tono="neutro" forma="roto">
              Revocada
            </Estado>
          )}
        </li>
      ))}
    </ul>
  )
}
