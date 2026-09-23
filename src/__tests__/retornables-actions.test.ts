import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ajustarBotellonesAction,
  descartarBotellonesAction,
  comprarBasesAction,
  comprarBotellonesAction,
  darDeAltaBaseAction,
  descartarBaseAction,
  entregarBotellonesAction,
  marcarBaseDanadaAction,
  prestarBaseAction,
  retornarBaseAction,
} from '@/app/(app)/modulos/retornables/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Las mutaciones de retornables — M7.
 *
 * ── Por qué los mensajes dicen números y no «listo» ─────────────────────────
 *
 * Todo este módulo lleva la cuenta de envases físicos que están repartidos por
 * el pueblo. Un «listo» obliga a ir a buscar el saldo a otra pantalla para
 * saber si la cuenta quedó donde tenía que quedar. Cada acción devuelve el
 * saldo resultante, y los tests lo vigilan uno por uno.
 *
 * ── El caso que más se rompe: entrega y retorno son la misma función ────────
 *
 * Un solo formulario, con un campo que decide la dirección del movimiento. Ese
 * campo cambia TRES cosas a la vez —la URL, el mensaje de éxito y el genérico
 * de error—, y si alguna se desincroniza, un retorno se registra como entrega y
 * los botellones del cliente se duplican en vez de volver.
 */

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function respondeSiempre(status: number, body: unknown = {}): void {
  vi.mocked(apiServerFetchRaw).mockImplementation(async () => respuesta(status, body))
}

function ultimoPedido(): { url: string; metodo: string; body: Record<string, unknown> } {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return {
    url: llamada[0],
    metodo: String(init.method),
    body: init.body ? JSON.parse(String(init.body)) : {},
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('comprarBotellonesAction()', () => {
  it('va por POST a la compra de botellones, con la cantidad como número', async () => {
    respondeSiempre(201, { enBodega: 120 })

    await comprarBotellonesAction({}, form({ cantidad: '20' }))

    expect(ultimoPedido().url).toBe('/botellones/compra')
    expect(ultimoPedido().metodo).toBe('POST')
    expect(ultimoPedido().body.cantidad).toBe(20)
  })

  /*
   * El motivo vacío se convierte en `undefined`, y `JSON.stringify` lo borra.
   * Mandar `''` dejaría un motivo en blanco guardado, que es peor que ninguno:
   * parece que alguien escribió algo y se perdió.
   */
  it('sin motivo no manda la clave en blanco', async () => {
    respondeSiempre(201, { enBodega: 120 })

    await comprarBotellonesAction({}, form({ cantidad: '20', motivo: '   ' }))

    expect(ultimoPedido().body).not.toHaveProperty('motivo')
  })

  it('con motivo lo manda recortado', async () => {
    respondeSiempre(201, { enBodega: 120 })

    await comprarBotellonesAction({}, form({ cantidad: '20', motivo: '  compra al proveedor  ' }))

    expect(ultimoPedido().body.motivo).toBe('compra al proveedor')
  })

  it('el mensaje dice cuántos quedan en bodega, no solo que entraron', async () => {
    respondeSiempre(201, { enBodega: 120 })

    const estado = await comprarBotellonesAction({}, form({ cantidad: '20' }))

    expect(estado.ok).toBe('Entraron al parque. Quedan 120 en bodega.')
  })
})

/**
 * Entrega y retorno: un formulario, dos direcciones.
 *
 * El campo `direccion` cambia la URL, el mensaje y el genérico de error. Los
 * tres tienen que moverse juntos.
 */
describe('entregarBotellonesAction()', () => {
  const SALDOS = { enPoderDelCliente: 5, enBodega: 115 }

  it('una entrega va al endpoint de entrega', async () => {
    respondeSiempre(201, SALDOS)

    await entregarBotellonesAction({}, form({ clienteId: 'cli-1', cantidad: '2' }))

    expect(ultimoPedido().url).toBe('/botellones/entrega')
  })

  it('un retorno va al endpoint de retorno', async () => {
    respondeSiempre(201, SALDOS)

    await entregarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', cantidad: '2', direccion: 'retorno' }),
    )

    expect(ultimoPedido().url).toBe('/botellones/retorno')
  })

  it('cualquier valor que no sea «retorno» es una entrega', async () => {
    respondeSiempre(201, SALDOS)

    await entregarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', cantidad: '2', direccion: 'entrega' }),
    )

    expect(ultimoPedido().url).toBe('/botellones/entrega')
  })

  it('manda cliente y cantidad, y nada más: la dirección ya está en la URL', async () => {
    respondeSiempre(201, SALDOS)

    await entregarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', cantidad: '2', direccion: 'retorno' }),
    )

    expect(ultimoPedido().body).toEqual({ clienteId: 'cli-1', cantidad: 2 })
  })

  it('el mensaje de la entrega dice los dos saldos: el del cliente y el de bodega', async () => {
    respondeSiempre(201, SALDOS)

    const estado = await entregarBotellonesAction({}, form({ clienteId: 'cli-1', cantidad: '2' }))

    expect(estado.ok).toBe('Entrega registrada. El cliente queda con 5 y la bodega con 115.')
  })

  it('el mensaje del retorno dice «Retorno», no «Entrega»', async () => {
    respondeSiempre(201, SALDOS)

    const estado = await entregarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', cantidad: '2', direccion: 'retorno' }),
    )

    expect(estado.ok).toMatch(/^Retorno registrada/)
  })

  it('el genérico de error también sigue la dirección', async () => {
    vi.mocked(apiServerFetchRaw).mockImplementation(async () => new Response('', { status: 500 }))

    const entrega = await entregarBotellonesAction({}, form({ clienteId: 'cli-1', cantidad: '2' }))
    const retorno = await entregarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', cantidad: '2', direccion: 'retorno' }),
    )

    expect(entrega.error).toBe('No pudimos registrar la entrega.')
    expect(retorno.error).toBe('No pudimos registrar el retorno.')
  })

  /*
   * Los 422 de este módulo llevan el número real —cuántos figuran en poder del
   * cliente— y dicen qué falta registrar. Reescribirlos perdería el número.
   */
  it('un 422 pasa el mensaje de api/ con su número', async () => {
    respondeSiempre(422, { mensaje: 'El cliente tiene 3 botellones: no puede devolver 5.' })

    const estado = await entregarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', cantidad: '5', direccion: 'retorno' }),
    )

    expect(estado.error).toBe('El cliente tiene 3 botellones: no puede devolver 5.')
  })

  it('un 409 también pasa su mensaje tal cual', async () => {
    respondeSiempre(409, { mensaje: 'No hay botellones suficientes en bodega.' })

    const estado = await entregarBotellonesAction({}, form({ clienteId: 'cli-1', cantidad: '500' }))

    expect(estado.error).toBe('No hay botellones suficientes en bodega.')
  })
})

