import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  crearClienteAction,
  crearClienteRapidoAction,
} from '@/app/(app)/modulos/clientes/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetch: vi.fn(), apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')

/**
 * Las dos puertas de alta de un cliente.
 *
 * ── Por qué son dos y no una ────────────────────────────────────────────────
 *
 * `crearClienteAction` es la del formulario de la pantalla de clientes: recibe
 * `FormData` y devuelve un mensaje. `crearClienteRapidoAction` es la del
 * mostrador: recibe un objeto ya armado y devuelve **el cliente**, porque quien
 * está cobrando necesita seleccionarlo sin salir de la venta (RN-ENV-09).
 *
 * ── Lo que se vigila en las dos ─────────────────────────────────────────────
 *
 * Que `nombre` NUNCA viaje. En la base es una columna generada a partir de las
 * partes, y `api/` rechaza cualquier intento de escribirla. Lo que se manda es
 * lo que la compone.
 *
 * Y que el aviso de cruce CC/NIT no se confunda con un error: el mismo número
 * puede ser la cédula de una persona y el NIT de su propio negocio. El cliente
 * queda creado igual, y quien atiende decide.
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

const CREADO = {
  id: 'cli-1',
  nombre: 'Rosa Elena Padilla Gómez',
  documento: 'CC 41.234.567',
  aviso: null,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('crearClienteAction() — lo que viaja a api/', () => {
  it('va por POST a la colección de clientes', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction({}, form({ primerNombre: 'Rosa', apellidos: 'Padilla' }))

    expect(ultimoPedido().url).toBe('/clientes')
    expect(ultimoPedido().metodo).toBe('POST')
  })

  it('NUNCA manda `nombre`: en la base es una columna generada', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction(
      {},
      form({ nombre: 'Rosa Elena Padilla Gómez', primerNombre: 'Rosa', apellidos: 'Padilla' }),
    )

    expect(ultimoPedido().body).not.toHaveProperty('nombre')
  })

  it('manda las partes del nombre, no el nombre armado', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction(
      {},
      form({
        primerNombre: 'Rosa',
        segundoNombre: 'Elena',
        apellidos: 'Padilla Gómez',
        apodo: 'Doña Rosa',
      }),
    )

    expect(ultimoPedido().body).toMatchObject({
      primerNombre: 'Rosa',
      segundoNombre: 'Elena',
      apellidos: 'Padilla Gómez',
      apodo: 'Doña Rosa',
    })
  })

  /*
   * Un `apellidos: ''` no es «sin apellidos», es un dato en blanco, y el CHECK
   * de la base lo rechaza. Omitirlo es lo que hace que el alta de un negocio
   * —que no tiene apellidos— funcione.
   */
  it('omite los campos vacíos en vez de mandarlos en blanco', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction(
      {},
      form({ nombreLibre: 'Tienda La Esquina', primerNombre: '', apellidos: '', apodo: '' }),
    )

    const { body } = ultimoPedido()
    expect(body).toHaveProperty('nombreLibre', 'Tienda La Esquina')
    expect(body).not.toHaveProperty('primerNombre')
    expect(body).not.toHaveProperty('apellidos')
    expect(body).not.toHaveProperty('apodo')
  })

  it('recorta los espacios: « Rosa » y «Rosa» son el mismo nombre', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction({}, form({ primerNombre: '  Rosa  ', apellidos: ' Padilla ' }))

    expect(ultimoPedido().body).toMatchObject({ primerNombre: 'Rosa', apellidos: 'Padilla' })
  })

  it('un campo con solo espacios cuenta como vacío', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction({}, form({ primerNombre: 'Rosa', apellidos: 'Padilla', apodo: '   ' }))

    expect(ultimoPedido().body).not.toHaveProperty('apodo')
  })

  it('sin tipo ni tipo de documento, asume residencial con cédula', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction({}, form({ primerNombre: 'Rosa', apellidos: 'Padilla' }))

    expect(ultimoPedido().body).toMatchObject({ tipo: 'residencial', tipoDocumento: 'CC' })
  })

  it('respeta el tipo y el documento cuando vienen elegidos', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction(
      {},
      form({ nombreLibre: 'Tienda La Esquina', tipo: 'comercial', tipoDocumento: 'NIT' }),
    )

    expect(ultimoPedido().body).toMatchObject({ tipo: 'comercial', tipoDocumento: 'NIT' })
  })

  /*
   * El teléfono viaja ANIDADO. `api/` lo recibe como el primer teléfono del
   * cliente y lo crea en la misma transacción — mandarlo plano lo haría ignorar
   * en silencio, y el cliente quedaría sin a qué número llamar.
   */
  it('el teléfono viaja anidado en un objeto, no como texto suelto', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction({}, form({ primerNombre: 'Rosa', telefono: '3001234567' }))

    expect(ultimoPedido().body).toMatchObject({ telefono: { numero: '3001234567' } })
  })

  it('sin teléfono no manda la clave: no es un teléfono en blanco', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteAction({}, form({ primerNombre: 'Rosa', telefono: '' }))

    expect(ultimoPedido().body).not.toHaveProperty('telefono')
  })
})

