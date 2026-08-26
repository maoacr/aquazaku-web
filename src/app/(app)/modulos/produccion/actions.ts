'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError } from '@/lib/form-errors'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

/**
 * Mutaciones de producción — M4.
 *
 * Pasan por `apiServerFetchRaw` porque acá los status de error son estados
 * normales de pantalla: un 422 `INSUMOS_INSUFICIENTES` es un mensaje que quien
 * cierra el día tiene que leer y actuar en consecuencia, no un error boundary.
 *
 * Ninguna decide permisos. `api/` valida con `requirePermission` en cada
 * endpoint (RN-ACC-02). Que el `pos` vea el formulario de ajuste y reciba un
 * 403 al enviarlo es aceptable; lo que no lo sería es que el 403 no explicara
 * nada.
 */

const RUTA = '/modulos/produccion'

/**
 * Traduce un fallo de `api/` a algo accionable.
 *
 * Los mensajes de 422 se usan TAL CUAL: ya dicen qué hacer —qué medir, qué
 * ajustar, qué falta registrar antes— y reescribirlos acá con otras palabras
 * deja dos textos que se desincronizan.
 */
async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  if (res.status === 422 && mensaje) return mensaje
  if (res.status === 403) return 'No tiene permiso para hacer esto.'
  // El UNIQUE(fecha) sube como error de base, no como ErrorDeNegocio: el
  // mensaje crudo de Postgres no le dice nada a nadie, así que se traduce.
  if (code === 'DB_ERROR' || res.status === 409) {
    return 'Ya hay un cierre registrado para esa fecha. Un día tiene un solo cierre.'
  }

  return generico
}

/** Un número de un campo opcional: vacío es `undefined`, no cero. */
function opcional(formData: FormData, campo: string): number | undefined {
  const crudo = String(formData.get(campo) ?? '').trim()
  return crudo === '' ? undefined : Number(crudo)
}

function conteo(formData: FormData, campo: string): number {
  return Number(formData.get(campo) ?? 0)
}

export async function registrarCierreAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const nivelObservado = String(formData.get('nivelObservado') ?? '').trim()

  const res = await apiServerFetchRaw('/produccion/cierres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fecha: String(formData.get('fecha') ?? ''),
      minutosProcesando: conteo(formData, 'minutosProcesando'),
      pacas600: conteo(formData, 'pacas600'),
      pacas300: conteo(formData, 'pacas300'),
      botellonesLlenados: conteo(formData, 'botellonesLlenados'),
      botellonesLavados: conteo(formData, 'botellonesLavados'),
      // Los dos que el sistema NO inventa. Se mandan solo si se midieron: un
      // cero acá sería una medición falsa, no un dato faltante.
      ...(opcional(formData, 'caudalGpm') !== undefined && {
        caudalGpm: opcional(formData, 'caudalGpm'),
      }),
      ...(opcional(formData, 'litrosPorLavado') !== undefined && {
        litrosPorLavado: opcional(formData, 'litrosPorLavado'),
      }),
      ...(nivelObservado && { nivelObservado }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar el cierre.') }

  const { lotes } = (await res.json()) as { lotes: { codigo: string }[] }

  revalidatePath(RUTA)
  // El stock cambió: se generaron lotes nuevos.
  revalidatePath('/modulos/stock')
  revalidatePath('/modulos/insumos')

  return exito(
    lotes.length === 0
      ? 'Cierre registrado. No se envasó nada ese día.'
      : `Cierre registrado. ${lotes.length === 1 ? 'Se generó el lote' : 'Se generaron los lotes'} ${lotes.map((l) => l.codigo).join(', ')}.`,
  )
}

/**
 * «Llegó agua y se llenó el tanque» — sin cantidad.
 *
 * No se manda ningún número, y no es un olvido: no hay medidor ni regleta
 * (RN-PRD-11). El saldo sube después con un ajuste explícito y con motivo, así
 * queda separado lo medido de lo estimado.
 */
export async function registrarReposicionAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const res = await apiServerFetchRaw('/tanques/reposicion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tanque: String(formData.get('tanque') ?? '') }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar la reposición.') }

  revalidatePath(RUTA)
  return exito('Anotado: llegó agua de la red. Ajuste el saldo con el nivel que ve.')
}

export async function ajustarAguaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const res = await apiServerFetchRaw('/tanques/ajuste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tanque: String(formData.get('tanque') ?? ''),
      litros: conteo(formData, 'litros'),
      motivo: String(formData.get('motivo') ?? '').trim(),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar el ajuste.') }

  const saldo = (await res.json()) as { litros: number }

  revalidatePath(RUTA)
  return exito(`Ajuste registrado. El tanque queda en ${saldo.litros} litros.`)
}

export type { EstadoDeFormulario }
