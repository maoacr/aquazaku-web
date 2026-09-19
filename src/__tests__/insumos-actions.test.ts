import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ajustarInsumoAction,
  cargarEquivalenciaAction,
  crearInsumoAction,
  descartarInsumoAction,
  registrarEntradaAction,
} from '@/app/(app)/modulos/insumos/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Mutaciones de la pantalla de insumos — M3.
 *
 * ── La distinción que sostiene todo el archivo ──────────────────────────────
 *
 * `{ ok: false }` NO es un fallo. Es que no alcanzaba, y viene con el número
 * disponible para poder decirlo: «hay 3 unidades». Tratarlo como error genérico
 * le sacaría a quien carga la compra el único dato que necesita.
 *
 * ── Y la otra: kilos no son unidades ────────────────────────────────────────
 *
 * Una compra se registra en kilos cuando hay equivalencia medida y en unidades
 * cuando no. Mandar kilos por el campo `cantidad` multiplicaría el inventario
 * por el peso de una tapa.
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

const ALCANZO = { ok: true, saldo: 42 }

afterEach(() => {
  vi.clearAllMocks()
})

describe('crearInsumoAction()', () => {
  it('va por POST a la colección de insumos', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: 'tap', nombre: 'Tapas', minimo: '100' }))

    expect(ultimoPedido().url).toBe('/insumos')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  /*
   * El código viaja en mayúsculas siempre. Si dependiera de cómo lo escribieron,
   * «tap» y «TAP» serían dos insumos distintos con el mismo nombre, y el stock
   * quedaría partido entre los dos.
   */
  it('el código viaja en mayúsculas: «tap» y «TAP» son el mismo insumo', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: '  tap  ', nombre: 'Tapas' }))

    expect(ultimoPedido().body.codigo).toBe('TAP')
  })

  it('el nombre viaja recortado pero sin tocarle las mayúsculas', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: 'TAP', nombre: '  Tapas de rosca  ' }))

    expect(ultimoPedido().body.nombre).toBe('Tapas de rosca')
  })

  it('el mínimo viaja como número, no como texto', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'Tapas', minimo: '100' }))

    expect(ultimoPedido().body.minimo).toBe(100)
  })

  it('sin mínimo asume cero: no tener mínimo es un mínimo de cero', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'Tapas' }))

    expect(ultimoPedido().body.minimo).toBe(0)
  })

  /*
   * La equivalencia se mide en planta. Mientras no exista, el campo va en null
   * —que es lo correcto— y la compra en kilos queda deshabilitada. Un cero
   * fingiría una medición y haría que un kilo valga cero unidades.
   */
  it('sin equivalencia no manda la clave: la medición todavía no existe', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'Tapas', equivalenciaPorKilo: '' }))

    expect(ultimoPedido().body).not.toHaveProperty('equivalenciaPorKilo')
  })

  it('con equivalencia la manda como número', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction(
      {},
      form({ codigo: 'TAP', nombre: 'Tapas', equivalenciaPorKilo: '450' }),
    )

    expect(ultimoPedido().body.equivalenciaPorKilo).toBe(450)
  })

  it('refresca la pantalla de insumos', async () => {
    respondeSiempre(201, {})

    await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'Tapas' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/insumos')
  })
})

