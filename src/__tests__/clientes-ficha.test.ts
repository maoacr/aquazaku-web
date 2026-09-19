import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cambiarEstadoAction,
  configurarCreditoAction,
  verificarDocumentoAction,
} from '@/app/(app)/modulos/clientes/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Las tres decisiones que se toman sobre un cliente ya registrado.
 *
 * Verificar su documento, habilitarle crédito y darlo de baja. Ninguna crea
 * nada: las tres cambian algo que ya existe, y las tres tienen que dejar la
 * ficha refrescada o quien la mira seguiría viendo el estado anterior.
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

function rutasRefrescadas(): string[] {
  return vi.mocked(revalidatePath).mock.calls.map((c) => String(c[0]))
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('verificarDocumentoAction()', () => {
  it('va por POST a la verificación del cliente', async () => {
    respondeSiempre(200, {})

    await verificarDocumentoAction({}, form({ clienteId: 'cli-1' }))

    expect(ultimoPedido().url).toBe('/clientes/cli-1/verificacion')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  /*
   * No manda cuerpo: quién verificó lo sabe `api/` por la sesión. Mandarlo
   * desde el navegador sería dejar que el cliente elija quién respondió.
   */
  it('no manda cuerpo: quién verificó lo pone api/ desde la sesión', async () => {
    respondeSiempre(200, {})

    await verificarDocumentoAction({}, form({ clienteId: 'cli-1' }))

    const init = (vi.mocked(apiServerFetchRaw).mock.calls.at(-1)![1] ?? {}) as RequestInit
    expect(init.body).toBeUndefined()
  })

  it('el mensaje dice que quedó registrado quién respondió', async () => {
    respondeSiempre(200, {})

    const estado = await verificarDocumentoAction({}, form({ clienteId: 'cli-1' }))

    expect(estado.ok).toMatch(/quién respondió/)
  })

  it('refresca la lista y la ficha: las dos muestran el estado', async () => {
    respondeSiempre(200, {})

    await verificarDocumentoAction({}, form({ clienteId: 'cli-1' }))

    expect(rutasRefrescadas()).toContain('/modulos/clientes')
    expect(rutasRefrescadas()).toContain('/modulos/clientes/cli-1')
  })

  it('un cliente que ya no existe se dice con esas palabras', async () => {
    respondeSiempre(404, { code: 'CLIENTE_NO_ENCONTRADO' })

    const estado = await verificarDocumentoAction({}, form({ clienteId: 'cli-1' }))

    expect(estado.error).toBe('Ese cliente ya no existe.')
  })

  it('cuando falla no refresca nada: no hay nada nuevo que mostrar', async () => {
    respondeSiempre(403, {})

    await verificarDocumentoAction({}, form({ clienteId: 'cli-1' }))

    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

/**
 * El crédito del cliente — RN-CLI-12.
 *
 * ── El vacío que NO es un dato faltante ─────────────────────────────────────
 *
 * Un límite en blanco significa SIN TOPE, y eso es una decisión, no un campo
 * que alguien olvidó llenar. Por eso viaja como `null` explícito y no ausente:
 * si se omitiera, `api/` no podría distinguir «no toques el tope» de «sacale el
 * tope», y quitar un límite ya puesto sería imposible desde la pantalla.
 */
describe('configurarCreditoAction()', () => {
  it('va por PUT al crédito del cliente', async () => {
    respondeSiempre(200, {})

    await configurarCreditoAction({}, form({ clienteId: 'cli-1', habilitado: 'si', limite: '' }))

    expect(ultimoPedido().url).toBe('/clientes/cli-1/credito')
    expect(ultimoPedido().metodo).toBe('PUT')
  })

  it('un límite vacío viaja como null explícito: es «sin tope», no «sin dato»', async () => {
    respondeSiempre(200, {})

    await configurarCreditoAction({}, form({ clienteId: 'cli-1', habilitado: 'si', limite: '' }))

    const { body } = ultimoPedido()
    expect(body).toHaveProperty('limite')
    expect(body.limite).toBeNull()
  })

  it('un límite con número viaja como número, no como texto', async () => {
    respondeSiempre(200, {})

    await configurarCreditoAction(
      {},
      form({ clienteId: 'cli-1', habilitado: 'si', limite: '150000' }),
    )

    expect(ultimoPedido().body.limite).toBe(150000)
  })

  /*
   * Deshabilitar es deshabilitar: mandar un tope junto al `habilitado: false`
   * dejaría un número guardado que nadie puso y que reaparecería al volver a
   * habilitar.
   */
  it('al deshabilitar NO manda límite: no deja un tope fantasma', async () => {
    respondeSiempre(200, {})

    await configurarCreditoAction(
      {},
      form({ clienteId: 'cli-1', habilitado: 'no', limite: '150000' }),
    )

    const { body } = ultimoPedido()
    expect(body).toMatchObject({ habilitado: false })
    expect(body).not.toHaveProperty('limite')
  })

  it('solo el «si» habilita: cualquier otra cosa es no', async () => {
    respondeSiempre(200, {})

    await configurarCreditoAction({}, form({ clienteId: 'cli-1', habilitado: 'true' }))

    expect(ultimoPedido().body.habilitado).toBe(false)
  })

  it('el tope se confirma con separadores de miles: $150.000, no 150000', async () => {
    respondeSiempre(200, {})

    const estado = await configurarCreditoAction(
      {},
      form({ clienteId: 'cli-1', habilitado: 'si', limite: '150000' }),
    )

    expect(estado.ok).toContain('150.000')
  })

  it('sin tope lo dice con todas las letras', async () => {
    respondeSiempre(200, {})

    const estado = await configurarCreditoAction(
      {},
      form({ clienteId: 'cli-1', habilitado: 'si', limite: '' }),
    )

    expect(estado.ok).toBe('Crédito habilitado, sin tope.')
  })

  it('deshabilitado lo dice sin hablar de topes', async () => {
    respondeSiempre(200, {})

    const estado = await configurarCreditoAction({}, form({ clienteId: 'cli-1', habilitado: 'no' }))

    expect(estado.ok).toBe('Crédito deshabilitado.')
  })

  /*
   * El crédito se ve en la ficha, no en la lista: refrescar la lista entera
   * sería trabajo que nadie va a mirar.
   */
  it('refresca solo la ficha: el crédito no se ve en la lista', async () => {
    respondeSiempre(200, {})

    await configurarCreditoAction({}, form({ clienteId: 'cli-1', habilitado: 'si', limite: '' }))

    expect(rutasRefrescadas()).toEqual(['/modulos/clientes/cli-1'])
  })

  it('un error se explica con el mensaje del crédito', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await configurarCreditoAction({}, form({ clienteId: 'cli-1', habilitado: 'si' }))

    expect(estado.error).toBe('No pudimos guardar el crédito.')
  })
})

/**
 * Dar de baja a un cliente.
 *
 * Se DESACTIVA, no se borra: su historial de ventas y sus botellones prestados
 * siguen siendo reales, y borrarlo dejaría deuda sin dueño.
 */
describe('cambiarEstadoAction()', () => {
  it('va por PATCH al estado del cliente', async () => {
    respondeSiempre(200, {})

    await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'no' }))

    expect(ultimoPedido().url).toBe('/clientes/cli-1/estado')
    expect(ultimoPedido().metodo).toBe('PATCH')
  })

  it('el «si» reactiva y cualquier otra cosa desactiva', async () => {
    respondeSiempre(200, {})

    await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'si' }))
    expect(ultimoPedido().body).toMatchObject({ activo: true })

    await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'no' }))
    expect(ultimoPedido().body).toMatchObject({ activo: false })
  })

  it('al desactivar avisa que el historial queda: nadie pierde su deuda', async () => {
    respondeSiempre(200, {})

    const estado = await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'no' }))

    expect(estado.ok).toMatch(/historial queda/)
  })

  it('al reactivar no repite la advertencia del historial', async () => {
    respondeSiempre(200, {})

    const estado = await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'si' }))

    expect(estado.ok).toBe('Cliente reactivado.')
  })

  it('refresca la lista y la ficha: el estado se ve en las dos', async () => {
    respondeSiempre(200, {})

    await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'no' }))

    expect(rutasRefrescadas()).toContain('/modulos/clientes')
    expect(rutasRefrescadas()).toContain('/modulos/clientes/cli-1')
  })

  it('un 403 dice que no tiene permiso, no un error de estado', async () => {
    respondeSiempre(403, {})

    const estado = await cambiarEstadoAction({}, form({ clienteId: 'cli-1', activo: 'no' }))

    expect(estado.error).toBe('No tiene permiso para hacer esto.')
  })
})
