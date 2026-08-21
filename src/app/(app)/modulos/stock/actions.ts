'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError } from '@/lib/form-errors'
import { LARGO_MINIMO_MOTIVO } from '@/lib/motivos'

/**
 * Mutaciones del stock — M2.
 *
 * Pasan por `apiServerFetchRaw` porque acá los status de error son estados
 * normales de pantalla: un 409 `STOCK_INSUFICIENTE` es un número que el
 * operario tiene que leer y corregir, no un error boundary.
 *
 * Ninguna decide permisos. `api/` valida con `requirePermission('stock', …)` en
 * cada endpoint (RN-ACC-02).
 */

const RUTA = '/modulos/stock'

export interface EstadoDeFormulario {
  error?: string
  ok?: string
  /**
   * Identifica **esta** operación exitosa, y solo sirve para limpiar el
   * formulario.
   *
   * Sin él, dos ajustes seguidos con el mismo resultado producen el mismo
   * mensaje, y la pantalla no puede distinguir "se envió de nuevo" de "no pasó
   * nada". El token cambia siempre, así que la limpieza queda **derivada** del
   * estado en vez de sincronizada con un efecto — que es lo que dispara
   * renders en cascada.
   */
  token?: string
}

/** Marca una operación exitosa como distinta de la anterior. */
function exito(mensaje: string): EstadoDeFormulario {
  return { ok: mensaje, token: crypto.randomUUID() }
}

async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  // `api/` ya explica qué hacer; repetirlo con otras palabras genera dos
  // mensajes que se desincronizan.
  if (code === 'STOCK_INSUFICIENTE' && mensaje) return mensaje
  if (code === 'MOTIVO_REQUERIDO' && mensaje) return mensaje
  if (code === 'CAUSA_REQUERIDA' && mensaje) return mensaje
  if (code === 'LOTE_NO_ENCONTRADO') return 'Ese lote ya no existe.'
  if (code === 'PRODUCTO_NO_ENCONTRADO') return 'Ese producto ya no existe.'
  if (res.status === 403) return 'No tenés permiso para hacer esto.'

  return generico
}

/**
 * El mínimo se valida acá también, y no solo en `api/`.
 *
 * No es defensa en profundidad: es que el operario sepa **antes** de mandar
 * que su motivo no alcanza, en vez de perder lo escrito y volver a empezar. La
 * validación que manda sigue siendo la del servidor.
 */
function motivoInsuficiente(motivo: string): boolean {
  return motivo.trim().length < LARGO_MINIMO_MOTIVO
}

export async function registrarEntradaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const productoId = String(formData.get('productoId') ?? '')
  const cantidad = Number(formData.get('cantidad') ?? 0)
  const fechaEmpaque = String(formData.get('fechaEmpaque') ?? '')
  const motivo = String(formData.get('motivo') ?? '')

  if (!productoId) return { error: 'Elegí un producto.' }
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { error: 'La cantidad tiene que ser un número entero mayor que cero.' }
  }
  if (!fechaEmpaque) return { error: 'Poné la fecha de empaque.' }
  if (motivoInsuficiente(motivo)) {
    return {
      error: `El motivo necesita al menos ${LARGO_MINIMO_MOTIVO} caracteres: tiene que servir para entender el registro dentro de tres meses.`,
    }
  }

  const res = await apiServerFetchRaw('/stock/entradas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productoId, cantidad, fechaEmpaque, motivo }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar la entrada.') }

  const lote = (await res.json()) as { codigo: string; fechaVencimiento: string }

  revalidatePath(RUTA)
  return exito(
    `Lote ${lote.codigo} creado con ${cantidad} unidades. Vence el ${lote.fechaVencimiento}.`,
  )
}

export async function ajustarLoteAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const loteId = String(formData.get('loteId') ?? '')
  const cantidad = Number(formData.get('cantidad') ?? 0)
  const motivo = String(formData.get('motivo') ?? '')

  if (!loteId) return { error: 'Falta el lote.' }
  if (!Number.isInteger(cantidad) || cantidad === 0) {
    return { error: 'Un ajuste de cero no corrige nada. Poné cuántas unidades sobran o faltan.' }
  }
  if (motivoInsuficiente(motivo)) {
    return {
      error: `El motivo necesita al menos ${LARGO_MINIMO_MOTIVO} caracteres: tiene que servir para entender el registro dentro de tres meses.`,
    }
  }

  const res = await apiServerFetchRaw('/stock/ajustes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loteId, cantidad, motivo }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos ajustar el lote.') }

  const { saldo } = (await res.json()) as { saldo: number }

  revalidatePath(RUTA)
  return exito(`Ajuste registrado. El lote queda en ${saldo} unidades.`)
}

export async function descartarAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const loteId = String(formData.get('loteId') ?? '')
  const cantidad = Number(formData.get('cantidad') ?? 0)
  const causa = String(formData.get('causa') ?? '')
  const observaciones = String(formData.get('observaciones') ?? '')

  if (!loteId) return { error: 'Falta el lote.' }
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return { error: 'Poné cuántas unidades se descartan.' }
  }
  if (!causa) return { error: 'Elegí la causa: sin ella el descarte no dice quién responde.' }

  // Las otras tres causas ya dicen qué pasó; "otro" no dice nada.
  if (causa === 'otro' && motivoInsuficiente(observaciones)) {
    return {
      error: `Con causa "otro" hay que explicar qué pasó, en al menos ${LARGO_MINIMO_MOTIVO} caracteres.`,
    }
  }

  const res = await apiServerFetchRaw('/stock/descartes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loteId, cantidad, causa, observaciones: observaciones || undefined }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar el descarte.') }

  const { saldo } = (await res.json()) as { saldo: number }

  revalidatePath(RUTA)
  return exito(`Descarte registrado. El lote queda en ${saldo} unidades.`)
}
