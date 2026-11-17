import Link from 'next/link'
import { EstadoPanel, Tarjeta } from '@/shared/ui/panel/primitivas'

/**
 * "Sin permiso" y "no existe" se ven IGUAL a propósito: el panel no confirma si un
 * recurso existe a quien no puede verlo (requireActor responde 404 sin el permiso).
 */
export default function NoEncontradoPanel() {
  return (
    <Tarjeta>
      <EstadoPanel
        tono="aviso"
        escena="candado"
        principal
        titulo="Esta puerta no se abre desde aquí"
        descripcion="La página no existe o tu rol no tiene permiso para verla. Si crees que deberías entrar, pídele a quien administra el panel que revise tu rol."
        accion={
          <Link className="pn-boton pn-boton--primario" href="/panel">
            Volver al resumen
          </Link>
        }
      />
    </Tarjeta>
  )
}
