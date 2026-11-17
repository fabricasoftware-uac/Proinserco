import { NoImplementado } from '@/shared/domain/errores'
import type { RegistroConsentimientos } from '../application/ports/registro-consentimientos'
import type { RepositorioDonantes } from '../application/ports/repositorio-donantes'

const pendiente = (que: string) => async (): Promise<never> => {
  throw new NoImplementado(que)
}

/**
 * ESQUELETO — Donantes en Supabase Postgres (Drizzle).
 *
 * SALOMÓN:
 *  - Tabla `donantes` con UNIQUE (tipo_documento, numero_documento). RLS activado y
 *    forzado; lectura del panel con `conActor()` + `SET LOCAL`.
 *  - Datos para el certificado de donación en tabla separada de acceso restringido
 *    (vault: Privacidad y Habeas Data → "Sitios que reciben donaciones").
 *  - Documento y celular son datos personales: valorar cifrado a nivel de columna
 *    (pgcrypto) y nunca registrarlos en logs.
 *  - Búsqueda `q`: longitud mínima 2 y máxima 100 ya validadas; usar índice trigram o
 *    búsqueda por prefijo, nunca `ILIKE '%x%'` sin índice.
 *  - Supresión (derecho del titular): anonimizar, conservando bloqueado lo que la norma
 *    contable obliga a guardar (validar plazos con el contador).
 */
export function crearRepositorioDonantesPostgres(): RepositorioDonantes {
  return {
    guardar: pendiente('RepositorioDonantes.guardar'),
    buscarPorId: pendiente('RepositorioDonantes.buscarPorId'),
    buscarPorDocumento: pendiente('RepositorioDonantes.buscarPorDocumento'),
    listar: pendiente('RepositorioDonantes.listar'),
    contar: pendiente('RepositorioDonantes.contar'),
  }
}

/**
 * ESQUELETO — Registro de autorizaciones (`autorizaciones_datos`).
 *
 * SALOMÓN:
 *  - SOLO INSERT. Política RLS sin UPDATE ni DELETE para ningún rol de la app, ni
 *    siquiera administradores: la prueba no puede depender de una fila editable.
 *  - Columnas: donante_id, email, finalidad, version_texto, otorgada, ip inet,
 *    user_agent, creado_en. La revocación es otra fila con otorgada = false.
 */
export function crearRegistroConsentimientosPostgres(): RegistroConsentimientos {
  return {
    insertar: pendiente('RegistroConsentimientos.insertar'),
    listarPorDonante: pendiente('RegistroConsentimientos.listarPorDonante'),
  }
}
