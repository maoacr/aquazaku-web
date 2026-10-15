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

/**
 * Dar de baja botellones rotos — RN-ENV-05.
 *
 * ── Por qué no alcanza con el ajuste ────────────────────────────────────────
 *
 * Son dos hechos distintos y el historial tiene que poder distinguirlos:
 *
 * · **Descarte**: el botellón se rompió. Salió del parque de verdad, y la
 *   cantidad total baja porque hay menos botellones en el mundo.
 * · **Ajuste**: el conteo no cuadra con la realidad. No entró ni salió nada;
 *   se corrige el número.
 *
 * Registrar una rotura como ajuste esconde cuántos envases se están rompiendo
 * —que es justo el número que dice si hay que comprar más— detrás de las
 * diferencias de conteo.
 *
 * `api/` exige además que estén EN BODEGA: no se puede descartar un botellón
 * que está en la casa de un cliente, porque desde acá nadie lo vio romperse.
 */
export async function descartarBotellonesAction(
  _previo: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  return enviar(
    '/botellones/descarte',
    {
      cantidad: Number(formData.get('cantidad') ?? 0),
      motivo: String(formData.get('motivo') ?? '').trim(),
    },
    'No pudimos dar de baja los botellones.',
    (r) => `Dados de baja. Quedan ${r.enBodega} en bodega.`,
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
    {
      idSticker: String(formData.get('idSticker') ?? '').trim(),
      /*
       * Va crudo: si el campo viene vacío, `api` responde 422 con el mensaje
       * del dominio. Poner 'estructura' acá sería el cuarto lugar donde alguien
       * puede inventar un tipo, y el peor, porque nadie lo vería — RN-BAS-14.
       */
      tipo: String(formData.get('tipo') ?? ''),
    },
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
    body: JSON.stringify({ cantidad, tipo: String(formData.get('tipo') ?? '') }),
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
 * El parque activo, para elegir una base en el mostrador — RN-BAS-03.
 *
 * ── Por qué el mostrador las pide y Retornables no ──────────────────────────
 *
 * La pantalla de Retornables ya trae el parque entero para dibujar la lista,
 * así que su desplegable se arma con lo que ya tiene en la mano. El mostrador
 * no: la mayoría de las ventas no se llevan ninguna base, y traerlas en cada
 * carga sería pagar en todas por lo que pasa en pocas. Se piden al ABRIR el
 * panel, igual que las direcciones se piden del cliente ya elegido.
 *
 * ── Por qué la lista entera y no un endpoint de «disponibles» ───────────────
 *
 * `GET /bases` ya devuelve el parque activo con su ubicación resuelta por el
 * JOIN, y son decenas de filas: 0,8 ms medidos para 38. Un endpoint nuevo
 * sería superficie para preguntar lo mismo, y pondría el filtro de «qué se
 * puede entregar» en un segundo lugar — el día que difieran, el mostrador y
 * Retornables ofrecerían cosas distintas. El filtro vive en
 * `basesParaEntregar`, una sola vez. Además el rol `seller` ya tiene
 * `bases:ver`, así que esto no abre ningún permiso.
 *
 * ── `null` no es «no hay» ───────────────────────────────────────────────────
 *
 * Devolver la lista vacía cuando la consulta FALLA afirmaría que la bodega
 * está vacía, y quien cobra dejaría ir al cliente sin la base que sí existe.
 * `null` dice que no se pudo averiguar, que es otra cosa y se cuenta distinto.
 * El error ya quedó en el log con su `x-request-id`.
 */
export async function basesParaEntregarAction(): Promise<Base[] | null> {
  try {
    return await apiServerFetch<Base[]>('/bases')
  } catch {
    return null
  }
}
