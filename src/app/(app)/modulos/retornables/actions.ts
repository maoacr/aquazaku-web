'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { cuerpoDeError } from '@/lib/form-errors'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

/** Mutaciones de retornables — M7. Los permisos los decide `api/`. */

const RUTA = '/modulos/retornables'

async function mensajeDeError(res: Response, generico: string): Promise<string> {
  const { mensaje } = await cuerpoDeError(res)

  // Los 422 de este módulo llevan el número real —cuántos hay en bodega, cuántos
  // figuran en poder del cliente— y dicen qué falta registrar.
  if (res.status === 422 && mensaje) return mensaje
  if (res.status === 409 && mensaje) return mensaje
  if (res.status === 403) return 'No tiene permiso para hacer esto.'

  return generico
}

async function enviar(
  url: string,
  cuerpo: object,
  generico: string,
  alSalirBien: (r: Record<string, unknown>) => string,
): Promise<EstadoDeFormulario> {
  const res = await apiServerFetchRaw(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })

  if (!res.ok) return { error: await mensajeDeError(res, generico) }

  revalidatePath(RUTA)
  return exito(alSalirBien((await res.json()) as Record<string, unknown>))
}

export async function comprarBotellonesAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  return enviar(
    '/botellones/compra',
    {
      cantidad: Number(formData.get('cantidad') ?? 0),
      motivo: String(formData.get('motivo') ?? '').trim() || undefined,
    },
    'No pudimos registrar la compra.',
    (r) => `Entraron al parque. Quedan ${r.enBodega} en bodega.`,
  )
}

export async function entregarBotellonesAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const esRetorno = formData.get('direccion') === 'retorno'

  return enviar(
    esRetorno ? '/botellones/retorno' : '/botellones/entrega',
    {
      clienteId: String(formData.get('clienteId') ?? ''),
      cantidad: Number(formData.get('cantidad') ?? 0),
    },
    esRetorno ? 'No pudimos registrar el retorno.' : 'No pudimos registrar la entrega.',
    (r) =>
      `${esRetorno ? 'Retorno' : 'Entrega'} registrada. El cliente queda con ${r.enPoderDelCliente} y la bodega con ${r.enBodega}.`,
  )
}

export async function ajustarBotellonesAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const clienteId = String(formData.get('clienteId') ?? '')

  return enviar(
    '/botellones/ajuste',
    {
      ...(clienteId && { clienteId }),
      diferencia: Number(formData.get('diferencia') ?? 0),
      motivo: String(formData.get('motivo') ?? '').trim(),
    },
    'No pudimos registrar el ajuste.',
    (r) => `Ajuste registrado. El saldo queda en ${r.saldo}.`,
  )
}

export async function darDeAltaBaseAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  return enviar(
    '/bases',
    { idSticker: String(formData.get('idSticker') ?? '').trim() },
    'No pudimos dar de alta la base.',
    (r) => `Base ${r.idSticker} dada de alta.`,
  )
}

export async function prestarBaseAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const baseId = String(formData.get('baseId') ?? '')

  return enviar(
    `/bases/${baseId}/prestamo`,
    { direccionId: String(formData.get('direccionId') ?? '') },
    'No pudimos prestar la base.',
    (r) => `Base ${r.idSticker} prestada.`,
  )
}

export async function retornarBaseAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const baseId = String(formData.get('baseId') ?? '')

  return enviar(
    `/bases/${baseId}/retorno`,
    {},
    'No pudimos registrar el retorno.',
    (r) => `Base ${r.idSticker} de vuelta en la bodega.`,
  )
}

export type { EstadoDeFormulario }
