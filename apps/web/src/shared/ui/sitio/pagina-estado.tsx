import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { CONTENIDO_SITIO } from '@/modules/contenido'
import { FlechaMarca, FlechaTrazo } from './flecha'

type Props = {
  codigo: string
  titulo: string
  texto: string
  /** Acción principal propia (p. ej. "Reintentar"); por defecto, volver al inicio. */
  accion?: ReactNode
  pie?: ReactNode
}

/**
 * 404 y error con el mismo mundo: la cifra gigante con la flecha de la marca
 * en lugar del cero (la vuelta que no salió), mensaje con voz y salidas claras.
 */
export function PaginaEstado({ codigo, titulo, texto, accion, pie }: Props) {
  const { contacto } = CONTENIDO_SITIO
  const [a, , c] = [...codigo]
  return (
    <main data-seccion-tema="bosque" data-nav="bosque" className="estado">
      <FlechaMarca className="estado-flecha-fondo" />
      <div className="relative mx-auto w-full max-w-[64rem]">
        <Link href="/" className="inline-flex min-h-11 items-center gap-3 font-display text-realce font-extrabold uppercase">
          <span className="grid size-11 place-items-center">
            <Image src="/marca/proinserco-simbolo.svg" alt="" width={32} height={32} unoptimized className="size-8" />
          </span>
          Proinserco
        </Link>
        <p aria-hidden="true" className="estado-codigo mega">
          {a}
          <FlechaTrazo grosor={14} className="estado-codigo-flecha" />
          {c}
        </p>
        <h1 className="estado-titulo mega">{titulo}</h1>
        <p className="mt-5 max-w-[34rem] text-realce text-texto-suave">{texto}</p>
        <div className="mt-10 flex flex-wrap gap-3">
          {accion ?? (
            <Link href="/" className="estado-boton boton-juego">
              Volver al inicio
            </Link>
          )}
          <Link href="/donar" data-seccion-tema="lima" className="estado-boton boton-juego">
            Mejor, quiero <span className="font-enfasis normal-case italic">donar</span>
          </Link>
        </div>
        <p className="mt-10 text-pequeno text-texto-suave">
          ¿Necesitas ayuda? Escríbenos por WhatsApp al{' '}
          <a
            href={contacto.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Escribir por WhatsApp al ${contacto.telefono}`}
            className="font-semibold text-texto underline underline-offset-4"
          >
            {contacto.telefono}
          </a>
        </p>
        {pie}
      </div>
    </main>
  )
}
