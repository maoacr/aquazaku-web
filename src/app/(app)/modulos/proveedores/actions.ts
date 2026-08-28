'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

/**
 * Compras y proveedores — M9.
 *
 * Todo pasa por `apiServerFetchRaw`: el browser nunca le habla a `api/`
 * (ADR-0002), así que estas acciones corren en el servidor y reenvían la cookie.
 */

async function mensajeDeError(res: Response, generico: string): Promise<string> {
  try {
    const cuerpo = (await res.json()) as { mensaje?: string; error?: string }
    return cuerpo.mensaje ?? cuerpo.error ?? generico
  } catch {
    return generico
  }
}

async function enviar(
  url: string,
  cuerpo: object,
  generico: string,
  alSalirBien: (r: Record<string, unknown>) => string,
  metodo = 'POST',
): Promise<EstadoDeFormulario> {
  const res = await apiServerFetchRaw(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })

  if (!res.ok) return { error: await mensajeDeError(res, generico) }

  const datos = (await res.json()) as Record<string, unknown>
  revalidatePath('/modulos/proveedores')

  return exito(alSalirBien(datos))
}

export async function crearProveedorAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const nit = String(formData.get('nit') ?? '').trim()
  const contacto = String(formData.get('contacto') ?? '').trim()

  return enviar(
    '/proveedores',
    {
      nombre: String(formData.get('nombre') ?? ''),
      // Solo viajan si los cargaron: son opcionales a propósito (RN-PRO-01).
      ...(nit && { nit }),
      ...(contacto && { contacto }),
    },
    'No pudimos crear el proveedor.',
    (r) => `${r.nombre} quedó cargado.`,
  )
}

/**
 * Activar o desactivar — RN-PRO-01.
 *
 * Reactivar existe por el caso real: «le volvimos a comprar». La compra a un
 * inactivo se rechaza, y el camino correcto es reactivarlo en vez de crear un
 * duplicado con el mismo NIT, que partiría el historial en dos.
 */
export async function cambiarEstadoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('proveedorId') ?? '')
  const activo = formData.get('activo') === 'si'

  return enviar(
    `/proveedores/${id}/estado`,
    { activo },
    'No pudimos cambiar el estado.',
    (r) => `${r.nombre} quedó ${activo ? 'activo' : 'desactivado'}.`,
    'PATCH',
  )
}

/**
 * Registrar una compra — RN-PRO-05.
 *
 * Las líneas llegan como JSON en un campo oculto, igual que el carrito de una
 * venta: son una lista de largo variable y un formulario plano no la expresa.
 */
export async function registrarCompraAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const lineas = JSON.parse(String(formData.get('lineas') ?? '[]')) as unknown[]
  const medioDePago = String(formData.get('medioDePago') ?? 'efectivo')
  const venceEl = String(formData.get('venceEl') ?? '').trim()

  return enviar(
    '/compras',
    {
      proveedorId: String(formData.get('proveedorId') ?? ''),
      medioDePago,
      // Solo a crédito: de contado el servidor la rechaza, y con razón.
      ...(medioDePago === 'credito' && venceEl && { venceEl }),
      lineas,
    },
    'No pudimos registrar la compra.',
    (r) => {
      const { compra } = r as { compra: { total: string; pagada: boolean; venceEl: string | null } }
      return compra.pagada
        ? `Compra registrada por $${compra.total}.`
        : `Compra registrada por $${compra.total}. Vence el ${compra.venceEl}.`
    },
  )
}

export async function marcarPagadaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('compraId') ?? '')

  return enviar(
    `/compras/${id}/pago`,
    {},
    'No pudimos marcarla pagada.',
    (r) => `Compra de $${(r as { total: string }).total} marcada como pagada.`,
  )
}

export type { EstadoDeFormulario }