describe('crearClienteAction() — lo que se cuenta al volver', () => {
  it('el mensaje nombra al cliente y su documento: confirma lo que quedó', async () => {
    respondeSiempre(201, CREADO)

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.ok).toContain('Rosa Elena Padilla Gómez')
    expect(estado.ok).toContain('CC 41.234.567')
  })

  /*
   * El alta no termina acá: con el cliente ya existiendo, la pantalla ofrece
   * cargarle la dirección, y `POST /clientes/:id/direcciones` necesita ese id.
   * Sin devolverlo habría que salir a buscarlo.
   */
  it('devuelve el cliente creado para que la pantalla siga con la dirección', async () => {
    respondeSiempre(201, CREADO)

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.cliente?.id).toBe('cli-1')
  })

  it('un éxito trae token: es lo que limpia el formulario', async () => {
    respondeSiempre(201, CREADO)

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.token).toBeDefined()
  })

  it('el aviso de cruce CC/NIT viaja, y NO es un error', async () => {
    const aviso = { mensaje: 'Ya hay un NIT con ese mismo número.', clienteId: 'cli-9' }
    respondeSiempre(201, { ...CREADO, aviso })

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.aviso).toEqual(aviso)
    expect(estado.error).toBeUndefined()
    expect(estado.cliente).toBeDefined()
  })

  it('sin cruce no inventa un aviso vacío', async () => {
    respondeSiempre(201, CREADO)

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado).not.toHaveProperty('aviso')
  })
})

/**
 * Los errores de `api/` traducidos a algo que sirva llenando un formulario.
 *
 * El UNIQUE del documento sube como error de base: el mensaje crudo de Postgres
 * no le dice nada a nadie. Y los 422 vienen listos —dicen qué hacer—, así que
 * reescribirlos acá dejaría dos textos que se desincronizan.
 */
describe('crearClienteAction() — cuando api/ dice que no', () => {
  it('un documento repetido se explica en castellano, no con el error de Postgres', async () => {
    respondeSiempre(409, { code: 'DB_ERROR', mensaje: 'duplicate key value violates unique' })

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.error).toBe('Ya hay un cliente con ese mismo tipo y número de documento.')
  })

  it('un DB_ERROR sin 409 se explica igual: es el mismo choque', async () => {
    respondeSiempre(500, { code: 'DB_ERROR' })

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.error).toBe('Ya hay un cliente con ese mismo tipo y número de documento.')
  })

  it('un 422 pasa el mensaje de api/ tal cual: ya dice qué corregir', async () => {
    respondeSiempre(422, { mensaje: 'El NIT debe tener dígito de verificación.' })

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.error).toBe('El NIT debe tener dígito de verificación.')
  })

  it('un 403 no habla de códigos: dice que no tiene permiso', async () => {
    respondeSiempre(403, {})

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.error).toBe('No tiene permiso para hacer esto.')
  })

  it('un error sin cuerpo útil cae al mensaje genérico en vez de reventar', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', { status: 502 }),
    )

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.error).toBe('No pudimos crear el cliente.')
  })

  it('un error NO trae token ni cliente: lo escrito se conserva', async () => {
    respondeSiempre(409, { code: 'DB_ERROR' })

    const estado = await crearClienteAction({}, form({ primerNombre: 'Rosa' }))

    expect(estado.token).toBeUndefined()
    expect(estado.cliente).toBeUndefined()
  })
})

