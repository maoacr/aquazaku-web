'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetch, apiServerFetchRaw } from '@/lib/api-server'
import type { Cliente, Direccion, VentaDelListado } from '@/lib/api-types'
import { cuerpoDeError } from '@/lib/form-errors'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

const RUTA = '/modulos/seguimientos'

/**
 * Traduce el fallo de `api` a algo accionable.
 *
 * Los 422 vienen listos —dicen qué hacer— y reescribirlos acá dejaría dos
 * textos que se desincronizan. Los que se nombran son los que esta pantalla
 * puede provocar y que un mensaje genérico dejaría sin explicación.
 */
async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  if (code === 'VENTA_CON_DEVOLUCIONES') {
    return 'Esta venta tiene devoluciones, así que no se puede corregir: la devolución quedaría colgando de líneas que dejarían de existir.'
  }

  /*
   * El tope de 90 días de RN-VEN-14. No es un obstáculo a sortear: es lo que
   * impide reescribir un trimestre cerrado. Pero quien aprieta el botón tiene
   * que entender que la puerta se cerró por el calendario, no por un error suyo.
   */
  if (code === 'VENTA_DEMASIADO_VIEJA') {
    return 'Esta venta ya pasó los 90 días, así que no se puede corregir. Asignarle la dirección ahora exigiría un ajuste contable.'
  }

  if (code === 'STOCK_INSUFICIENTE') {
    return 'No se pudo rearmar la venta con el stock de aquella fecha. Avise a soporte antes de volver a intentar.'
  }

  if (res.status === 422 && mensaje) return mensaje
  if (res.status === 403) return 'No tiene permiso para corregir ventas.'

  return generico
}

/**
 * Asignarle la dirección a una venta que no la registró — M15.
 *
 * ── Por qué esto NO es una edición ──────────────────────────────────────────
 *
 * La base no deja completar `ventas.direccion_id` con un `UPDATE`: el trigger
 * `solo_anulacion_en_ventas` rechaza cualquier cambio que deje la venta en
 * `confirmada` (RN-VEN-02), y hace bien — si el monto de ayer puede cambiar
 * hoy, ningún arqueo es confiable.
 *
 * El único camino es **corregir**: anular la vieja y registrar una nueva con la
 * misma fecha y la dirección puesta. Eso es lo que hace esta acción, y es lo
 * que ya usa el módulo de Ventas para editar. Está medido en
 * `api/src/modules/ventas/__tests__/asignar-direccion.test.ts`: el stock **por
 * lote** y el saldo de botellones quedan idénticos.
 *
 * ── `ocurrioEn` no es opcional acá ──────────────────────────────────────────
 *
 * `registrarVentaEn` evalúa los lotes contra `datos.ocurrioEn ?? datos.hoy`, y
 * los lotes viven 30 días. Una venta de 43 días está sobre un lote **vencido**,
 * que FEFO ya no reparte: sin `ocurrioEn`, la corrección rebota con
 * `STOCK_INSUFICIENTE` justo en las ventas que esto viene a arreglar.
 *
 * Mandarle la fecha de la venta hace que FEFO evalúe los lotes como se
 * evaluaban ese día, y el stock vuelve exactamente a donde estaba.
 *
 * ── Lo que se reenvía tiene que ser IDÉNTICO ────────────────────────────────
 *
 * Todo sale de la venta original: los ítems, el medio de pago, los botellones
 * entregados y recibidos. Lo único que se agrega es `direccionId`. Un campo que
 * se olvide acá no queda vacío — queda **cambiado**, porque la venta se
 * reescribe entera.
 */
export async function asignarDireccionAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const ventaId = String(formData.get('ventaId') ?? '')
  const direccionId = String(formData.get('direccionId') ?? '')

  if (direccionId === '') return { error: 'Elija a qué dirección se entregó esta venta.' }

  const original = await apiServerFetch<VentaConDevoluciones>(`/ventas/${ventaId}`)

  /*
   * El chequeo de devoluciones va ANTES de intentar: una venta con devoluciones
   * no se corrige (`VENTA_CON_DEVOLUCIONES`), y un 422 genérico dejaría a quien
   * aprieta el botón sin saber que el problema no tiene arreglo desde acá.
   */
  if (original.devoluciones.length > 0) {
    return {
      error:
        'Esta venta tiene devoluciones, así que no se puede corregir. Corregirla reemplazaría la venta entera y la devolución quedaría colgando de líneas que dejaron de existir.',
    }
  }

  /*
   * El día del hecho, visto desde la planta. `createdAt` es un instante en UTC
   * y la planta está en UTC−5: recortar el ISO daría el día siguiente para todo
   * lo vendido después de las 19:00, y esa venta entraría con un día de más
   * —o rebotaría por el tope de 90 justo en el borde.
   */
  const ocurrioEn = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(new Date(original.createdAt))

  const res = await apiServerFetchRaw(`/ventas/${ventaId}/correccion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      medioDePago: original.medioDePago,
      clienteId: original.clienteId,
      direccionId,
      items: original.lineas.map((l) => ({
        productoId: l.productoId,
        cantidad: l.cantidad,
        /*
         * El precio viaja para que la corrección no re-tarifique. Si la lista
         * cambió desde aquella venta, recalcular la dejaría con el precio de
         * hoy — un monto distinto por haber completado un dato.
         *
         * Va como STRING y no como número: `precioManual` usa el mismo `dinero`
         * que el resto del sistema (`^\d+(\.\d{1,2})?$`), y `precioFinal` ya
         * viene con esa forma desde `api`. Pasarlo por `Number()` lo volvería
         * `10000` y el esquema lo rechazaría.
         */
        precioManual: l.precioFinal,
      })),
      botellonesEntregados: original.botellonesEntregados,
      botellonesRecibidos: original.botellonesRecibidos,
      ocurrioEn,
      motivo: 'se registró a qué dirección del cliente se entregó esta venta',
    }),
  })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos asignarle la dirección a esta venta.') }
  }

  revalidatePath(RUTA)
  return exito('Listo: la venta quedó con su dirección.')
}

/**
 * Las direcciones activas del cliente, para elegir una.
 *
 * Se piden al abrir el diálogo y no con la lista: cuarenta filas traerían las
 * direcciones de cuarenta clientes para que alguien use las de uno. Y la lista
 * ya es la pantalla más pesada del módulo.
 */
export async function direccionesDelClienteAction(clienteId: string): Promise<Direccion[]> {
  const cliente = await apiServerFetch<Cliente & { direcciones: Direccion[] }>(
    `/clientes/${clienteId}`,
  )

  return cliente.direcciones.filter((d) => d.activa)
}

/**
 * `GET /ventas/:id` devuelve la venta del listado MÁS sus devoluciones.
 *
 * Las devoluciones viajan sin forma porque acá solo se cuenta si hay: lo único
 * que decide es si la corrección va a rebotar.
 */
interface VentaConDevoluciones extends VentaDelListado {
  devoluciones: unknown[]
}
