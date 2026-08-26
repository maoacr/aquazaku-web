'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError } from '@/lib/form-errors'

/**
 * Mutaciones de la pantalla de insumos — M3.
 *
 * Pasan por `apiServerFetchRaw` porque acá los status de error son estados
 * normales de pantalla, no excepciones: un 422 `SIN_EQUIVALENCIA` es un mensaje
 * que quien carga la compra tiene que leer, no un error boundary.
 *
 * Ninguna decide permisos. `api/` valida con `requirePermission('insumos', …)`
 * en cada endpoint (RN-ACC-02).
 */

const RUTA = '/modulos/insumos'

export interface EstadoDeFormulario {
  error?: string
  ok?: string
}

/**
 * Traduce un fallo de `api/` a algo accionable.
 *
 * Los mensajes de `api/` para 422 se usan TAL CUAL: ya explican qué hacer, y
 * reescribirlos acá con otras palabras deja dos textos que se desincronizan.
 * `SIN_EQUIVALENCIA` es el caso que más importa — dice qué hay que ir a medir.
 */
async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  if (res.status === 422 && mensaje) return mensaje
  if (code === 'INSUMO_NO_ENCONTRADO') return 'Ese insumo ya no existe.'
  if (res.status === 403) return 'No tiene permiso para hacer esto.'

  return generico
}

/** `{ ok: false }` no es un fallo: es que no alcanzaba. Se dice con el número. */
async function leerResultado(res: Response, exito: (saldo: number) => string): Promise<EstadoDeFormulario> {
  const cuerpo = (await res.json()) as
    | { ok: true; saldo: number }
    | { ok: false; disponible: number }

  if (!cuerpo.ok) {
    return {
      error: `No alcanza: hay ${cuerpo.disponible} ${cuerpo.disponible === 1 ? 'unidad' : 'unidades'}.`,
    }
  }

  revalidatePath(RUTA)
  return { ok: exito(cuerpo.saldo) }
}

export async function crearInsumoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const equivalencia = String(formData.get('equivalenciaPorKilo') ?? '').trim()

  const res = await apiServerFetchRaw('/insumos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo: String(formData.get('codigo') ?? '').trim().toUpperCase(),
      nombre: String(formData.get('nombre') ?? '').trim(),
      minimo: Number(formData.get('minimo') ?? 0),
      // Se manda solo si vino: `undefined` deja el campo en null, que es lo
      // correcto mientras la medición no exista.
      ...(equivalencia && { equivalenciaPorKilo: Number(equivalencia) }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos crear el insumo.') }

  revalidatePath(RUTA)
  return { ok: 'Insumo creado.' }
}

export async function registrarEntradaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const insumoId = String(formData.get('insumoId') ?? '')
  const medida = String(formData.get('medida') ?? 'unidad')
  const valor = Number(formData.get('valor') ?? 0)

  const res = await apiServerFetchRaw(`/insumos/${insumoId}/entrada`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(medida === 'kilo' ? { kilos: valor } : { cantidad: valor }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar la entrada.') }

  return leerResultado(res, (saldo) => `Entrada registrada. Quedan ${saldo} unidades.`)
}

export async function ajustarInsumoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const insumoId = String(formData.get('insumoId') ?? '')

  const res = await apiServerFetchRaw(`/insumos/${insumoId}/ajuste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      diferencia: Number(formData.get('diferencia') ?? 0),
      motivo: String(formData.get('motivo') ?? '').trim(),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar el ajuste.') }

  return leerResultado(res, (saldo) => `Ajuste registrado. Quedan ${saldo} unidades.`)
}

export async function descartarInsumoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const insumoId = String(formData.get('insumoId') ?? '')
  const observaciones = String(formData.get('observaciones') ?? '').trim()

  const res = await apiServerFetchRaw(`/insumos/${insumoId}/descarte`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cantidad: Number(formData.get('cantidad') ?? 0),
      causa: String(formData.get('causa') ?? ''),
      ...(observaciones && { observaciones }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar el descarte.') }

  return leerResultado(res, (saldo) => `Descarte registrado. Quedan ${saldo} unidades.`)
}

/** Cargar la equivalencia medida en planta — cierra la pregunta 37 por insumo. */
export async function cargarEquivalenciaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const insumoId = String(formData.get('insumoId') ?? '')

  const res = await apiServerFetchRaw(`/insumos/${insumoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equivalenciaPorKilo: Number(formData.get('equivalenciaPorKilo') ?? 0) }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos guardar la equivalencia.') }

  revalidatePath(RUTA)
  return {
    ok: 'Equivalencia guardada. Desde ahora se puede registrar la compra en kilos.',
  }
}
