'use server'

import { revalidatePath } from 'next/cache'
import { hoyEnLaPlanta } from '@/lib/hora-de-la-planta'
import { apiServerFetchRaw } from '@/lib/api-server'
import type { ResultadoDeCorreccion, ResultadoDeVenta } from '@/lib/api-types'
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

  const parseados = itemsDelFormulario(formData)
  if ('error' in parseados) return parseados
  const { items } = parseados

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

/**
 * Corregir una venta registrada — RN-VEN-16.
 *
 * ── Manda la venta ENTERA, no lo que cambió ─────────────────────────────────
 *
 * El cuerpo es el mismo que el de registrar, y a propósito: `api/` la vuelve a
 * registrar de cero, con las mismas validaciones de stock, piso, crédito y
 * vigencia. Mandar un parche obligaría a fusionar lo nuevo con lo viejo del
 * lado del servidor, y esa fusión es la edición que RN-VEN-02 prohíbe, escrita
 * en otro lugar.
 *
 * ── `ocurrioEn` sí viaja, y siempre — RN-VEN-16 fecha corregible ────────────
 *
 * La corrección PUEDE llevar override de fecha dentro del piso de 90 días de
 * RN-VEN-14. El modal pre-carga con la fecha original —queda en
 * `ocurrioEnOriginal`— y se envía SIEMPRE, incluso si el admin no la tocó:
 *
 * - si viene vacío (no es el caso normal, el modal siempre pinta el input),
 *   se omite para que `api/` herede el instante de la original;
 * - si viene con un día distinto al de la original, `api/` lo valida y lo
 *   persiste al mediodía de la planta;
 * - si viene IGUAL a la original (D10), también se manda: el admin vio el
 *   campo, confirmó la fecha, y la auditoría tiene que registrar esa
 *   intención — no la herencia silenciosa.
 *
 * El filtro "igual a hoy = undefined" del alta NO se aplica acá: ese filtro
 * existe porque el alta sin override usa `defaultNow()` y la corrección SIEMPRE
 * escribe un `createdAt` explícito vía `Reemplazo`. Lo explica `corregirVenta`
 * en `api/src/modules/ventas/correccion.ts`.
 *
 * ── Lo que NO viaja ─────────────────────────────────────────────────────────
 *
 * Los botellones sin vacío y la base tampoco: son movimientos FÍSICOS que ya
 * ocurrieron y siguen colgando de la venta original. El envase salió una vez.
 */
export async function corregirVentaAction(
  _previo: EstadoDeVenta,
  formData: FormData,
): Promise<EstadoDeVenta> {
  const ventaId = String(formData.get('ventaId') ?? '')
  const motivo = String(formData.get('motivo') ?? '').trim()

  /*
   * La fecha del modal — ver el comment del action arriba. Vacío ⇒ se omite
   * para que `api/` herede; cualquier valor no-vacío viaja explícito.
   */
  const fecha = String(formData.get('ocurrioEn') ?? '').trim()
  const ocurrioEn = fecha || undefined

  const items = itemsDelFormulario(formData)
  if ('error' in items) return items

  const clienteId = String(formData.get('clienteId') ?? '')
  const codigo = String(formData.get('codigoDescuento') ?? '').trim()

  const res = await apiServerFetchRaw(`/ventas/${ventaId}/correccion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      motivo,
      medioDePago: String(formData.get('medioDePago') ?? 'efectivo'),
      ...(clienteId && { clienteId }),
      items: items.items,
      ...(codigo && { codigoDescuento: codigo }),
      ...(ocurrioEn && { ocurrioEn }),
      requiereFacturaElectronica: formData.get('requiereFactura') === 'si',
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos corregir la venta.') }

  const resultado = (await res.json()) as ResultadoDeCorreccion

  revalidatePath(RUTA)
  revalidatePath('/modulos/stock')
  revalidatePath('/modulos/clientes', 'layout')

  const antes = Number(resultado.reemplazada.total)
  const despues = Number(resultado.venta.total)

  return exito(
    antes === despues
      ? 'Venta corregida. El total no cambió.'
      : `Venta corregida: de $${antes.toLocaleString('es-CO')} a $${despues.toLocaleString('es-CO')}.`,
  )
}

/**
 * Las líneas del carrito, validadas, o el error que dice qué falta.
 *
 * Lo comparten registrar y corregir porque es el MISMO carrito: la corrección
 * vuelve a registrar la venta entera, no parchea la vieja. Duplicar este
 * parseo dejaría que el mensaje sobre el precio a mano existiera en un camino y
 * no en el otro.
 */
function itemsDelFormulario(
  formData: FormData,
): { items: { productoId: string; cantidad: number; precioManual?: string }[] } | { error: string } {
  /*
   * Las líneas llegan como JSON en un campo oculto: un carrito es una lista de
   * longitud variable, y `FormData` no la representa sin inventar una
   * convención de nombres (`items[0][productoId]`) que después hay que parsear.
   */
  const crudos = JSON.parse(String(formData.get('items') ?? '[]')) as {
    productoId: string
    cantidad: number
    /** El precio escrito a mano, en pesos enteros — RN-VEN-15. */
    precioManual?: string
  }[]

  if (crudos.length === 0) {
    return { error: 'Agregue al menos un producto antes de cobrar.' }
  }

  /*
   * La clave se OMITE cuando nadie escribió un precio — RN-VEN-15.
   *
   * `api/` distingue ausente («cobrá la lista») de presente («cobrá esto»), y un
   * `''` que llegue por un checkbox tildado sin número volvería como un 400 de
   * Zod que habla de un regex. Acá todavía se puede decir qué falta.
   */
  if (crudos.some((i) => i.precioManual !== undefined && !i.precioManual.trim())) {
    return { error: 'Escriba el precio que cobró, o destilde la casilla para usar el de la lista.' }
  }

  return {
    items: crudos.map(({ productoId, cantidad, precioManual }) => ({
      productoId,
      cantidad,
      ...(precioManual?.trim() && { precioManual: precioManual.trim() }),
    })),
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
  /*
   * La ficha del cliente también muestra esta venta, y desde M17 se puede
   * anular DESDE ahí. Sin esto, la tarjeta se queda diciendo «Confirmada»
   * encima de una deuda que ya bajó, que es la clase de pantalla que hace que
   * alguien anule dos veces.
   */
  revalidatePath('/modulos/clientes', 'layout')

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
