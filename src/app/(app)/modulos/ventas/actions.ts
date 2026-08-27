'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import type { ResultadoDeVenta } from '@/lib/api-types'
import { cuerpoDeError } from '@/lib/form-errors'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

/**
 * Mutaciones de ventas — M6.
 *
 * Ninguna decide permisos ni alcance: `api/` valida con `requirePermission` y
 * recorta con la matriz. Un `pos` que intente anular la venta de otro recibe un
 * 403 con su mensaje, y eso es lo que se muestra.
 */

const RUTA = '/modulos/ventas'

async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  // Los 422 de este módulo ya dicen qué hacer y llevan el número real —
  // cuántas unidades quedan, cuánto debe el cliente. Reescribirlos los
  // empeoraría.
  if (res.status === 422 && mensaje) return mensaje
  if (code === 'NO_ES_SU_VENTA' && mensaje) return mensaje
  if (res.status === 403) return 'No tiene permiso para hacer esto.'

  return generico
}

export interface EstadoDeVenta extends EstadoDeFormulario {
  /** El descuento se recortó contra el piso. No es un error. */
  avisoDePiso?: string
}

export async function registrarVentaAction(
  _previo: EstadoDeVenta,
  formData: FormData,
): Promise<EstadoDeVenta> {
  /*
   * Las líneas llegan como JSON en un campo oculto: un carrito es una lista de
   * longitud variable, y `FormData` no la representa sin inventar una
   * convención de nombres (`items[0][productoId]`) que después hay que parsear.
   */
  const items = JSON.parse(String(formData.get('items') ?? '[]')) as {
    productoId: string
    cantidad: number
  }[]

  if (items.length === 0) {
    return { error: 'Agregue al menos un producto antes de cobrar.' }
  }

  const clienteId = String(formData.get('clienteId') ?? '')
  const codigo = String(formData.get('codigoDescuento') ?? '').trim()

  const res = await apiServerFetchRaw('/ventas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medioDePago: String(formData.get('medioDePago') ?? 'efectivo'),
      ...(clienteId && { clienteId }),
      items,
      ...(codigo && { codigoDescuento: codigo }),
      requiereFacturaElectronica: formData.get('requiereFactura') === 'si',
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar la venta.') }

  const resultado = (await res.json()) as ResultadoDeVenta

  revalidatePath(RUTA)
  revalidatePath('/modulos/stock')

  return {
    ...exito(
      `Venta registrada por $${Number(resultado.venta.total).toLocaleString('es-CO')}.`,
    ),
    /*
     * El recorte contra el piso NO es un error: la venta se hizo. Va aparte
     * para poder mostrarlo con otro peso — quien cobró tiene que saber que el
     * código no entró entero, sin que parezca que algo salió mal.
     */
    ...(resultado.descuentoAplicadoParcialmente && {
      avisoDePiso:
        'El código valía más de lo que el precio mínimo permite descontar. Se cobró el mínimo.',
    }),
  }
}

export async function anularVentaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('ventaId') ?? '')

  const res = await apiServerFetchRaw(`/ventas/${id}/anulacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: String(formData.get('motivo') ?? '').trim() }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos anular la venta.') }

  revalidatePath(RUTA)
  revalidatePath('/modulos/stock')

  return exito('Venta anulada. El producto volvió a su lote.')
}

export async function registrarCobroAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const clienteId = String(formData.get('clienteId') ?? '')

  const res = await apiServerFetchRaw('/cobros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId,
      monto: String(formData.get('monto') ?? '').trim(),
      medioDePago: String(formData.get('medioDePago') ?? 'efectivo'),
      observaciones: String(formData.get('observaciones') ?? '').trim() || undefined,
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar el cobro.') }

  const { deudaRestante, quedaSaldada } = (await res.json()) as {
    deudaRestante: string
    quedaSaldada: boolean
  }

  revalidatePath(`/modulos/clientes/${clienteId}`)

  return exito(
    quedaSaldada
      ? 'Cobro registrado. El cliente queda al día.'
      : `Cobro registrado. Quedan $${Number(deudaRestante).toLocaleString('es-CO')}.`,
  )
}

export type { EstadoDeFormulario }
