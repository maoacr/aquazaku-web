'use server'

import { revalidatePath } from 'next/cache'
import { hoyEnLaPlanta } from '@/lib/hora-de-la-planta'
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
  /*
   * Vacío o igual a hoy es lo mismo que no mandarla: la comparación se hace
   * acá y no en `api/` porque es quien sabe qué día es hoy PARA QUIEN MIRA la
   * pantalla, que es el mismo día de la planta.
   */
  const fecha = String(formData.get('ocurrioEn') ?? '').trim()
  const ocurrioEn = fecha && fecha !== hoyEnLaPlanta() ? fecha : undefined

  const items = JSON.parse(String(formData.get('items') ?? '[]')) as {
    productoId: string
    cantidad: number
  }[]

  if (items.length === 0) {
    return { error: 'Agregue al menos un producto antes de cobrar.' }
  }

  const clienteId = String(formData.get('clienteId') ?? '')
  const codigo = String(formData.get('codigoDescuento') ?? '').trim()

  /*
   * Cuántos botellones salen SIN vacío de contrapartida — RN-ENV-03.
   *
   * Solo viaja cuando es mayor que cero: el caso común es el intercambio, que
   * no mueve el parque, y mandar un `0` en cada venta ensuciaría la bitácora
   * con un campo que casi nunca dice nada.
   */
  const sinVacio = Number(formData.get('botellonesSinVacio') ?? 0)

  /*
   * La base viaja DENTRO de la venta — RN-BAS-03.
   *
   * Las dos cosas entran juntas o no entra ninguna: si el préstamo falla, la
   * venta tampoco se hace. Es lo correcto — quien atiende todavía no cobró.
   *
   * Solo viaja si vienen los dos datos: el sticker sin dirección no se puede
   * prestar (una base va a un lugar, no a una persona) y la dirección sin
   * sticker no dice qué base.
   */
  const baseSticker = String(formData.get('baseSticker') ?? '').trim()
  const baseDireccionId = String(formData.get('baseDireccionId') ?? '').trim()

  const res = await apiServerFetchRaw('/ventas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medioDePago: String(formData.get('medioDePago') ?? 'efectivo'),
      ...(clienteId && { clienteId }),
      items,
      ...(codigo && { codigoDescuento: codigo }),
      ...(sinVacio > 0 && { botellonesSinVacio: sinVacio }),
      ...(baseSticker &&
        baseDireccionId && { base: { sticker: baseSticker, direccionId: baseDireccionId } }),
      /*
       * La fecha del hecho, solo si no es hoy — RN-VEN-14.
       *
       * Ausente significa «ahora», y entonces `api/` deja que la base ponga la
       * hora real: es el caso del mostrador, donde la hora sirve. Mandarla
       * siempre convertiría toda venta de hoy en una venta anclada al mediodía.
       *
       * El `<input type="date">` entrega AAAA-MM-DD sin importar cómo lo muestre
       * —el navegador lo pinta DD/MM/AAAA con el locale es-CO—, así que no hay
       * conversión que hacer acá.
       */
      ...(ocurrioEn && { ocurrioEn }),
      requiereFacturaElectronica: formData.get('requiereFactura') === 'si',
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar la venta.') }

  const resultado = (await res.json()) as ResultadoDeVenta

  revalidatePath(RUTA)
  revalidatePath('/modulos/stock')

  return {
    ...exito(
      `Venta registrada por $${Number(resultado.venta.total).toLocaleString('es-CO')}.` +
        // Que la base salió queda dicho en el mismo aviso: es lo que quien
        // atiende necesita confirmar antes de que el cliente se vaya.
        (resultado.basePrestada
          ? ` La base ${resultado.basePrestada.idSticker} quedó a su nombre.`
          : ''),
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
