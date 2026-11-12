import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  anularMovimientoAction,
  cambiarEstadoDeCuentaAction,
  crearCuentaBancariaAction,
  registrarGastoAction,
  registrarIngresoAction,
  registrarSaldoInicialAction,
} from '@/app/(app)/modulos/gastos/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Las mutaciones de gastos y tesorería — M16.
 *
 * ── Qué se afirma acá, y por qué no el render ───────────────────────────────
 *
 * Lo que puede romperse en silencio es **el cuerpo que viaja**. Si un campo
 * opcional se manda como `''` en vez de omitirse, `api/` lo valida como un uuid
 * vacío y devuelve un 422 que la pantalla muestra como «no pudimos registrar el
 * gasto» — sin decir qué campo. Y si la URL se equivoca, un ingreso se registra
 * como egreso: la plata se mueve en la dirección contraria y el saldo queda
 * mal por el doble del monto.
 *
 * Por eso cada test mira la URL, el método y el JSON. El render de estos
 * formularios no decide nada de eso.
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

/** La URL, el método y el cuerpo con el que se llamó a `api/`. */
function loQueViajo(): { url: string; metodo: string; cuerpo: Record<string, unknown> } {
  const [url, opciones] = vi.mocked(apiServerFetchRaw).mock.calls[0] as [string, RequestInit]

  return {
    url,
    metodo: String(opciones.method),
    cuerpo: JSON.parse(String(opciones.body)) as Record<string, unknown>,
  }
}

