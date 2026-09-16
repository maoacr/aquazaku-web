'use server'

import { revalidatePath } from 'next/cache'
import type { Base } from '@/lib/api-types'
import { apiServerFetch, apiServerFetchRaw } from '@/lib/api-server'
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

/**
 * Marcar una base como dañada — RN-BAS-08.
 *
 * ── El monto va explícito, y es la razón por la que este formulario existe ──
 *
 * La regla habla de un «valor de reposición configurable», pero el dominio no
 * dice cuál es. Poner un default acá sería inventarlo, y sería peor que
 * pedirlo: es plata que se le cobra a un cliente real.
 *
 * Cuando exista el módulo de configuración, ese valor pasa a ser el default de
 * este campo — no su reemplazo.
 */
export async function marcarBaseDanadaAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const baseId = String(formData.get('baseId') ?? '')

  return enviar(
    `/bases/${baseId}/dano`,
    {
      monto: String(formData.get('monto') ?? '').trim(),
      motivo: String(formData.get('motivo') ?? ''),
      medioDePago: String(formData.get('medioDePago') ?? 'efectivo'),
    },
    'No pudimos registrar el daño.',
    (r) => {
      const { base, recargo } = r as { base: { idSticker: string }; recargo: { total: string } }
      return `Base ${base.idSticker} marcada como dañada. Se generó un recargo de $${recargo.total}.`
    },
  )
}

/**
 * Descartar una base — RN-BAS-06.
 *
 * El motivo es obligatorio y no es burocracia: después de esto la base sale del
 * parque y nadie vuelve a preguntar por ella. Este texto es lo único que queda
 * para entender qué pasó dentro de tres meses.
 */
export async function descartarBaseAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const baseId = String(formData.get('baseId') ?? '')

  return enviar(
    `/bases/${baseId}/descarte`,
    { motivo: String(formData.get('motivo') ?? '') },
    'No pudimos descartar la base.',
    (r) => `Base ${r.idSticker} fuera del parque. Su historial y sus cargos siguen ahí.`,
  )
}

export type { EstadoDeFormulario }

/**
 * Comprar bases — RN-BAS-10.
 *
 * El aviso dice el RANGO, no «listo». Quien acaba de registrar veinte bases
 * tiene que ir a imprimir veinte stickers, y el dato que necesita para eso es
 * desde qué número hasta cuál.
 */
export async function comprarBasesAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const cantidad = Number(formData.get('cantidad') ?? 0)

  const res = await apiServerFetchRaw('/bases/compra', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cantidad }),
  })

  if (!res.ok) return { error: await mensajeDeError(res, 'No se pudo registrar la compra de bases.') }

  const compradas = (await res.json()) as { idSticker: string }[]
  const primera = compradas[0]?.idSticker
  const ultima = compradas[compradas.length - 1]?.idSticker

  revalidatePath('/modulos/retornables')

  return exito(
    compradas.length === 1
      ? `Entró la base ${primera}.`
      : `Entraron ${compradas.length} bases: de la ${primera} a la ${ultima}.`,
  )
}

/**
 * Qué se sabe de un sticker ANTES de cobrar — RN-BAS-03.
 *
 * `vacio` e `indeterminado` no son estados de la base: son estados de la
 * averiguación. Se distinguen a propósito de `desconocida`, que sí es una
 * afirmación sobre el parque.
 */
export type BaseParaPrestar =
  | { estado: 'disponible'; idSticker: string }
  | { estado: 'prestada'; idSticker: string; clienteNombre: string; etiqueta: string }
  | { estado: 'danada'; idSticker: string }
  | { estado: 'desconocida'; sticker: string }
  | { estado: 'vacio' }
  | { estado: 'indeterminado' }

/**
 * El aviso temprano del código de base — RN-BAS-03.
 *
 * ── Esto NO es la validación ────────────────────────────────────────────────
 *
 * La barrera sigue siendo `api/`: `basePorSticker` y `prestarBaseEn` rechazan
 * la base inexistente, la descartada, la dañada y la que figura en otra
 * dirección, y lo hacen dentro de la transacción de la venta. Acá no se decide
 * nada — se adelanta lo que `api/` va a contestar.
 *
 * ── Por qué vale la pena adelantarlo ────────────────────────────────────────
 *
 * Sin esto, un dedazo en un campo OPCIONAL de cuatro dígitos rebota la venta
 * entera: los productos, el medio de pago y el descuento que ya se cargaron,
 * con el cliente parado enfrente. El costo del error no guarda ninguna relación
 * con su tamaño.
 *
 * ── Por qué la lista entera y no un endpoint nuevo ──────────────────────────
 *
 * `GET /bases` ya devuelve el parque activo con su ubicación resuelta por el
 * JOIN, y son decenas de filas: 0,8 ms medidos para 38. Un endpoint por sticker
 * sería superficie nueva para preguntar lo mismo. Además el rol `seller` ya
 * tiene `bases:ver`, así que no abre ningún permiso.
 */
export async function buscarBaseParaPrestarAction(sticker: string): Promise<BaseParaPrestar> {
  const codigo = sticker.trim()

  if (!codigo) return { estado: 'vacio' }

  let parque: Base[]

  try {
    parque = await apiServerFetch<Base[]>('/bases')
  } catch {
    /*
     * Ni `disponible` ni `desconocida`: las dos mentirían.
     *
     * Un verde falso manda a cobrar una venta que va a rebotar igual, y un rojo
     * falso acusa a un código que puede estar perfecto. El error queda en el
     * log con su `x-request-id`; acá se dice que no se pudo averiguar y quien
     * cobra decide.
     */
    return { estado: 'indeterminado' }
  }

  const base = parque.find((b) => b.idSticker === codigo)

  /*
   * `GET /bases` filtra `activa = true`: una base dada de baja no está en la
   * lista, igual que un código inventado. Desde acá son indistinguibles, y el
   * mensaje los cubre a los dos en vez de afirmar cuál es.
   */
  if (!base) return { estado: 'desconocida', sticker: codigo }

  /*
   * El orden es el de `prestarBaseEn`: primero dónde está, después cómo está.
   *
   * Invertirlo haría que el campo diga «dañada» y que `api/` conteste «prestada
   * en otra dirección» para la misma base — dos diagnósticos para un solo
   * problema, y ninguna forma de saber a cuál hacerle caso.
   */
  if (base.ubicacion !== null) {
    return {
      estado: 'prestada',
      idSticker: base.idSticker,
      clienteNombre: base.ubicacion.clienteNombre,
      etiqueta: base.ubicacion.etiqueta,
    }
  }

  if (base.estado === 'danada') return { estado: 'danada', idSticker: base.idSticker }

  return { estado: 'disponible', idSticker: base.idSticker }
}
