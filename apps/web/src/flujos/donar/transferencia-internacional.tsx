'use client'

import { useState } from 'react'

type Idioma = 'es' | 'en'

type Props = {
  beneficiario: string
  nit: string
  banco: string
  codigoSwift: string
  tipoCuenta: string
  numeroCuenta: string
  direccion: string
  telefono: string
  correoComprobante: string
}

const TEXTOS = {
  es: {
    etiqueta: 'Transferencia internacional · Montos altos',
    titulo: '¿Donas desde el exterior o un monto alto?',
    descripcion:
      'Para donaciones internacionales o aportes de alto valor, realiza una transferencia bancaria internacional (SWIFT) directo a nuestra cuenta oficial en BBVA Colombia sin comisiones de pasarela.',
    copiarTodo: 'Copiar todos los datos',
    copiadoTodo: 'Datos copiados',
    copiar: 'Copiar',
    copiado: 'Copiado',
    campos: {
      beneficiario: 'Beneficiario (Razón social)',
      nit: 'NIT / Tax ID',
      banco: 'Banco beneficiario',
      swift: 'Código SWIFT / BIC',
      tipoCuenta: 'Tipo de cuenta',
      numeroCuenta: 'Número de cuenta',
      direccion: 'Dirección del beneficiario',
      telefono: 'Teléfono',
    },
    tipoCuentaValor: 'Cuenta de Ahorros (Savings Account)',
    pasosTitulo: '¿Qué hacer después de transferir?',
    pasos: [
      'Indica en el concepto de la transferencia: "Donación Fundación Proinserco".',
      'Envía el comprobante SWIFT junto con tu nombre completo (o razón social), documento/Tax ID y correo al correo de confirmación.',
      'Nuestro equipo validará el abono en BBVA y te enviará el comprobante oficial y certificado de donación.',
    ],
    correoEtiqueta: 'Enviar comprobante a:',
  },
  en: {
    etiqueta: 'International Wire · High-Value Donations',
    titulo: 'Donating from abroad or making a large contribution?',
    descripcion:
      'For international donations or high-value contributions, send an international bank wire transfer (SWIFT) directly to our official BBVA Colombia account with no payment gateway fees.',
    copiarTodo: 'Copy all wire details',
    copiadoTodo: 'All details copied',
    copiar: 'Copy',
    copiado: 'Copied',
    campos: {
      beneficiario: 'Beneficiary Name',
      nit: 'Tax ID (NIT)',
      banco: 'Beneficiary Bank',
      swift: 'SWIFT / BIC Code',
      tipoCuenta: 'Account Type',
      numeroCuenta: 'Account Number',
      direccion: 'Beneficiary Address',
      telefono: 'Phone',
    },
    tipoCuentaValor: 'Savings Account (Cuenta de Ahorros)',
    pasosTitulo: 'What to do after sending the wire?',
    pasos: [
      'Include in the transfer reference/memo: "Donation Fundacion Proinserco".',
      'Email the SWIFT transfer receipt along with your full name (or organization), ID/Tax ID, and contact email.',
      'Our team will confirm the deposit with BBVA and send you the official donation receipt and certificate.',
    ],
    correoEtiqueta: 'Send wire receipt to:',
  },
} as const

