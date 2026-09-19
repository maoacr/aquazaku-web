import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  agregarDireccionAction,
  agregarTelefonoAction,
  desactivarDireccionAction,
  desactivarTelefonoAction,
  editarDireccionAction,
} from '@/app/(app)/modulos/clientes/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Las direcciones y los teléfonos de un cliente — M14.
 *
 * ── Lo que se vigila ────────────────────────────────────────────────────────
 *
 * Que los campos vacíos NO viajen. `api/` distingue «no lo cargaron» de «lo
 * cargaron vacío», y mandar `''` haría que una dirección en blanco pase el
 * control de la base diciendo que tiene municipio.
 *
 * Que las coordenadas viajen DE A DOS. Media coordenada no ubica nada, y un
 * `latitud` suelto guardado es peor que ninguno: dibuja un punto en el
 * meridiano cero.
 *
 * Y que nada se BORRE. Una dirección puede tener bases prestadas: si
 * desapareciera, el préstamo dejaría de ser reclamable.
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

const UBICACION = {
  clienteId: 'cli-1',
  etiqueta: 'Casa',
  viaTipo: 'Calle',
  viaNumero: '5',
  placaNumero: '3',
  placaSegundo: '20',
  municipio: 'Aguachica',
  departamento: 'Cesar',
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('agregarDireccionAction()', () => {
  it('va por POST a las direcciones del cliente', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction({}, form(UBICACION))

    expect(ultimoPedido().url).toBe('/clientes/cli-1/direcciones')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('manda los campos de la nomenclatura por separado, no una sola línea', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction({}, form(UBICACION))

    expect(ultimoPedido().body).toMatchObject({
      viaTipo: 'Calle',
      viaNumero: '5',
      placaNumero: '3',
      placaSegundo: '20',
      municipio: 'Aguachica',
      departamento: 'Cesar',
    })
  })

  it('los campos vacíos NO viajan: en blanco no es lo mismo que ausente', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction(
      {},
      form({ ...UBICACION, viaLetra: '', complemento: '', indicaciones: '' }),
    )

    const { body } = ultimoPedido()
    expect(body).not.toHaveProperty('viaLetra')
    expect(body).not.toHaveProperty('complemento')
    expect(body).not.toHaveProperty('indicaciones')
  })

  it('un campo con solo espacios tampoco viaja', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction({}, form({ ...UBICACION, complemento: '   ' }))

    expect(ultimoPedido().body).not.toHaveProperty('complemento')
  })

  it('recorta los espacios de lo que sí viaja', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction({}, form({ ...UBICACION, indicaciones: '  casa verde  ' }))

    expect(ultimoPedido().body.indicaciones).toBe('casa verde')
  })

  it('el cliente no viaja en el cuerpo: ya está en la URL', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction({}, form(UBICACION))

    expect(ultimoPedido().body).not.toHaveProperty('clienteId')
  })

  describe('las coordenadas van de a dos', () => {
    it('con las dos, viajan como números', async () => {
      respondeSiempre(201, {})

      await agregarDireccionAction(
        {},
        form({ ...UBICACION, latitud: '8.3128', longitud: '-73.6089' }),
      )

      const { body } = ultimoPedido()
      expect(body.latitud).toBe(8.3128)
      expect(body.longitud).toBe(-73.6089)
    })

    it('con la latitud sola no viaja NINGUNA: media coordenada no ubica nada', async () => {
      respondeSiempre(201, {})

      await agregarDireccionAction({}, form({ ...UBICACION, latitud: '8.3128' }))

      const { body } = ultimoPedido()
      expect(body).not.toHaveProperty('latitud')
      expect(body).not.toHaveProperty('longitud')
    })

    it('con la longitud sola tampoco', async () => {
      respondeSiempre(201, {})

      await agregarDireccionAction({}, form({ ...UBICACION, longitud: '-73.6089' }))

      const { body } = ultimoPedido()
      expect(body).not.toHaveProperty('latitud')
      expect(body).not.toHaveProperty('longitud')
    })

    it('sin ninguna, la dirección viaja igual: el mapa es opcional', async () => {
      respondeSiempre(201, {})

      await agregarDireccionAction({}, form(UBICACION))

      expect(ultimoPedido().body).toMatchObject({ municipio: 'Aguachica' })
    })
  })

  it('refresca solo la ficha del cliente', async () => {
    respondeSiempre(201, {})

    await agregarDireccionAction({}, form(UBICACION))

    expect(rutasRefrescadas()).toEqual(['/modulos/clientes/cli-1'])
  })

  it('un error se explica hablando de la dirección', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await agregarDireccionAction({}, form(UBICACION))

    expect(estado.error).toBe('No pudimos agregar la dirección.')
  })
})

/**
 * Editar una dirección.
 *
 * Manda la dirección ENTERA, no los campos que cambiaron: lo que el operador
 * borró llega ausente y se guarda ausente. Con un merge parcial, vaciar un
 * campo sería imposible.
 */
