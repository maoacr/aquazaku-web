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

/** Los campos de ubicación, en un solo lugar: el alta y la edición mandan lo mismo. */
const CAMPOS_DE_DIRECCION = [
  'viaTipo',
  'viaNumero',
  'viaLetra',
  'placaNumero',
  'placaLetra',
  'placaSegundo',
  'placaLetraFinal',
  'complemento',
  'municipio',
  'departamento',
  'direccion',
  'indicaciones',
] as const

/**
 * Arma el cuerpo de una dirección desde el formulario.
 *
 * Los campos vacíos NO se mandan: `api` distingue «no lo cargaron» de «lo
 * cargaron vacío», y mandar `''` haría que una dirección en blanco pase el
 * control de la base diciendo que tiene municipio.
 */
function cuerpoDeDireccion(formData: FormData): Record<string, unknown> {
  const texto = (campo: string): string | undefined => {
    const valor = String(formData.get(campo) ?? '').trim()
    return valor === '' ? undefined : valor
  }

  const cuerpo: Record<string, unknown> = { etiqueta: texto('etiqueta') }

  for (const campo of CAMPOS_DE_DIRECCION) {
    const valor = texto(campo)
    if (valor !== undefined) cuerpo[campo] = valor
  }

  // Las coordenadas van de a dos: media coordenada no ubica nada.
  const lat = texto('latitud')
  const lng = texto('longitud')
  if (lat !== undefined && lng !== undefined) {
    cuerpo.latitud = Number(lat)
    cuerpo.longitud = Number(lng)
  }

  return cuerpo
}

export async function agregarDireccionAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('clienteId') ?? '')

  const res = await apiServerFetchRaw(`/clientes/${id}/direcciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoDeDireccion(formData)),
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

/**
 * Un teléfono del cliente — M14.
 *
 * Salió de la primera demo: se había construido la cartera por edad para saber a
 * quién llamar primero, y no había a qué número llamar.
 */
export async function agregarTelefonoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('clienteId') ?? '')
  const etiqueta = String(formData.get('etiqueta') ?? '').trim()

  const res = await apiServerFetchRaw(`/clientes/${id}/telefonos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      numero: String(formData.get('numero') ?? '').trim(),
      ...(etiqueta && { etiqueta }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos agregar el teléfono.') }

  revalidatePath(`${RUTA}/${id}`)
  return exito('Teléfono agregado.')
}

export async function desactivarTelefonoAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const clienteId = String(formData.get('clienteId') ?? '')
  const res = await apiServerFetchRaw(`/telefonos/${formData.get('id')}/desactivar`, {
    method: 'PATCH',
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos quitar el teléfono.') }

  revalidatePath(`${RUTA}/${clienteId}`)
  return exito('Teléfono quitado.')
}

/**
 * Editar una dirección — M14.
 *
 * Manda la dirección ENTERA, no los campos que cambiaron: lo que el operador
 * borró llega ausente y se guarda ausente. Con un merge parcial, vaciar un
 * campo sería imposible.
 */
export async function editarDireccionAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const clienteId = String(formData.get('clienteId') ?? '')

  const res = await apiServerFetchRaw(`/direcciones/${formData.get('id')}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpoDeDireccion(formData)),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos guardar la dirección.') }

  revalidatePath(`${RUTA}/${clienteId}`)
  return exito('Dirección actualizada.')
}

/**
 * Dar de baja una dirección.
 *
 * Se DESACTIVA, no se borra: puede tener bases prestadas, y el préstamo dejaría
 * de ser reclamable si la dirección desapareciera.
 */
export async function desactivarDireccionAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const clienteId = String(formData.get('clienteId') ?? '')

  const res = await apiServerFetchRaw(`/direcciones/${formData.get('id')}/desactivar`, {
    method: 'PATCH',
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos dar de baja la dirección.') }

  revalidatePath(`${RUTA}/${clienteId}`)
  return exito('Dirección dada de baja.')
}