/**
 * El alta del mostrador.
 *
 * Recibe un objeto ya armado en vez de `FormData`, y devuelve el cliente en vez
 * de un texto: quien está cobrando tiene que poder seleccionarlo y seguir.
 */
describe('crearClienteRapidoAction()', () => {
  const DATOS = {
    primerNombre: 'Rosa',
    apellidos: 'Padilla',
    tipo: 'residencial' as const,
    tipoDocumento: 'CC' as const,
    numeroDocumento: '41234567',
  }

  it('manda los datos tal como se los pasaron, sin rearmarlos', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteRapidoAction(DATOS)

    expect(ultimoPedido().url).toBe('/clientes')
    expect(ultimoPedido().body).toMatchObject(DATOS)
  })

  it('devuelve el cliente, no un mensaje de éxito', async () => {
    respondeSiempre(201, CREADO)

    const resultado = await crearClienteRapidoAction(DATOS)

    expect(resultado.cliente?.id).toBe('cli-1')
    expect(resultado).not.toHaveProperty('ok')
  })

  /*
   * El teléfono y la dirección viajan en el MISMO pedido a propósito: los
   * endpoints sueltos piden `clientes:editar`, que el `pos` no tiene. Y una
   * segunda escritura que falle dejaría un cliente a medio cargar.
   */
  it('el teléfono y la dirección viajan en el mismo pedido que el cliente', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteRapidoAction({
      ...DATOS,
      telefono: { numero: '3001234567' },
      direccion: { municipio: 'Aguachica', direccion: 'Calle 5 # 3-20' },
    })

    const { body } = ultimoPedido()
    expect(body).toHaveProperty('telefono')
    expect(body).toHaveProperty('direccion')
    expect(vi.mocked(apiServerFetchRaw)).toHaveBeenCalledTimes(1)
  })

  it('varios teléfonos viajan juntos: el celular del dueño y el fijo del local', async () => {
    respondeSiempre(201, CREADO)

    await crearClienteRapidoAction({
      ...DATOS,
      telefonos: [
        { numero: '3001234567', etiqueta: 'celular' },
        { numero: '6055551234', etiqueta: 'fijo' },
      ],
    })

    expect(ultimoPedido().body.telefonos).toHaveLength(2)
  })

  /*
   * El cruce NO cancela el alta. Acá se devuelve el TEXTO del aviso, no el
   * objeto: en el mostrador solo hay lugar para una línea.
   */
  it('el cruce CC/NIT llega como texto, y el cliente viene igual', async () => {
    respondeSiempre(201, {
      ...CREADO,
      aviso: { mensaje: 'Ya hay una CC con ese mismo número.', clienteId: 'cli-9' },
    })

    const resultado = await crearClienteRapidoAction(DATOS)

    expect(resultado.aviso).toBe('Ya hay una CC con ese mismo número.')
    expect(resultado.cliente).toBeDefined()
    expect(resultado.error).toBeUndefined()
  })

  it('sin cruce no inventa un aviso', async () => {
    respondeSiempre(201, CREADO)

    const resultado = await crearClienteRapidoAction(DATOS)

    expect(resultado).not.toHaveProperty('aviso')
  })

  it('un documento repetido devuelve error y ningún cliente', async () => {
    respondeSiempre(409, { code: 'DB_ERROR' })

    const resultado = await crearClienteRapidoAction(DATOS)

    expect(resultado.error).toBe('Ya hay un cliente con ese mismo tipo y número de documento.')
    expect(resultado.cliente).toBeUndefined()
  })

  it('su mensaje genérico habla de registrar, que es lo que se estaba haciendo', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(new Response('', { status: 500 }))

    const resultado = await crearClienteRapidoAction(DATOS)

    expect(resultado.error).toBe('No pudimos registrar al cliente.')
  })
})
