'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError } from '@/lib/form-errors'

/**
 * Mutaciones del catálogo — M1.
 *
 * Pasan por `apiServerFetchRaw` porque acá los status de error son estados
 * normales de pantalla, no excepciones: un 422 `PRECIO_MINIMO_INVALIDO` es un
 * mensaje que el admin tiene que leer y corregir, no un error boundary.
 *
 * Ninguna decide permisos. `api/` valida con `requirePermission('productos', …)`
 * en cada endpoint (RN-ACC-02); si esta pantalla se equivoca, el peor caso es un
 * mensaje de error, no un precio cambiado por quien no debía.
 */

const RUTA = '/modulos/productos'
const RUTA_GESTION = '/modulos/productos/gestion'

export interface EstadoDeFormulario {
  error?: string
  ok?: string
}

/** Traduce un fallo de `api/` a algo que el admin pueda accionar. */
async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  // `api/` ya explica qué hacer en estos casos; repetirlo con otras palabras
  // solo genera dos mensajes que se desincronizan.
  if (code === 'PRECIO_MINIMO_INVALIDO' && mensaje) return mensaje
  if (code === 'PRODUCTO_NO_ENCONTRADO') return 'Ese producto ya no existe.'
  if (code === 'PRODUCTO_YA_INACTIVO') return 'El producto ya estaba desactivado.'
  if (code === 'PRODUCTO_YA_ACTIVO') return 'El producto ya estaba activo.'
  if (res.status === 403) return 'No tiene permiso para hacer esto.'

  return generico
}

function revalidarCatalogo(): void {
  revalidatePath(RUTA)
  revalidatePath(RUTA_GESTION)
}

export async function crearProductoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const nombre = String(formData.get('nombre') ?? '').trim()
  const presentacion = String(formData.get('presentacion') ?? '')
  const contenidoMl = Number(formData.get('contenidoMl') ?? 0)
  const unidades = Number(formData.get('unidades') ?? 0)

  if (!nombre) return { error: 'Escriba un nombre.' }
  if (presentacion !== 'paca' && presentacion !== 'botellon') {
    return { error: 'Elija una presentación.' }
  }
  if (!Number.isInteger(contenidoMl) || contenidoMl < 1) {
    return { error: 'El contenido va en mililitros enteros, mayor que cero.' }
  }
  if (!Number.isInteger(unidades) || unidades < 1) {
    return { error: 'Un producto tiene al menos una unidad.' }
  }

  const res = await apiServerFetchRaw('/productos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre,
      presentacion,
      contenidoMl,
      unidades,
      ...preciosDe(formData),
    }),
  })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos crear el producto.') }
  }

  const creado = (await res.json()) as { codigo: string }

  revalidarCatalogo()
  return { ok: `Producto creado con el código ${creado.codigo}.` }
}

/**
 * Cambia los tres precios juntos.
 *
 * No es una limitación de la pantalla: `api/` los exige juntos. Permitir
 * cambiar uno solo obligaría a leer los otros dos de la base para verificar el
 * piso, y abriría una ventana entre esa lectura y la escritura.
 */
export async function editarPreciosAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Falta el producto.' }

  const res = await apiServerFetchRaw(`/productos/${id}/precios`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preciosDe(formData)),
  })

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos actualizar los precios.') }
  }

  revalidarCatalogo()
  return { ok: 'Precios actualizados. El cambio quedó registrado en la auditoría.' }
}

export async function cambiarEstadoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('id') ?? '')
  const activar = String(formData.get('activar') ?? '') === 'si'

  if (!id) return { error: 'Falta el producto.' }

  // POST y no DELETE: un producto no se borra, se desactiva (RN-CAT-02). El
  // verbo tiene que contar la verdad de lo que pasa.
  const res = await apiServerFetchRaw(
    `/productos/${id}/${activar ? 'reactivar' : 'desactivar'}`,
    { method: 'POST' },
  )

  if (!res.ok) {
    return { error: await mensajeDeError(res, 'No pudimos cambiar el estado del producto.') }
  }

  revalidarCatalogo()
  return {
    ok: activar
      ? 'Producto reactivado: ya se puede vender.'
      : 'Producto desactivado. Sigue existiendo para las ventas históricas.',
  }
}

/**
 * Los montos viajan como string, tal como los espera `api/` y los guarda la
 * base. Convertirlos a `number` acá los haría pasar por un float, que es donde
 * se pierde el peso que después no cuadra.
 */
function preciosDe(formData: FormData) {
  return {
    precioResidencial: String(formData.get('precioResidencial') ?? '').trim(),
    precioComercial: String(formData.get('precioComercial') ?? '').trim(),
    precioMinimo: String(formData.get('precioMinimo') ?? '').trim(),
  }
}
