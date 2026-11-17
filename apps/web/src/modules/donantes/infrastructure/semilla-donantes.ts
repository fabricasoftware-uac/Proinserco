/*
 * ════════════════════════════════════════════════════════════════════════
 *  DATOS DE DEMOSTRACIÓN — PERSONAS FICTICIAS. Nombres combinados al azar,
 *  correos en el dominio reservado `.test`, documentos y celulares
 *  inventados. Solo se cargan con ADAPTADORES=memoria.
 * ════════════════════════════════════════════════════════════════════════
 */
import type { AleatorioDeterminista } from '@/shared/infrastructure/aleatorio-determinista'
import type { RegistroConsentimientos } from '../application/ports/registro-consentimientos'
import type { RepositorioDonantes } from '../application/ports/repositorio-donantes'
import type { Donante, DonanteId, TipoDocumento } from '../domain/donante'

const NOMBRES = [
  'Ana María',
  'Carlos Andrés',
  'Luz Dary',
  'Juan Pablo',
  'Diana Marcela',
  'Andrés Felipe',
  'Paola Andrea',
  'Jhon Fredy',
  'Claudia Patricia',
  'Santiago',
  'Valentina',
  'Hernán',
  'Yolanda',
  'Camilo',
  'Natalia',
  'Óscar Iván',
  'Marisol',
  'Felipe',
  'Liliana',
  'Sebastián',
  'Gloria Inés',
  'Mauricio',
  'Laura Sofía',
  'Édgar',
  'Carolina',
] as const

const APELLIDOS = [
  'Muñoz Ortega',
  'Bolaños Ruiz',
  'Gómez Chicangana',
  'Paz Hurtado',
  'Velasco Idrobo',
  'Cerón Rengifo',
  'Ordóñez Sánchez',
  'Campo Mosquera',
  'Fernández Quilindo',
  'Hoyos Caicedo',
  'Zúñiga Daza',
  'Arboleda Lasso',
  'Martínez Collazos',
  'Rivera Pino',
  'Guzmán Tróchez',
  'López Erazo',
  'Castro Delgado',
  'Vivas Ledezma',
  'Narváez Pérez',
  'Mosquera Anacona',
  'Burbano Patiño',
  'Salazar Urbano',
  'Ijají Muelas',
  'Calambás Tunubalá',
  'Ruiz Garcés',
] as const

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const VERSION_POLITICA_DEMO = 'borrador-2026-11-16'

export async function sembrarDonantes(deps: {
  repositorio: RepositorioDonantes
  consentimientos: RegistroConsentimientos
  aleatorio: AleatorioDeterminista
  ahora: Date
}): Promise<readonly Donante[]> {
  const { aleatorio } = deps
  const donantes: Donante[] = []
  for (const [i, nombres] of NOMBRES.entries()) {
    const apellidos = APELLIDOS[i] ?? 'Demo'
    const creadoEn = new Date(deps.ahora.getTime() - aleatorio.entero(1, 120) * 86_400_000)
    const tipoDocumento: TipoDocumento = i === 7 ? 'CE' : i === 19 ? 'PPT' : 'CC'
    const usuario = `${sinTildes(nombres).split(' ')[0]}.${sinTildes(apellidos).split(' ')[0]}`
    const quiereCertificado = aleatorio.siguiente() < 0.4
    const donante: Donante = {
      id: `00000000-0000-4000-a000-${String(i + 1).padStart(12, '0')}` as DonanteId,
      nombres,
      apellidos,
      tipoDocumento,
      numeroDocumento: aleatorio.digitos(tipoDocumento === 'CC' ? 10 : 7),
      correo: `${usuario}@correo-demo.test`,
      celular: `+573${aleatorio.digitos(9)}`,
      quiereCertificado,
      creadoEn,
      actualizadoEn: creadoEn,
    }
    await deps.repositorio.guardar(donante)
    const base = {
      donanteId: donante.id,
      correo: donante.correo,
      versionTexto: VERSION_POLITICA_DEMO,
      otorgada: true,
      ip: null,
      userAgent: null,
      creadoEn,
    }
    await deps.consentimientos.insertar({ ...base, id: `${donante.id}-gd`, finalidad: 'gestion_donacion' })
    if (quiereCertificado) {
      await deps.consentimientos.insertar({ ...base, id: `${donante.id}-cd`, finalidad: 'certificado_donacion' })
    }
    donantes.push(donante)
  }
  return donantes
}