const UN_GASTO = {
  cuentaId: '11111111-1111-1111-1111-111111111111',
  tipoDeEgreso: 'recibo_publico',
  monto: '80000',
  ocurridoEl: '2026-11-10',
  concepto: 'Recibo de la luz de octubre',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('registrar un gasto', () => {
  it('manda los cinco campos obligatorios al endpoint de egresos', async () => {
    respondeSiempre(201, { monto: '80000.00' })

    await registrarGastoAction({}, form(UN_GASTO))

    expect(loQueViajo()).toMatchObject({
      url: '/gastos/egresos',
      metodo: 'POST',
      cuerpo: UN_GASTO,
    })
  })

  /*
   * El caso que rompe en silencio. Un `proveedorId: ''` lo rechaza el esquema
   * de zod como uuid inválido, y el error que llega a la pantalla habla de un
   * campo que la persona dejó vacío a propósito.
   */
  it('omite los opcionales vacíos en vez de mandarlos como cadena vacía', async () => {
    respondeSiempre(201, { monto: '80000.00' })

    await registrarGastoAction(
      {},
      form({ ...UN_GASTO, proveedorId: '', beneficiario: '  ', numeroDeFactura: '' }),
    )

    const { cuerpo } = loQueViajo()

    expect(cuerpo).not.toHaveProperty('proveedorId')
    expect(cuerpo).not.toHaveProperty('beneficiario')
    expect(cuerpo).not.toHaveProperty('numeroDeFactura')
  })

  it('manda los opcionales cuando sí los cargaron, sin espacios de sobra', async () => {
    respondeSiempre(201, { monto: '50000.00' })

    await registrarGastoAction(
      {},
      form({
        ...UN_GASTO,
        proveedorId: '22222222-2222-2222-2222-222222222222',
        beneficiario: '  el electricista  ',
        numeroDeFactura: ' FV-1024 ',
      }),
    )

    expect(loQueViajo().cuerpo).toMatchObject({
      proveedorId: '22222222-2222-2222-2222-222222222222',
      beneficiario: 'el electricista',
      numeroDeFactura: 'FV-1024',
    })
  })

  it('el éxito dice el monto registrado, formateado en pesos', async () => {
    respondeSiempre(201, { monto: '80000.00' })

    const estado = await registrarGastoAction({}, form(UN_GASTO))

    expect(estado.ok).toContain('80.000')
    expect(estado.token).toBeTruthy()
    expect(revalidatePath).toHaveBeenCalledWith('/modulos/gastos')
  })

  /*
   * El mensaje de `api/` pasa tal cual: es el que explica QUÉ falta —cuánto
   * saldo hay, por qué no alcanza—. Reemplazarlo por un genérico dejaría a la
   * persona sin saber qué corregir.
   */
  it('un saldo insuficiente muestra el mensaje de `api/`, no un genérico', async () => {
    respondeSiempre(422, {
      code: 'SALDO_INSUFICIENTE',
      mensaje: 'Caja menor tiene 50000.00 y el gasto es de 80000.00',
    })

    const estado = await registrarGastoAction({}, form(UN_GASTO))

    expect(estado.error).toBe('Caja menor tiene 50000.00 y el gasto es de 80000.00')
    expect(estado.ok).toBeUndefined()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('si `api/` no devuelve JSON, queda el genérico y no una excepción', async () => {
    vi.mocked(apiServerFetchRaw).mockImplementation(
      async () => new Response('502 Bad Gateway', { status: 502 }),
    )

    const estado = await registrarGastoAction({}, form(UN_GASTO))

    expect(estado.error).toBe('No pudimos registrar el gasto.')
  })
})

/*
 * ── Las tres puertas del libro comparten los campos y NO la URL ─────────────
 *
 * Es el modo de falla que más caro sale: con la URL equivocada un ingreso se
 * escribe como egreso, y el saldo queda mal por el DOBLE del monto —falta lo
 * que debía entrar y sobra lo que salió—. Y no falla nada: las dos rutas
 * aceptan el mismo cuerpo salvo el subtipo.
 */
describe('cada puerta del libro pega en su propio endpoint', () => {
  it('el ingreso va a `/gastos/ingresos` con su tipo de ingreso', async () => {
    respondeSiempre(201, { monto: '250000.00' })

    await registrarIngresoAction(
      {},
      form({
        cuentaId: UN_GASTO.cuentaId,
        tipoDeIngreso: 'recaudo_de_ventas',
        monto: '250000',
        ocurridoEl: '2026-11-10',
        concepto: 'Efectivo de las ventas del lunes',
      }),
    )

    const { url, cuerpo } = loQueViajo()

    expect(url).toBe('/gastos/ingresos')
    expect(cuerpo).toMatchObject({ tipoDeIngreso: 'recaudo_de_ventas', monto: '250000' })
    expect(cuerpo).not.toHaveProperty('tipoDeEgreso')
  })

  it('el saldo inicial va a `/gastos/saldo-inicial` y no lleva subtipo', async () => {
    respondeSiempre(201, { monto: '500000.00' })

    await registrarSaldoInicialAction(
      {},
      form({
        cuentaId: UN_GASTO.cuentaId,
        monto: '500000',
        ocurridoEl: '2026-11-10',
        concepto: 'Lo que había en la caja al empezar',
      }),
    )

    const { url, cuerpo } = loQueViajo()

    expect(url).toBe('/gastos/saldo-inicial')
    expect(cuerpo).not.toHaveProperty('tipoDeEgreso')
    expect(cuerpo).not.toHaveProperty('tipoDeIngreso')
  })

  it('cargar dos veces el saldo inicial muestra lo que dice `api/`', async () => {
    respondeSiempre(422, {
      code: 'SALDO_INICIAL_YA_CARGADO',
      mensaje: 'Caja menor ya tiene su saldo inicial cargado',
    })

    const estado = await registrarSaldoInicialAction(
      {},
      form({
        cuentaId: UN_GASTO.cuentaId,
        monto: '500000',
        ocurridoEl: '2026-11-10',
        concepto: 'otra vez',
      }),
    )

    expect(estado.error).toBe('Caja menor ya tiene su saldo inicial cargado')
  })
})

describe('anular un movimiento', () => {
  it('manda el motivo al endpoint de anulación del movimiento', async () => {
    respondeSiempre(200, { monto: '80000.00' })

    await anularMovimientoAction(
      {},
      form({ movimientoId: 'abc-123', motivo: 'lo cargué en la caja equivocada' }),
    )

    expect(loQueViajo()).toMatchObject({
      url: '/gastos/movimientos/abc-123/anulacion',
      metodo: 'POST',
      cuerpo: { motivo: 'lo cargué en la caja equivocada' },
    })
  })

  it('anular un ingreso cuya plata ya se gastó muestra el mensaje de `api/`', async () => {
    respondeSiempre(422, {
      code: 'ANULAR_DEJARIA_SALDO_NEGATIVO',
      mensaje: 'anular eso dejaría Caja menor en -400000.00',
    })

    const estado = await anularMovimientoAction({}, form({ movimientoId: 'abc', motivo: 'no va' }))

    expect(estado.error).toBe('anular eso dejaría Caja menor en -400000.00')
  })
})

describe('las cuentas', () => {
  it('la cuenta bancaria viaja con sus cuatro datos', async () => {
    respondeSiempre(201, { nombre: 'Bancolombia ahorros' })

    await crearCuentaBancariaAction(
      {},
      form({
        nombre: 'Bancolombia ahorros',
        banco: 'Bancolombia',
        numero: '123-456789-01',
        tipoDeCuentaBancaria: 'ahorros',
      }),
    )

    expect(loQueViajo()).toMatchObject({
      url: '/cuentas',
      metodo: 'POST',
      cuerpo: {
        nombre: 'Bancolombia ahorros',
        banco: 'Bancolombia',
        numero: '123-456789-01',
        tipoDeCuentaBancaria: 'ahorros',
      },
    })
  })

  /*
   * El `activa` del formulario viaja como `'si'`/`'no'` y tiene que llegar como
   * booleano: `{ activa: 'no' }` es truthy, así que un error acá ACTIVARÍA la
   * cuenta que se quiso dar de baja.
   */
  it('dar de baja manda `activa: false`, no la cadena', async () => {
    respondeSiempre(200, { nombre: 'Bancolombia ahorros' })

    await cambiarEstadoDeCuentaAction({}, form({ cuentaId: 'c-1', activa: 'no' }))

    expect(loQueViajo()).toMatchObject({
      url: '/cuentas/c-1/estado',
      metodo: 'PATCH',
      cuerpo: { activa: false },
    })
  })

  it('reactivar manda `activa: true`', async () => {
    respondeSiempre(200, { nombre: 'Bancolombia ahorros' })

    await cambiarEstadoDeCuentaAction({}, form({ cuentaId: 'c-1', activa: 'si' }))

    expect(loQueViajo().cuerpo).toMatchObject({ activa: true })
  })

  it('una cuenta con saldo no se da de baja: pasa el mensaje de `api/`', async () => {
    respondeSiempre(422, {
      code: 'CUENTA_CON_SALDO',
      mensaje: 'Bancolombia ahorros tiene 120000.00 y una cuenta con plata no se puede esconder',
    })

    const estado = await cambiarEstadoDeCuentaAction({}, form({ cuentaId: 'c-1', activa: 'no' }))

    expect(estado.error).toContain('no se puede esconder')
  })
})
