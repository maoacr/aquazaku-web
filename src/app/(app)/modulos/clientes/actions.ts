'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetch, apiServerFetchRaw } from '@/lib/api-server'
import type { AvisoDeCruce, Cliente, Direccion } from '@/lib/api-types'
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
  /**
   * El cliente recién creado.
   *
   * Viaja porque el alta no termina acá: con el cliente ya existiendo, la
   * pantalla ofrece cargarle la dirección, y `POST /clientes/:id/direcciones`
   * necesita ese id. Sin esto habría que salir a buscarlo.
   */
  cliente?: Cliente
}

export async function crearClienteAction(
  _previo: EstadoDeAlta,
  formData: FormData,
): Promise<EstadoDeAlta> {
  /*
   * El nombre viaja PARTIDO. `nombre` no existe como campo de entrada: en la
   * base es una columna generada, y `api/` rechaza cualquier intento de
   * escribirla. Lo que se manda es lo que la compone.
   *
   * Las cadenas vacías se omiten en vez de mandarse: un `apellidos: ''` no es
   * «sin apellidos», es un dato en blanco, y el CHECK de la base lo rechaza.
   */
  const texto = (campo: string) => String(formData.get(campo) ?? '').trim()
  const siHay = (campo: string) => (texto(campo) ? { [campo]: texto(campo) } : {})

  const telefono = texto('telefono')

  const res = await apiServerFetchRaw('/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...siHay('nombreLibre'),
      ...siHay('primerNombre'),
      ...siHay('segundoNombre'),
      ...siHay('apellidos'),
      ...siHay('apodo'),
      tipo: String(formData.get('tipo') ?? 'residencial'),
      tipoDocumento: String(formData.get('tipoDocumento') ?? 'CC'),
      numeroDocumento: texto('numeroDocumento'),
      ...(telefono && { telefono: { numero: telefono } }),
    }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos crear el cliente.') }

  const cliente = (await res.json()) as Cliente & { aviso: AvisoDeCruce | null }

  revalidatePath(RUTA)
  return {
    ...exito(`${cliente.nombre} quedó registrado con documento ${cliente.documento}.`),
    cliente,
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

/**
 * Buscar un cliente por su número de documento.
 *
 * ── Por qué es una acción y no un fetch del navegador ───────────────────────
 *
 * Se llama desde un componente cliente en cada tecla, y aun así el navegador
 * nunca toca `api/`: la acción corre en el servidor y viaja con la cookie de
 * sesión — ADR-0002. Es la única forma de pedir datos bajo demanda sin abrir
 * una segunda puerta a la API.
 *
 * ── Qué NO hace ─────────────────────────────────────────────────────────────
 *
 * No revalida ni escribe nada, así que no devuelve `EstadoDeFormulario`: no hay
 * éxito que avisar. Y no filtra ni recorta la respuesta — el mínimo de tres
 * caracteres y el tope de coincidencias los decide `api/`, que es quien puede
 * hacerlo sin traerse la tabla entera.
 *
 * Un error acá devuelve la lista vacía a propósito. Quien escribe una cédula en
 * el mostrador no puede quedar bloqueado porque una consulta falló: ve que no
 * aparece nadie y sigue —a mano, o registrando al cliente—. El error igual
 * queda en el log del servidor con su `x-request-id`.
 */
export async function buscarClientesAction(documento: string): Promise<Cliente[]> {
  try {
    return await apiServerFetch<Cliente[]>(
      `/clientes?documento=${encodeURIComponent(documento)}`,
    )
  } catch {
    return []
  }
}

/** Lo que devuelve el alta rápida: o el cliente, o por qué no se pudo. */
export interface ResultadoDeAltaRapida {
  cliente?: Cliente
  error?: string
  /** El cruce CC/NIT. No impide nada: el cliente quedó creado igual. */
  aviso?: string
}

/**
 * Registrar un cliente sin salir de donde se está.
 *
 * ── Por qué existe además de `crearClienteAction` ───────────────────────────
 *
 * Aquella es la del formulario de la pantalla de clientes: recibe `FormData` y
 * devuelve un mensaje. Sirve para eso y no para esto.
 *
 * Acá hace falta otra cosa. Quien está cobrando una venta descubre a mitad de
 * camino que esta persona se lleva un botellón sin devolver el vacío, y
 * entonces —RN-ENV-09— hay que registrarla. Mandarla a la pantalla de clientes
 * le vacía el carrito. Así que se registra ahí mismo, y para poder elegir al
 * cliente recién creado hace falta que la acción **devuelva el cliente**, no un
 * texto de éxito.
 *
 * El teléfono viaja en el mismo pedido a propósito: `POST /clientes/:id/
 * telefonos` pide `clientes:editar` y el `pos` no lo tiene. Ver `DatosDeAlta`
 * en el servicio de `api/`.
 */
export async function crearClienteRapidoAction(datos: {
  /**
   * El nombre viaja PARTIDO, igual que en el alta completa.
   *
   * `nombre` no existe como campo de entrada: en la base es una columna
   * generada y `api/` rechaza cualquier intento de escribirla. Lo que se manda
   * es lo que la compone — las partes para una persona, `nombreLibre` para un
   * negocio, nunca las dos.
   */
  nombreLibre?: string
  primerNombre?: string
  segundoNombre?: string
  apellidos?: string
  apodo?: string
  tipo: 'residencial' | 'comercial'
  tipoDocumento: 'CC' | 'NIT'
  numeroDocumento: string
  telefono?: { numero: string; etiqueta?: string }
}): Promise<ResultadoDeAltaRapida> {
  const res = await apiServerFetchRaw('/clientes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No pudimos registrar al cliente.') }

  const creado = (await res.json()) as Cliente & { aviso: AvisoDeCruce | null }

  revalidatePath(RUTA)

  return {
    cliente: creado,
    /*
     * El cruce NO cancela el alta: el mismo número puede ser una CC y el NIT de
     * esa misma persona. Se avisa para que quien está en el mostrador decida,
     * pero el cliente ya está creado y se puede seguir cobrando.
     */
    ...(creado.aviso && { aviso: creado.aviso.mensaje }),
  }
}

/**
 * Las direcciones de UN cliente, bajo demanda.
 *
 * ── El N+1 que esto reemplaza ───────────────────────────────────────────────
 *
 * Retornables armaba el desplegable de «a qué dirección» trayéndose las
 * direcciones de TODOS los clientes: una petición por cliente, en cada carga de
 * la pantalla. Con mil clientes son mil una peticiones para llenar una lista
 * que además nadie puede recorrer.
 *
 * Acá se pide una sola, y recién cuando ya se sabe de quién. Es el mismo cambio
 * de forma que la búsqueda por documento: no traer todo por si acaso.
 *
 * Devuelve lista vacía ante un error a propósito: quien está cobrando no puede
 * quedar bloqueado porque una consulta falló. Ve que no hay direcciones y sigue
 * sin la base — el error igual queda en el log con su `x-request-id`.
 */
export async function direccionesDeClienteAction(clienteId: string): Promise<Direccion[]> {
  try {
    return await apiServerFetch<Direccion[]>(`/clientes/${clienteId}/direcciones`)
  } catch {
    return []
  }
}
