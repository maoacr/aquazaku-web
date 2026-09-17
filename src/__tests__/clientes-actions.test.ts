import { afterEach, describe, expect, it, vi } from 'vitest'
import { editarClienteAction } from '@/app/(app)/modulos/clientes/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')

/**
 * Editar el nombre de un cliente ya registrado.
 *
 * ── Lo que se vigila ────────────────────────────────────────────────────────
 *
 * Que el nombre viaje ENTERO. `PATCH /clientes/:id` reemplaza las cinco partes
 * de una: lo que no llega se guarda en `null`. Mandar solo los campos que
 * cambiaron dejaría un apodo viejo pegado a un nombre nuevo, o —peor— el nombre
 * partido y la razón social conviviendo, que es justo lo que el CHECK
 * `clientes_una_sola_forma_de_nombre` prohíbe.
 *
 * Y que `nombre` NUNCA viaje: en la base es una columna generada. `api/` lo
 * rechaza, pero el error que devuelve no le sirve a nadie llenando un
 * formulario.
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

const PERSONA = {
  clienteId: 'cli-1',
  tipo: 'residencial',
  primerNombre: 'Rosa',
  segundoNombre: 'Elena',
  apellidos: 'Padilla Gómez',
  apodo: 'Doña Rosa',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('lo que viaja a api/', () => {
  it('va por PATCH al cliente', async () => {
    respondeSiempre(200, { nombre: 'Rosa Elena Padilla Gómez' })

    await editarClienteAction({}, form(PERSONA))

    const { url, metodo } = ultimoPedido()
    expect(url).toBe('/clientes/cli-1')
    expect(metodo).toBe('PATCH')
  })

  it('manda las cuatro partes de una persona', async () => {
    respondeSiempre(200, { nombre: 'Rosa Elena Padilla Gómez' })

    await editarClienteAction({}, form(PERSONA))

    expect(ultimoPedido().body).toEqual({
      primerNombre: 'Rosa',
      segundoNombre: 'Elena',
      apellidos: 'Padilla Gómez',
      apodo: 'Doña Rosa',
    })
  })

  /**
   * Borrar el segundo nombre es OMITIRLO, no mandarlo vacío.
   *
   * Un `segundoNombre: ''` no es «sin segundo nombre»: es un dato en blanco, y
   * el CHECK `clientes_partes_sin_vacios` lo rechaza con un error de Postgres
   * en vez de un mensaje. Ausente, `api/` lo guarda en `null` — que es la forma
   * de borrarlo sin un verbo aparte.
   */
  it('lo que se borró viaja ausente, no vacío', async () => {
    respondeSiempre(200, { nombre: 'Rosa Padilla Gómez' })

    await editarClienteAction(
      {},
      form({ ...PERSONA, segundoNombre: '', apodo: '   ' }),
    )

    const { body } = ultimoPedido()
    expect(body).toEqual({ primerNombre: 'Rosa', apellidos: 'Padilla Gómez' })
    expect('segundoNombre' in body).toBe(false)
    expect('apodo' in body).toBe(false)
  })

  it('un negocio manda su nombre y ninguna parte', async () => {
    respondeSiempre(200, { nombre: 'Panadería del Centro' })

    await editarClienteAction(
      {},
      form({
        clienteId: 'cli-2',
        tipo: 'comercial',
        nombreLibre: 'Panadería del Centro',
      }),
    )

    expect(ultimoPedido().body).toEqual({ nombreLibre: 'Panadería del Centro' })
  })

  /**
   * `nombre` es una columna GENERADA. Si el formulario lo colara —por un campo
   * copiado, por un hidden de más—, `api/` lo rechazaría y quien edita vería un
   * error que no explica nada.
   */
  it('el nombre compuesto nunca viaja, aunque venga en el formulario', async () => {
    respondeSiempre(200, { nombre: 'Rosa Elena Padilla Gómez' })

    await editarClienteAction({}, form({ ...PERSONA, nombre: 'Lo Que Sea' }))

    expect('nombre' in ultimoPedido().body).toBe(false)
  })

  /** El tipo identifica qué campos leer; no es un cambio que esta pantalla haga. */
  it('el tipo no se manda: esta pantalla cambia el nombre, no qué es el cliente', async () => {
    respondeSiempre(200, { nombre: 'Rosa Elena Padilla Gómez' })

    await editarClienteAction({}, form(PERSONA))

    expect('tipo' in ultimoPedido().body).toBe(false)
  })
})

describe('lo que se ataja antes del viaje', () => {
  it('una persona sin apellidos no gasta un viaje a api/', async () => {
    const estado = await editarClienteAction(
      {},
      form({ clienteId: 'cli-1', tipo: 'residencial', primerNombre: 'Rosa', apellidos: '' }),
    )

    expect(estado.error).toMatch(/apellidos/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('un negocio sin nombre tampoco', async () => {
    const estado = await editarClienteAction(
      {},
      form({ clienteId: 'cli-2', tipo: 'comercial', nombreLibre: '  ' }),
    )

    expect(estado.error).toMatch(/nombre/i)
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })
})

describe('lo que se cuenta al volver', () => {
  it('el éxito nombra al cliente como quedó', async () => {
    respondeSiempre(200, { nombre: 'Rosa Elena Padilla Gómez' })

    const estado = await editarClienteAction({}, form(PERSONA))

    expect(estado.ok).toContain('Rosa Elena Padilla Gómez')
    expect(estado.error).toBeUndefined()
  })

  /**
   * El 422 de `api/` viene listo: dice qué hacer. Reescribirlo acá dejaría dos
   * textos que se desincronizan.
   */
  it('el 422 de api/ se muestra tal cual', async () => {
    respondeSiempre(422, {
      code: 'NOMBRE_AMBIGUO',
      mensaje: 'llegaron las dos formas de nombrar al cliente',
    })

    const estado = await editarClienteAction({}, form(PERSONA))

    expect(estado.error).toBe('llegaron las dos formas de nombrar al cliente')
  })

  it('sin permiso lo dice sin jerga', async () => {
    respondeSiempre(403, {})

    const estado = await editarClienteAction({}, form(PERSONA))

    expect(estado.error).toBe('No tiene permiso para hacer esto.')
  })

  it('un cliente que ya no existe lo dice', async () => {
    respondeSiempre(404, { code: 'CLIENTE_NO_ENCONTRADO', mensaje: 'ese cliente no existe' })

    const estado = await editarClienteAction({}, form(PERSONA))

    expect(estado.error).toBe('Ese cliente ya no existe.')
  })
})