/**
 * El ajuste, que sirve para dos cosas distintas.
 *
 * Con cliente ajusta lo que esa persona tiene; sin cliente ajusta la bodega. La
 * diferencia es la presencia de la clave, no un campo aparte.
 */
describe('ajustarBotellonesAction()', () => {
  it('con cliente, manda el cliente', async () => {
    respondeSiempre(200, { saldo: 4 })

    await ajustarBotellonesAction(
      {},
      form({ clienteId: 'cli-1', diferencia: '-1', motivo: 'se rompió uno' }),
    )

    expect(ultimoPedido().body).toMatchObject({ clienteId: 'cli-1', diferencia: -1 })
  })

  it('sin cliente NO manda la clave: eso lo vuelve un ajuste de bodega', async () => {
    respondeSiempre(200, { saldo: 118 })

    await ajustarBotellonesAction({}, form({ diferencia: '-2', motivo: 'conteo de bodega' }))

    expect(ultimoPedido().body).not.toHaveProperty('clienteId')
  })

  it('el motivo viaja recortado', async () => {
    respondeSiempre(200, { saldo: 4 })

    await ajustarBotellonesAction({}, form({ diferencia: '-1', motivo: '  conteo  ' }))

    expect(ultimoPedido().body.motivo).toBe('conteo')
  })

  it('el mensaje dice en cuánto quedó el saldo', async () => {
    respondeSiempre(200, { saldo: 118 })

    const estado = await ajustarBotellonesAction({}, form({ diferencia: '-2', motivo: 'conteo' }))

    expect(estado.ok).toBe('Ajuste registrado. El saldo queda en 118.')
  })
})

