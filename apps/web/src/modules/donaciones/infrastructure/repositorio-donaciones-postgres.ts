import { NoImplementado } from '@/shared/domain/errores'
import type { RepositorioDonaciones } from '../application/ports/repositorio-donaciones'

/**
 * ESQUELETO — Repositorio de donaciones sobre Supabase Postgres con Drizzle.
 *
 * SALOMÓN:
 *  - Tabla `donaciones`: id uuid PK, referencia text UNIQUE NOT NULL, clave_idempotencia
 *    text UNIQUE NOT NULL, estado text CHECK (estado IN ('creada','pendiente','aprobada',
 *    'rechazada','expirada','reembolsada','contracargo')), importe_centavos bigint CHECK > 0,
 *    moneda char(3), linea text, donante_id uuid FK, pagador_* (instantánea), quiere_certificado,
 *    id_cargo text UNIQUE, url_pago text, metodo_pago text, creada_en, actualizada_en.
 *    Tabla `donaciones_transiciones` (solo INSERT) para el historial.
 *  - RLS ACTIVADO y FORZADO; denegar por defecto. El panel lee con `conActor()` y
 *    `SET LOCAL` (nunca `SET`). La inserción pública la hace el servidor con un rol
 *    de mínimo privilegio, nunca el cliente admin dentro de una petición de usuario.
 *  - `actualizarSiEstado`: `UPDATE … WHERE id = $1 AND estado = $2` y devolver
 *    `rowCount === 1`. Es lo que impide que dos webhooks simultáneos apliquen dos veces.
 *  - `listar`: paginación por cursor `(creada_en, id) < ($1, $2)`, nunca OFFSET; filtros
 *    solo desde `FiltrosDonaciones` (lista blanca), parametrizados. Búsqueda por correo
 *    con índice trigram o igualdad, no `ILIKE '%x%'` sin índice.
 *  - Mappers aDominio/aPersistencia obligatorios (Donacion.reconstruir).
 *  - Importes `bigint` ↔ `bigint` de JS: configurar el driver para no perder precisión.
 */
export function crearRepositorioDonacionesPostgres(): RepositorioDonaciones {
  const pendiente = (metodo: string) => async (): Promise<never> => {
    throw new NoImplementado(`RepositorioDonaciones.${metodo} (Postgres)`)
  }
  return {
    insertar: pendiente('insertar'),
    actualizarSiEstado: pendiente('actualizarSiEstado'),
    buscarPorId: pendiente('buscarPorId'),
    buscarPorReferencia: pendiente('buscarPorReferencia'),
    buscarPorIdCargo: pendiente('buscarPorIdCargo'),
    buscarPorClaveIdempotencia: pendiente('buscarPorClaveIdempotencia'),
    listar: pendiente('listar'),
    listarDesde: pendiente('listarDesde'),
  }
}