describe('editarDireccionAction()', () => {
  it('va por PATCH a la dirección, no al cliente', async () => {
    respondeSiempre(200, {})

    await editarDireccionAction({}, form({ ...UBICACION, id: 'dir-7' }))

    expect(ultimoPedido().url).toBe('/direcciones/dir-7')
    expect(ultimoPedido().metodo).toBe('PATCH')
  })

  it('arma el cuerpo con la misma regla que el alta: vaciar un campo lo borra', async () => {
    respondeSiempre(200, {})

    await editarDireccionAction({}, form({ ...UBICACION, id: 'dir-7', complemento: '' }))

    expect(ultimoPedido().body).not.toHaveProperty('complemento')
  })

  it('refresca la ficha del cliente dueño, no la de la dirección', async () => {
    respondeSiempre(200, {})

    await editarDireccionAction({}, form({ ...UBICACION, id: 'dir-7' }))

    expect(rutasRefrescadas()).toEqual(['/modulos/clientes/cli-1'])
  })

  it('un error habla de guardar la dirección', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await editarDireccionAction({}, form({ ...UBICACION, id: 'dir-7' }))

    expect(estado.error).toBe('No pudimos guardar la dirección.')
  })
})

describe('desactivarDireccionAction()', () => {
  /*
   * Es un PATCH a `/desactivar`, no un DELETE. La dirección puede tener bases
   * prestadas: borrarla dejaría el préstamo sin a dónde ir a reclamarlo.
   */
  it('desactiva, no borra: el préstamo tiene que seguir siendo reclamable', async () => {
    respondeSiempre(200, {})

    await desactivarDireccionAction({}, form({ clienteId: 'cli-1', id: 'dir-7' }))

    expect(ultimoPedido().url).toBe('/direcciones/dir-7/desactivar')
    expect(ultimoPedido().metodo).toBe('PATCH')
    expect(ultimoPedido().metodo).not.toBe('DELETE')
  })

  it('el mensaje dice «dada de baja», que es lo que pasó', async () => {
    respondeSiempre(200, {})

    const estado = await desactivarDireccionAction({}, form({ clienteId: 'cli-1', id: 'dir-7' }))

    expect(estado.ok).toBe('Dirección dada de baja.')
  })

  it('refresca la ficha del cliente', async () => {
    respondeSiempre(200, {})

    await desactivarDireccionAction({}, form({ clienteId: 'cli-1', id: 'dir-7' }))

    expect(rutasRefrescadas()).toEqual(['/modulos/clientes/cli-1'])
  })

  it('un error habla de dar de baja', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await desactivarDireccionAction({}, form({ clienteId: 'cli-1', id: 'dir-7' }))

    expect(estado.error).toBe('No pudimos dar de baja la dirección.')
  })
})

/**
 * Los teléfonos — M14.
 *
 * Salieron de la primera demo: se había construido la cartera por edad para
 * saber a quién llamar primero, y no había a qué número llamar.
 */
describe('agregarTelefonoAction()', () => {
  it('va por POST a los teléfonos del cliente', async () => {
    respondeSiempre(201, {})

    await agregarTelefonoAction({}, form({ clienteId: 'cli-1', numero: '3001234567' }))

    expect(ultimoPedido().url).toBe('/clientes/cli-1/telefonos')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('manda el número recortado', async () => {
    respondeSiempre(201, {})

    await agregarTelefonoAction({}, form({ clienteId: 'cli-1', numero: '  3001234567  ' }))

    expect(ultimoPedido().body.numero).toBe('3001234567')
  })

  /*
   * La etiqueta distingue un celular de un fijo, y de eso depende que se dibuje
   * o no el botón de WhatsApp. Una etiqueta vacía no es «sin etiqueta»: es un
   * dato en blanco que `api/` tendría que adivinar.
   */
  it('sin etiqueta no manda la clave', async () => {
    respondeSiempre(201, {})

    await agregarTelefonoAction({}, form({ clienteId: 'cli-1', numero: '3001234567', etiqueta: '' }))

    expect(ultimoPedido().body).not.toHaveProperty('etiqueta')
  })

  it('con etiqueta la manda: de ahí sale el botón de WhatsApp', async () => {
    respondeSiempre(201, {})

    await agregarTelefonoAction(
      {},
      form({ clienteId: 'cli-1', numero: '3001234567', etiqueta: 'celular' }),
    )

    expect(ultimoPedido().body).toMatchObject({ etiqueta: 'celular' })
  })

  it('refresca la ficha del cliente', async () => {
    respondeSiempre(201, {})

    await agregarTelefonoAction({}, form({ clienteId: 'cli-1', numero: '3001234567' }))

    expect(rutasRefrescadas()).toEqual(['/modulos/clientes/cli-1'])
  })

  it('un error habla de agregar el teléfono', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await agregarTelefonoAction({}, form({ clienteId: 'cli-1', numero: '300' }))

    expect(estado.error).toBe('No pudimos agregar el teléfono.')
  })
})

describe('desactivarTelefonoAction()', () => {
  it('desactiva el teléfono por su propio id, no por el del cliente', async () => {
    respondeSiempre(200, {})

    await desactivarTelefonoAction({}, form({ clienteId: 'cli-1', id: 'tel-3' }))

    expect(ultimoPedido().url).toBe('/telefonos/tel-3/desactivar')
    expect(ultimoPedido().metodo).toBe('PATCH')
  })

  it('refresca la ficha del cliente, que es donde se ve la lista', async () => {
    respondeSiempre(200, {})

    await desactivarTelefonoAction({}, form({ clienteId: 'cli-1', id: 'tel-3' }))

    expect(rutasRefrescadas()).toEqual(['/modulos/clientes/cli-1'])
  })

  it('un error habla de quitar el teléfono', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const estado = await desactivarTelefonoAction({}, form({ clienteId: 'cli-1', id: 'tel-3' }))

    expect(estado.error).toBe('No pudimos quitar el teléfono.')
  })
})