describe('las bases, una por una', () => {
  it('darDeAltaBaseAction() manda el sticker recortado', async () => {
    respondeSiempre(201, { idSticker: '0042' })

    await darDeAltaBaseAction({}, form({ idSticker: '  0042  ' }))

    expect(ultimoPedido().url).toBe('/bases')
    expect(ultimoPedido().body).toEqual({ idSticker: '0042' })
  })

  it('darDeAltaBaseAction() confirma con el sticker que devolvió api/', async () => {
    respondeSiempre(201, { idSticker: '0042' })

    const estado = await darDeAltaBaseAction({}, form({ idSticker: '0042' }))

    expect(estado.ok).toBe('Base 0042 dada de alta.')
  })

  /*
   * RN-BAS-03: una base se presta a una DIRECCIÓN, no a un cliente. Prestarla a
   * un cliente dejaría sin saber a cuál de sus casas ir a reclamarla.
   */
  it('prestarBaseAction() presta a una dirección, no a un cliente', async () => {
    respondeSiempre(200, { idSticker: '0042' })

    await prestarBaseAction({}, form({ baseId: 'base-1', direccionId: 'dir-7' }))

    expect(ultimoPedido().url).toBe('/bases/base-1/prestamo')
    expect(ultimoPedido().body).toEqual({ direccionId: 'dir-7' })
  })

  it('retornarBaseAction() no manda cuerpo: la base vuelve de donde estaba', async () => {
    respondeSiempre(200, { idSticker: '0042' })

    await retornarBaseAction({}, form({ baseId: 'base-1' }))

    expect(ultimoPedido().url).toBe('/bases/base-1/retorno')
    expect(ultimoPedido().body).toEqual({})
  })

  it('retornarBaseAction() confirma que está en la bodega', async () => {
    respondeSiempre(200, { idSticker: '0042' })

    const estado = await retornarBaseAction({}, form({ baseId: 'base-1' }))

    expect(estado.ok).toBe('Base 0042 de vuelta en la bodega.')
  })
})

/**
 * Marcar una base como dañada — RN-BAS-08.
 *
 * El monto va explícito y sin default: es plata que se le cobra a un cliente
 * real, e inventar un número sería peor que pedirlo.
 */
describe('marcarBaseDanadaAction()', () => {
  const DANO = {
    base: { idSticker: '0042' },
    recargo: { total: '35.000' },
  }

  it('va por POST al daño de esa base', async () => {
    respondeSiempre(201, DANO)

    await marcarBaseDanadaAction(
      {},
      form({ baseId: 'base-1', monto: '35000', motivo: 'llegó partida' }),
    )

    expect(ultimoPedido().url).toBe('/bases/base-1/dano')
  })

  it('el monto viaja como texto recortado, no como número', async () => {
    respondeSiempre(201, DANO)

    await marcarBaseDanadaAction(
      {},
      form({ baseId: 'base-1', monto: '  35000  ', motivo: 'llegó partida' }),
    )

    expect(ultimoPedido().body.monto).toBe('35000')
  })

  it('sin medio de pago elegido asume efectivo', async () => {
    respondeSiempre(201, DANO)

    await marcarBaseDanadaAction({}, form({ baseId: 'base-1', monto: '35000', motivo: 'x' }))

    expect(ultimoPedido().body.medioDePago).toBe('efectivo')
  })

  it('el mensaje dice cuánto se le recargó, no solo que quedó dañada', async () => {
    respondeSiempre(201, DANO)

    const estado = await marcarBaseDanadaAction(
      {},
      form({ baseId: 'base-1', monto: '35000', motivo: 'llegó partida' }),
    )

    expect(estado.ok).toBe('Base 0042 marcada como dañada. Se generó un recargo de $35.000.')
  })
})

/**
 * Descartar una base — RN-BAS-06.
 *
 * Después de esto la base sale del parque y nadie vuelve a preguntar por ella.
 * El motivo es lo único que queda para entender qué pasó dentro de tres meses.
 */
describe('descartarBaseAction()', () => {
  it('va por POST al descarte, con el motivo', async () => {
    respondeSiempre(200, { idSticker: '0042' })

    await descartarBaseAction({}, form({ baseId: 'base-1', motivo: 'fondo partido' }))

    expect(ultimoPedido().url).toBe('/bases/base-1/descarte')
    expect(ultimoPedido().body).toEqual({ motivo: 'fondo partido' })
  })

  /*
   * El mensaje aclara que el historial NO se va. Sin eso, «fuera del parque»
   * se lee como «se borró», y quien tenía un cargo pendiente contra esa base
   * creería que lo perdió.
   */
  it('aclara que el historial y los cargos siguen ahí', async () => {
    respondeSiempre(200, { idSticker: '0042' })

    const estado = await descartarBaseAction({}, form({ baseId: 'base-1', motivo: 'x' }))

    expect(estado.ok).toMatch(/historial y sus cargos siguen/)
  })
})

/**
 * Comprar bases — RN-BAS-10.
 *
 * El aviso dice el RANGO, no «listo». Quien acaba de registrar veinte bases
 * tiene que ir a imprimir veinte stickers, y lo que necesita para eso es desde
 * qué número hasta cuál.
 */