export function TransferenciaInternacional(props: Props) {
  const [idioma, setIdioma] = useState<Idioma>('es')
  const [copiadoId, setCopiadoId] = useState<string | null>(null)
  const t = TEXTOS[idioma]

  async function copiar(id: string, valor: string) {
    try {
      await navigator.clipboard.writeText(valor)
      setCopiadoId(id)
      window.setTimeout(() => {
        setCopiadoId((actual) => (actual === id ? null : actual))
      }, 2200)
    } catch {
      // Si el navegador bloquea el portapapeles, el usuario puede seleccionar el texto manualmente.
    }
  }

  const filas: ReadonlyArray<{ id: string; etiqueta: string; valor: string; mono?: boolean; copiable?: boolean }> = [
    { id: 'beneficiario', etiqueta: t.campos.beneficiario, valor: props.beneficiario, copiable: true },
    { id: 'nit', etiqueta: t.campos.nit, valor: props.nit, mono: true, copiable: true },
    { id: 'banco', etiqueta: t.campos.banco, valor: props.banco, copiable: true },
    { id: 'swift', etiqueta: t.campos.swift, valor: props.codigoSwift, mono: true, copiable: true },
    { id: 'tipoCuenta', etiqueta: t.campos.tipoCuenta, valor: idioma === 'en' ? t.tipoCuentaValor : props.tipoCuenta },
    { id: 'numeroCuenta', etiqueta: t.campos.numeroCuenta, valor: props.numeroCuenta, mono: true, copiable: true },
    { id: 'direccion', etiqueta: t.campos.direccion, valor: props.direccion },
    { id: 'telefono', etiqueta: t.campos.telefono, valor: props.telefono, mono: true },
  ]

  const resumenTexto = [
    `${t.campos.beneficiario}: ${props.beneficiario}`,
    `${t.campos.nit}: ${props.nit}`,
    `${t.campos.banco}: ${props.banco}`,
    `${t.campos.swift}: ${props.codigoSwift} (${props.codigoSwift}XXX)`,
    `${t.campos.tipoCuenta}: ${idioma === 'en' ? t.tipoCuentaValor : props.tipoCuenta}`,
    `${t.campos.numeroCuenta}: ${props.numeroCuenta}`,
    `${t.campos.direccion}: ${props.direccion}`,
    `${t.campos.telefono}: ${props.telefono}`,
    `${t.correoEtiqueta} ${props.correoComprobante}`,
  ].join('\n')

  return (
    <section
      aria-labelledby="titulo-transferencia-internacional"
      className="mt-10 rounded-tarjeta border border-borde-sutil bg-superficie-elevada p-5 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-borde-sutil pb-5">
        <div className="max-w-2xl space-y-2">
          <p className="text-micro font-semibold uppercase tracking-wide text-texto-suave">{t.etiqueta}</p>
          <h2 id="titulo-transferencia-internacional" className="paso-titulo">
            {t.titulo}
          </h2>
          <p className="text-texto-suave">{t.descripcion}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset
            className="inline-flex rounded-pastilla border border-borde-sutil bg-superficie p-1"
            aria-label="Idioma / Language"
          >
            <button
              type="button"
              onClick={() => setIdioma('es')}
              aria-pressed={idioma === 'es'}
              className={`rounded-pastilla px-3 py-1 text-micro font-semibold transition-colors ${
                idioma === 'es' ? 'bg-acento text-sobre-acento' : 'text-texto-suave hover:text-texto'
              }`}
            >
              Español
            </button>
            <button
              type="button"
              onClick={() => setIdioma('en')}
              aria-pressed={idioma === 'en'}
              className={`rounded-pastilla px-3 py-1 text-micro font-semibold transition-colors ${
                idioma === 'en' ? 'bg-acento text-sobre-acento' : 'text-texto-suave hover:text-texto'
              }`}
            >
              English
            </button>
          </fieldset>
          <button
            type="button"
            onClick={() => copiar('todo', resumenTexto)}
            className="rounded-control border border-borde-sutil bg-superficie px-3.5 py-2 text-micro font-semibold text-texto transition-colors hover:border-acento"
          >
            {copiadoId === 'todo' ? t.copiadoTodo : t.copiarTodo}
          </button>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {filas.map((fila) => (
          <div key={fila.id} className="rounded-control border border-borde-sutil bg-superficie p-4">
            <dt className="text-micro font-semibold text-texto-suave">{fila.etiqueta}</dt>
            <dd className="mt-1 flex items-start justify-between gap-3">
              <span className={fila.mono ? 'font-mono text-realce font-semibold text-texto' : 'font-medium text-texto'}>
                {fila.valor}
              </span>
              {fila.copiable && (
                <button
                  type="button"
                  onClick={() => copiar(fila.id, fila.valor)}
                  className="shrink-0 rounded-pastilla border border-borde-sutil px-2.5 py-0.5 text-micro font-semibold text-texto-suave transition-colors hover:border-acento hover:text-texto"
                >
                  {copiadoId === fila.id ? t.copiado : t.copiar}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-control border border-borde-sutil bg-superficie p-4 sm:p-5">
        <h3 className="font-semibold text-texto">{t.pasosTitulo}</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-texto-suave">
          {t.pasos.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-micro font-semibold text-texto">
          <span className="text-texto-suave">{t.correoEtiqueta}</span>
          <a href={`mailto:${props.correoComprobante}`} className="font-mono underline decoration-acento underline-offset-4">
            {props.correoComprobante}
          </a>
          <button
            type="button"
            onClick={() => copiar('correo', props.correoComprobante)}
            className="rounded-pastilla border border-borde-sutil px-2.5 py-0.5 text-micro font-semibold text-texto-suave transition-colors hover:border-acento hover:text-texto"
          >
            {copiadoId === 'correo' ? t.copiado : t.copiar}
          </button>
        </p>
      </div>
    </section>
  )
}
