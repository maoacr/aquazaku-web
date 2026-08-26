'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import type { AvisoDeCruce } from '@/lib/api-types'
import { cuerpoDeError } from '@/lib/form-errors'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

/**
 * Mutaciones de clientes — M5.
 *
 * Ninguna decide permisos: `api/` valida con `requirePermission` en cada
 * endpoint (RN-ACC-02). Los cinco permisos de `clientes` ya estaban en la
 * matriz.
 */

const RUTA = '/modulos/clientes'

async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { code, mensaje } = await cuerpoDeError(res)

  // Los mensajes de 422 vienen listos: dicen qué hacer. Reescribirlos acá deja
  // dos textos que se desincronizan.
  if (res.status === 422 && mensaje) return mensaje
  if (res.status === 403) return 'No tiene permiso para hacer esto.'
  if (code === 'CLIENTE_NO_ENCONTRADO') return 'Ese cliente ya no existe.'
  // El UNIQUE del documento sube como error de base: el mensaje crudo de
  // Postgres no le dice nada a nadie.
  if (res.status === 409 || code === 'DB_ERROR') {
    return 'Ya hay un cliente con ese mismo tipo y número de documento.'
  }

  return generico
}

/** El alta puede traer un aviso de cruce CC/NIT, que no es un error. */
export interface EstadoDeAlta extends EstadoDeFormulario {
  aviso?: AvisoDeCruce
}

export async function crearClienteAction(
  _previo: EstadoDeAlta,
  formData: FormData,
): Promise<EstadoDeAlta> {
  const res = await apiServerFetchRaw('/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: String(formData.get('nombre') ?? '').trim(),
      tipo: String(formData.get('tipo') ?? 'residencial'),
      tipoDocumento: String(formData.get('tipoDocumento') ?? 'CC'),
      numeroDocumento: String(formData.get('numeroDocumento') ?? '').trim(),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos crear el cliente.') }

  const cliente = (await res.json()) as { nombre: string; documento: string; aviso: AvisoDeCruce | null }

  revalidatePath(RUTA)
  return {
    ...exito(`${cliente.nombre} quedó registrado con documento ${cliente.documento}.`),
    ...(cliente.aviso && { aviso: cliente.aviso }),
  }
}

export async function verificarDocumentoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('clienteId') ?? '')

  const res = await apiServerFetchRaw(`/clientes/${id}/verificacion`, { method: 'POST' })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos verificar el documento.') }

  revalidatePath(RUTA)
  revalidatePath(`${RUTA}/${id}`)
  return exito('Documento verificado. Quedó registrado quién respondió por él.')
}

export async function configurarCreditoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('clienteId') ?? '')
  const habilitado = formData.get('habilitado') === 'si'
  const limite = String(formData.get('limite') ?? '').trim()

  const res = await apiServerFetchRaw(`/clientes/${id}/credito`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      habilitado,
      // Vacío es SIN TOPE, que es el default de RN-CLI-12 — no es un dato que
      // falta, es una decisión.
      ...(habilitado && { limite: limite === '' ? null : Number(limite) }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos guardar el crédito.') }

  revalidatePath(`${RUTA}/${id}`)
  return exito(
    habilitado
      ? limite === ''
        ? 'Crédito habilitado, sin tope.'
        : `Crédito habilitado con tope de $${Number(limite).toLocaleString('es-CO')}.`
      : 'Crédito deshabilitado.',
  )
}

export async function agregarDireccionAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('clienteId') ?? '')
  const indicaciones = String(formData.get('indicaciones') ?? '').trim()

  const res = await apiServerFetchRaw(`/clientes/${id}/direcciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      etiqueta: String(formData.get('etiqueta') ?? '').trim(),
      direccion: String(formData.get('direccion') ?? '').trim(),
      ...(indicaciones && { indicaciones }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos agregar la dirección.') }

  revalidatePath(`${RUTA}/${id}`)
  return exito('Dirección agregada.')
}

export async function cambiarEstadoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('clienteId') ?? '')
  const activo = formData.get('activo') === 'si'

  const res = await apiServerFetchRaw(`/clientes/${id}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activo }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos cambiar el estado.') }

  revalidatePath(RUTA)
  revalidatePath(`${RUTA}/${id}`)
  return exito(activo ? 'Cliente reactivado.' : 'Cliente desactivado. Su historial queda.')
}

export type { EstadoDeFormulario }