describe('comprarBasesAction()', () => {
  it('va por POST a la compra de bases', async () => {
    respondeSiempre(201, [{ idSticker: '0041' }, { idSticker: '0042' }])

    await comprarBasesAction({}, form({ cantidad: '2' }))

    expect(ultimoPedido().url).toBe('/bases/compra')
    expect(ultimoPedido().body).toEqual({ cantidad: 2 })
  })

  it('con varias dice el rango: de la primera a la última', async () => {
    respondeSiempre(201, [
      { idSticker: '0041' },
      { idSticker: '0042' },
      { idSticker: '0043' },
    ])

    const estado = await comprarBasesAction({}, form({ cantidad: '3' }))

    expect(estado.ok).toBe('Entraron 3 bases: de la 0041 a la 0043.')
  })

  it('con una sola no habla de rango', async () => {
    respondeSiempre(201, [{ idSticker: '0041' }])

    const estado = await comprarBasesAction({}, form({ cantidad: '1' }))

    expect(estado.ok).toBe('Entró la base 0041.')
  })

  it('refresca la pantalla de retornables', async () => {
    respondeSiempre(201, [{ idSticker: '0041' }])

    await comprarBasesAction({}, form({ cantidad: '1' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/retornables')
  })

  it('tiene su propio genérico de error', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await comprarBasesAction({}, form({ cantidad: '2' }))

    expect(estado.error).toBe('No se pudo registrar la compra de bases.')
  })
})

describe('los errores compartidos', () => {
  it('un 403 dice que no tiene permiso', async () => {
    respondeSiempre(403, {})

    const estado = await darDeAltaBaseAction({}, form({ idSticker: '0042' }))

    expect(estado.error).toBe('No tiene permiso para hacer esto.')
  })

  it('cuando falla no refresca la pantalla', async () => {
    respondeSiempre(500, {})

    await darDeAltaBaseAction({}, form({ idSticker: '0042' }))

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('un error NO trae token: lo escrito se conserva', async () => {
    respondeSiempre(500, {})

    const estado = await descartarBaseAction({}, form({ baseId: 'base-1', motivo: 'x' }))

    expect(estado.token).toBeUndefined()
  })
})

/**
 * Dar de baja botellones rotos — RN-ENV-05.
 *
 * ── Lo que este bloque vigila de verdad ─────────────────────────────────────
 *
 * Que el descarte NO termine pegándole al ajuste. Son dos endpoints distintos
 * porque son dos hechos distintos: uno saca botellones del parque, el otro
 * corrige un conteo. Si el formulario de «dar de baja» mandara al ajuste, la
 * pantalla se vería igual y el historial dejaría de poder responder cuántos
 * envases se rompen al mes — que es el número que dice cuándo comprar más.
 *
 * La URL es la mitad del contrato, y es la mitad que ningún test de componente
 * mira.
 */
describe('descartarBotellonesAction()', () => {
  it('pega al endpoint del descarte, no al del ajuste', async () => {
    respondeSiempre(201, { enBodega: 115 })

    await descartarBotellonesAction({}, form({ cantidad: '3', motivo: 'se rompieron en el lavado' }))

    expect(ultimoPedido().url).toBe('/botellones/descarte')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('la cantidad viaja como número, no como el texto del input', async () => {
    respondeSiempre(201, { enBodega: 115 })

    await descartarBotellonesAction({}, form({ cantidad: '3', motivo: 'se rompieron' }))

    expect(ultimoPedido().body).toMatchObject({ cantidad: 3, motivo: 'se rompieron' })
  })

  it('el motivo viaja recortado', async () => {
    respondeSiempre(201, { enBodega: 115 })

    await descartarBotellonesAction({}, form({ cantidad: '1', motivo: '  se rajó  ' }))

    expect(ultimoPedido().body.motivo).toBe('se rajó')
  })

  it('el mensaje dice cuántos quedan en bodega', async () => {
    respondeSiempre(201, { enBodega: 115 })

    const estado = await descartarBotellonesAction({}, form({ cantidad: '3', motivo: 'rotos' }))

    expect(estado.ok).toBe('Dados de baja. Quedan 115 en bodega.')
  })

  /*
   * El rechazo de `api/` llega tal cual: dice cuántos hay en bodega y cuántos
   * se están descartando. Un genérico obligaría a ir a contar a otra pantalla.
   */
  it('si no alcanzan en bodega, se muestra lo que dijo el servidor', async () => {
    respondeSiempre(422, { mensaje: 'en la bodega hay 2 botellones y se están descartando 5' })

    const estado = await descartarBotellonesAction({}, form({ cantidad: '5', motivo: 'rotos' }))

    expect(estado.error).toMatch(/hay 2 botellones/)
  })
})