describe('registrarEntradaAction() — kilos y unidades no se mezclan', () => {
  it('en kilos manda `kilos`, no `cantidad`', async () => {
    respondeSiempre(200, ALCANZO)

    await registrarEntradaAction({}, form({ insumoId: 'ins-1', medida: 'kilo', valor: '12' }))

    const { body } = ultimoPedido()
    expect(body).toEqual({ kilos: 12 })
    expect(body).not.toHaveProperty('cantidad')
  })

  it('en unidades manda `cantidad`, no `kilos`', async () => {
    respondeSiempre(200, ALCANZO)

    await registrarEntradaAction({}, form({ insumoId: 'ins-1', medida: 'unidad', valor: '500' }))

    const { body } = ultimoPedido()
    expect(body).toEqual({ cantidad: 500 })
    expect(body).not.toHaveProperty('kilos')
  })

  it('sin medida elegida asume unidades, que es lo que no necesita equivalencia', async () => {
    respondeSiempre(200, ALCANZO)

    await registrarEntradaAction({}, form({ insumoId: 'ins-1', valor: '500' }))

    expect(ultimoPedido().body).toEqual({ cantidad: 500 })
  })

  it('va por POST a la entrada de ese insumo', async () => {
    respondeSiempre(200, ALCANZO)

    await registrarEntradaAction({}, form({ insumoId: 'ins-1', valor: '500' }))

    expect(ultimoPedido().url).toBe('/insumos/ins-1/entrada')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('el éxito dice cuánto queda, que es lo que se va a mirar después', async () => {
    respondeSiempre(200, { ok: true, saldo: 542 })

    const estado = await registrarEntradaAction({}, form({ insumoId: 'ins-1', valor: '500' }))

    expect(estado.ok).toBe('Entrada registrada. Quedan 542 unidades.')
  })

  /*
   * El caso que más importa de esta pantalla: comprar en kilos sin haber medido
   * la equivalencia. El mensaje de `api/` dice qué hay que ir a medir, así que
   * se usa TAL CUAL — reescribirlo acá deja dos textos que se desincronizan.
   */
  it('SIN_EQUIVALENCIA pasa el mensaje de api/ tal cual: dice qué hay que medir', async () => {
    respondeSiempre(422, {
      code: 'SIN_EQUIVALENCIA',
      mensaje: 'Pese un kilo de tapas y cargue cuántas son antes de comprar en kilos.',
    })

    const estado = await registrarEntradaAction(
      {},
      form({ insumoId: 'ins-1', medida: 'kilo', valor: '12' }),
    )

    expect(estado.error).toBe('Pese un kilo de tapas y cargue cuántas son antes de comprar en kilos.')
  })
})

/**
 * «No alcanza» no es un error del sistema.
 *
 * Viene con el número disponible justamente para poder decirlo. Un mensaje
 * genérico le sacaría a quien está descontando el único dato que le sirve.
 */
describe('cuando no alcanza', () => {
  it('lo dice con el número disponible, no con un error genérico', async () => {
    respondeSiempre(200, { ok: false, disponible: 3 })

    const estado = await ajustarInsumoAction(
      {},
      form({ insumoId: 'ins-1', diferencia: '-50', motivo: 'conteo' }),
    )

    expect(estado.error).toBe('No alcanza: hay 3 unidades.')
  })

  it('con una sola unidad lo dice en singular', async () => {
    respondeSiempre(200, { ok: false, disponible: 1 })

    const estado = await ajustarInsumoAction(
      {},
      form({ insumoId: 'ins-1', diferencia: '-50', motivo: 'conteo' }),
    )

    expect(estado.error).toBe('No alcanza: hay 1 unidad.')
  })

  it('con cero lo dice en plural: «hay 0 unidades»', async () => {
    respondeSiempre(200, { ok: false, disponible: 0 })

    const estado = await ajustarInsumoAction(
      {},
      form({ insumoId: 'ins-1', diferencia: '-50', motivo: 'conteo' }),
    )

    expect(estado.error).toBe('No alcanza: hay 0 unidades.')
  })

  /*
   * No se refresca la pantalla: no cambió nada. Y no hay token, así que el
   * motivo escrito se conserva para corregir la cantidad sin reescribirlo.
   */
  it('no refresca la pantalla ni limpia el formulario: no pasó nada', async () => {
    respondeSiempre(200, { ok: false, disponible: 3 })

    const estado = await ajustarInsumoAction(
      {},
      form({ insumoId: 'ins-1', diferencia: '-50', motivo: 'conteo' }),
    )

    expect(revalidatePath).not.toHaveBeenCalled()
    expect(estado.token).toBeUndefined()
  })
})

describe('ajustarInsumoAction()', () => {
  it('va por POST al ajuste, con la diferencia como número', async () => {
    respondeSiempre(200, ALCANZO)

    await ajustarInsumoAction(
      {},
      form({ insumoId: 'ins-1', diferencia: '-8', motivo: '  conteo del lunes  ' }),
    )

    expect(ultimoPedido().url).toBe('/insumos/ins-1/ajuste')
    expect(ultimoPedido().body).toEqual({ diferencia: -8, motivo: 'conteo del lunes' })
  })

  it('el éxito dice el saldo que quedó', async () => {
    respondeSiempre(200, { ok: true, saldo: 34 })

    const estado = await ajustarInsumoAction(
      {},
      form({ insumoId: 'ins-1', diferencia: '-8', motivo: 'conteo' }),
    )

    expect(estado.ok).toBe('Ajuste registrado. Quedan 34 unidades.')
  })
})

describe('descartarInsumoAction()', () => {
  it('va por POST al descarte, con cantidad y causa', async () => {
    respondeSiempre(200, ALCANZO)

    await descartarInsumoAction({}, form({ insumoId: 'ins-1', cantidad: '5', causa: 'vencido' }))

    expect(ultimoPedido().url).toBe('/insumos/ins-1/descarte')
    expect(ultimoPedido().body).toMatchObject({ cantidad: 5, causa: 'vencido' })
  })

  it('sin observaciones no manda la clave vacía', async () => {
    respondeSiempre(200, ALCANZO)

    await descartarInsumoAction(
      {},
      form({ insumoId: 'ins-1', cantidad: '5', causa: 'vencido', observaciones: '  ' }),
    )

    expect(ultimoPedido().body).not.toHaveProperty('observaciones')
  })

  it('con observaciones las manda recortadas', async () => {
    respondeSiempre(200, ALCANZO)

    await descartarInsumoAction(
      {},
      form({ insumoId: 'ins-1', cantidad: '5', causa: 'otro', observaciones: '  se mojaron  ' }),
    )

    expect(ultimoPedido().body.observaciones).toBe('se mojaron')
  })
})

describe('cargarEquivalenciaAction()', () => {
  it('va por PATCH al insumo, con la equivalencia como número', async () => {
    respondeSiempre(200, {})

    await cargarEquivalenciaAction({}, form({ insumoId: 'ins-1', equivalenciaPorKilo: '450' }))

    expect(ultimoPedido().url).toBe('/insumos/ins-1')
    expect(ultimoPedido().metodo).toBe('PATCH')
    expect(ultimoPedido().body).toEqual({ equivalenciaPorKilo: 450 })
  })

  /*
   * El mensaje explica qué se desbloqueó. Cargar la equivalencia no es un dato
   * más: es lo que habilita registrar la compra en kilos, que es como llega la
   * factura del proveedor.
   */
  it('el mensaje dice qué se desbloqueó, no solo que se guardó', async () => {
    respondeSiempre(200, {})

    const estado = await cargarEquivalenciaAction(
      {},
      form({ insumoId: 'ins-1', equivalenciaPorKilo: '450' }),
    )

    expect(estado.ok).toMatch(/en kilos/)
  })

  it('refresca la pantalla de insumos', async () => {
    respondeSiempre(200, {})

    await cargarEquivalenciaAction({}, form({ insumoId: 'ins-1', equivalenciaPorKilo: '450' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/insumos')
  })
})

describe('los errores que se traducen', () => {
  it('un insumo que ya no existe se dice con esas palabras', async () => {
    respondeSiempre(404, { code: 'INSUMO_NO_ENCONTRADO' })

    const estado = await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'Tapas' }))

    expect(estado.error).toBe('Ese insumo ya no existe.')
  })

  it('un 403 dice que no tiene permiso', async () => {
    respondeSiempre(403, {})

    const estado = await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'Tapas' }))

    expect(estado.error).toBe('No tiene permiso para hacer esto.')
  })

  it('cada acción cae a su propio genérico, no a uno compartido', async () => {
    vi.mocked(apiServerFetchRaw).mockImplementation(
      async () => new Response('<html>502</html>', { status: 502 }),
    )

    const creado = await crearInsumoAction({}, form({ codigo: 'TAP', nombre: 'T' }))
    const entrada = await registrarEntradaAction({}, form({ insumoId: 'ins-1', valor: '1' }))
    const descarte = await descartarInsumoAction({}, form({ insumoId: 'ins-1', cantidad: '1' }))

    expect(creado.error).toBe('No pudimos crear el insumo.')
    expect(entrada.error).toBe('No pudimos registrar la entrada.')
    expect(descarte.error).toBe('No pudimos registrar el descarte.')
  })
})
