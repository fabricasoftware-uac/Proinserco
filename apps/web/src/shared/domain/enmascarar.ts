/**
 * Enmascarado de datos personales para el panel: por defecto se muestran
 * así y el dato completo solo viaja tras "Mostrar" (acción auditada).
 */
export function enmascararCorreo(correo: string): string {
  const [usuario = '', dominio = ''] = correo.split('@')
  if (!dominio) return '•••'
  const visible = usuario.slice(0, 1)
  return `${visible}•••@${dominio}`
}

/** Deja visibles los últimos 4 caracteres: `•••• 4821`. */
export function enmascararFinal(valor: string, visibles = 4): string {
  const limpio = valor.replace(/\s+/g, '')
  if (limpio.length <= visibles) return '••••'
  return `•••• ${limpio.slice(-visibles)}`
}
