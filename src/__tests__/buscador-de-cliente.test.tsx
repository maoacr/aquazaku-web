import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BuscadorDeCliente } from '@/components/clientes/buscador-de-cliente'
import type { Cliente } from '@/lib/api-types'

const buscarClientesAnchoAction = vi.fn()
const crearClienteRapidoAction = vi.fn()

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  buscarClientesAnchoAction: (termino: string) => buscarClientesAnchoAction(termino),
  /*
   * La búsqueda ANGOSTA sigue existiendo, y este mock la necesita aunque el
   * buscador ya no la llame: el alta que se abre desde acá empieza por
   * `DocumentoPrimero`, que pregunta si ESE número exacto ya está tomado. Es
   * otra pregunta y por eso es otra consulta.
   *
   * Devuelve vacío: acá el documento siempre está libre. Que el aviso de
   * duplicado aparezca cuando no lo está se prueba en `documento-primero`.
   */
  buscarClientesAction: async () => [],
  crearClienteRapidoAction: (datos: unknown) => crearClienteRapidoAction(datos),
  /*
   * El paso 3 del alta pide el catálogo del DANE cuando no se lo pasan como
   * prop, que es justo el caso del mostrador: cargar 1122 municipios en cada
   * venta por si alguien registra un cliente sería pagarlo siempre para usarlo
   * casi nunca.
   *
   * Sin este mock, llegar al paso 3 llama a `undefined` y el test falla con un
   * error que no menciona la geografía por ningún lado.
   */
  geografiaAction: async () => ({ departamentos: [], municipios: [] }),
}))

/**
 * El buscador de clientes — el reemplazo del `<select>` que no escala.
 *
 * ── Por qué este componente se prueba y el `<select>` no hacía falta ────────
 *
 * Un `<select>` es del navegador: no hay nada que se pueda romper. Acá hay un
 * desplegable hecho a mano, con teclado, con una consulta por tecla y con
 * respuestas que pueden volver desordenadas. Cada una de esas tres cosas es un
 * defecto conocido de este patrón, y las tres están abajo.
 */

const cliente = (extra: Partial<Cliente> = {}): Cliente =>
  ({
    id: 'c1',
    nombre: 'Pedro Martínez',
    tipo: 'residencial',
    tipoDocumento: 'CC',
    numeroDocumento: '1043212345',
    documento: 'CC 1.043.212.345',
    activo: true,
    ...extra,
  }) as Cliente

/**
 * El formulario que rodea al buscador, con un espía en el Enter.
 *
 * Mira `defaultPrevented` en el burbujeo y no si el formulario se envió, porque
 * **jsdom no implementa el envío implícito**: un test que espere el `submit`
 * pasa igual con el freno sacado. Se comprobó sacándolo.
 *
 * `defaultPrevented` sí es el mecanismo real: es exactamente lo que decide, en
 * un navegador, si el Enter cobra la venta.
 */
function Anfitrion({ alTeclearEnter = vi.fn() }: { alTeclearEnter?: (frenado: boolean) => void }) {
  const [elegido, setElegido] = useState<Cliente | null>(null)

  return (
    <form
      onKeyDown={(e) => {
        if (e.key === 'Enter') alTeclearEnter(e.defaultPrevented)
      }}
    >
      <BuscadorDeCliente elegido={elegido} onElegir={setElegido} />
      <button type="submit">Cobrar</button>
    </form>
  )
}

/** Más que el debounce del buscador, para que la consulta llegue a dispararse. */
const pasaElDebounce = () => new Promise((r) => setTimeout(r, 400))

beforeEach(() => {
  buscarClientesAnchoAction.mockReset()
  buscarClientesAnchoAction.mockResolvedValue([])
  crearClienteRapidoAction.mockReset()
})

/**
 * ── Por qué este bloque entra por la puerta y no por la ventana ─────────────
 *
 * El test del alta rápida monta el diálogo con `documentoInicial` ya puesto, y
 * así pasaba en verde con el defecto adentro: el campo llegaba vacío en la app
 * real. `useState(documentoInicial)` solo mira ese valor la primera vez que el
 * componente se monta, y montado desde el arranque esa primera vez es con la
 * búsqueda vacía.
 *
 * Se encontró abriendo la pantalla. Estos tests recorren el camino de verdad —
 * escribir, no encontrar a nadie, abrir el alta— porque es el único donde el
 * orden de los montajes es el real.
 */
describe('registrar desde la búsqueda', () => {
  it('la opción aparece solo cuando ya se buscó y no vino nadie', async () => {
    const usuario = userEvent.setup()
    buscarClientesAnchoAction.mockResolvedValue([cliente()])

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '1043')
    await screen.findByRole('option', { name: /Pedro/ })

    expect(screen.queryByRole('button', { name: /Registrar a esta persona/ })).toBeNull()
  })

  /*
   * ── El alta del mostrador es AHORA la misma que la de Clientes ────────────
   *
   * Antes era `AltaRapidaDeCliente`: nombre, documento y teléfono, sin
   * dirección nunca. Quien registraba acá —con el cliente enfrente— quedaba con
   * alguien sin domicilio, y una base se presta a una DIRECCIÓN (RN-BAS-03).
   *
   * Estos dos tests siguen vigilando lo mismo que antes: que el documento ya
   * tecleado no se dicte de nuevo, y que el recién creado quede elegido sin
   * tocar el carrito. Lo que cambió es el camino — ahora son tres pasos.
   */
  it('el documento que se acaba de escribir llega al alta', async () => {
    const usuario = userEvent.setup()

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '5551234')
    await usuario.click(await screen.findByRole('button', { name: /Registrar a esta persona/ }))

    expect(screen.getByRole('textbox', { name: /Número/ })).toHaveValue('5551234')
  })

  /**
   * Buscar por nombre NO llena el campo de documento.
   *
   * El alta arranca con lo que se tecleó en el buscador, y eso servía cuando lo
   * único que se podía teclear era una cédula. Ahora se teclea «rosa padilla»:
   * meter eso en «Número» deja un documento inventado a un clic de guardarse, y
   * el documento es la llave con la que se encuentra a alguien después.
   */
  it('un nombre no se cuela en el campo de documento', async () => {
    const usuario = userEvent.setup()

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), 'rosa padilla')
    await usuario.click(await screen.findByRole('button', { name: /Registrar a esta persona/ }))

    expect(screen.getByRole('textbox', { name: /Número/ })).toHaveValue('')
  })

  it('el cliente registrado queda elegido, con el carrito intacto', async () => {
    const usuario = userEvent.setup()
    crearClienteRapidoAction.mockResolvedValue({
      cliente: cliente({ id: 'recien-creado', nombre: 'Rosa Elena Padilla' }),
    })

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '5551234')
    await usuario.click(await screen.findByRole('button', { name: /Registrar a esta persona/ }))

    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')

    /*
     * Paso 1 → 2 → 3, saltando teléfono y dirección: los dos son opcionales.
     *
     * Se usa `findBy` y no `getBy` en cada salto. El paso 1 espera un debounce
     * de 250 ms y una respuesta del servidor antes de habilitar «Siguiente», y
     * el paso 3 pide el catálogo de municipios al entrar. Con la suite completa
     * corriendo en paralelo esos tiempos se estiran, y un `getBy` mira el DOM
     * una sola vez — pasaba aislado y fallaba en la suite, que es la peor forma
     * de fallar.
     */
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(await screen.findByRole('button', { name: /Siguiente/ }))
    await usuario.click(await screen.findByRole('button', { name: /Siguiente|sin teléfono/i }))
    await usuario.click(await screen.findByRole('button', { name: /Registrar cliente/ }))

    expect(await screen.findByText('Rosa Elena Padilla')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

describe('no consulta lo que no vale la pena consultar', () => {
  /**
   * Con uno o dos caracteres, `api/` devolvería casi toda la tabla —por eso
   * corta en tres—. Acá el corte existe por otra razón: cada tecla sería un
   * viaje al servidor, y una cédula tiene diez.
   */
  it('con menos de tres caracteres no llama al servidor', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), '10')
    // Sin esta espera el test pasa por el debounce y no por el mínimo: se
    // comprobó sacando el mínimo, y seguía en verde.
    await pasaElDebounce()

    expect(buscarClientesAnchoAction).not.toHaveBeenCalled()
    expect(screen.getByText(/al menos 3/)).toBeInTheDocument()
  })

  it('a partir de tres, sí', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), '104')

    await waitFor(() => expect(buscarClientesAnchoAction).toHaveBeenCalledWith('104'))
  })

  /**
   * Los espacios de los extremos no cuentan.
   *
   * Sin el `trim`, una barra espaciadora de más alcanza el mínimo de tres y
   * dispara una consulta por un término que nadie escribió.
   */
  it('los espacios de los bordes no viajan ni cuentan para el mínimo', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), '  go  ')
    await pasaElDebounce()

    expect(buscarClientesAnchoAction).not.toHaveBeenCalled()
  })
})

/**
 * ── La misma búsqueda que la pantalla de Clientes — M16 ────────────────────
 *
 * Este buscador nació pidiendo SOLO el documento: en el mostrador el cliente
 * dicta su cédula, y con eso alcanzaba. Pero el mismo componente terminó en
 * Retornables —«a quién le presto esta base»— y ahí quien atiende no tiene la
 * cédula: tiene el apodo con el que lo conocen en el pueblo.
 *
 * Y aun en el mostrador: el cliente que no trae la cédula encima existe todos
 * los días. La pantalla de Clientes ya sabía encontrarlo por apellido y por
 * apodo, sin que las tildes lo escondieran. Esta no, y eran dos búsquedas
 * distintas para la misma pregunta.
 *
 * Ahora las dos llaman a `buscarClientesAnchoAction`. La angosta NO se borró:
 * sigue viva en `DocumentoPrimero`, que no busca a nadie —pregunta si ESE
 * número exacto ya está tomado, que es otra pregunta—.
 */
describe('busca por cómo se conoce a alguien, no solo por el número', () => {
  it('un apellido suelto encuentra al cliente', async () => {
    const usuario = userEvent.setup()
    buscarClientesAnchoAction.mockResolvedValue([cliente({ nombre: 'Rosa Elena Padilla Gómez' })])

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), 'padilla')

    await waitFor(() => expect(buscarClientesAnchoAction).toHaveBeenCalledWith('padilla'))
    expect(await screen.findByRole('option', { name: /Padilla/ })).toBeInTheDocument()
  })

  /**
   * Las letras tienen que llegar ENTERAS.
   *
   * El filtro anterior recortaba a `[0-9A-Za-z]` porque solo esperaba una
   * cédula. Con ese recorte «Gómez» viajaba como «Gmez» y «rosa padilla» como
   * «rosapadilla»: dos términos que no coinciden con nadie. Quien busca ve el
   * buscador roto, y no hay error en ningún log.
   */
  it('las tildes y los espacios del nombre llegan al servidor', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), 'rosa gómez')

    await waitFor(() => expect(buscarClientesAnchoAction).toHaveBeenCalledWith('rosa gómez'))
  })

  /**
   * La cédula con puntos viaja con puntos, y está bien.
   *
   * `api/` saca los dígitos del término para cotejarlos contra el documento
   * —por eso «1.043» encuentra al de la cédula 1043—. Normalizar también acá
   * sería la misma regla escrita dos veces, en dos repos, para desincronizarse.
   */
  it('la cédula con puntos viaja tal como se dicta', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), '1.043')

    await waitFor(() => expect(buscarClientesAnchoAction).toHaveBeenCalledWith('1.043'))
  })
})

describe('el teclado', () => {
  /**
   * ── El defecto que este test existe para impedir ────────────────────────
   *
   * Este campo vive DENTRO del formulario de venta. Sin freno, escribir una
   * cédula y apretar Enter —que es lo que hace cualquiera— envía el formulario
   * y cobra la venta antes de haber elegido a nadie.
   */
  it('Enter con la lista abierta elige, y llega frenado al formulario', async () => {
    const usuario = userEvent.setup()
    const enter = vi.fn()
    buscarClientesAnchoAction.mockResolvedValue([cliente()])

    render(<Anfitrion alTeclearEnter={enter} />)
    await usuario.type(screen.getByRole('combobox'), '1043')
    await screen.findByRole('option', { name: /Pedro/ })

    await usuario.keyboard('{Enter}')

    expect(enter).toHaveBeenCalledWith(true)
    expect(screen.getByText('Pedro Martínez')).toBeInTheDocument()
  })

  /**
   * El freno tiene que ser del ancho justo.
   *
   * Un `preventDefault()` incondicional dejaría el formulario sin poder
   * enviarse con Enter desde ningún campo, que es el defecto opuesto y se ve
   * igual de mal desde el mostrador.
   */
  it('con la lista cerrada, el Enter pasa', async () => {
    const usuario = userEvent.setup()
    const enter = vi.fn()

    render(<Anfitrion alTeclearEnter={enter} />)
    await usuario.type(screen.getByRole('combobox'), '10')
    await usuario.keyboard('{Enter}')

    expect(enter).toHaveBeenCalledWith(false)
  })

  it('las flechas mueven el resaltado', async () => {
    const usuario = userEvent.setup()
    buscarClientesAnchoAction.mockResolvedValue([
      cliente(),
      cliente({ id: 'c2', nombre: 'Ana Ruiz', documento: 'CC 1.043.299.999' }),
    ])

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '1043')
    await screen.findByRole('option', { name: /Pedro/ })

    await usuario.keyboard('{ArrowDown}{Enter}')

    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
  })
})

describe('lo que viaja en el formulario', () => {
  it('sale el id, no el documento', async () => {
    const usuario = userEvent.setup()
    buscarClientesAnchoAction.mockResolvedValue([cliente({ id: 'el-id-real' })])

    const { container } = render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '1043')
    await usuario.click(await screen.findByRole('option', { name: /Pedro/ }))

    const campo = container.querySelector<HTMLInputElement>('input[name="clienteId"]')

    expect(campo?.value).toBe('el-id-real')
  })

  /**
   * Sin el campo, `FormData` no trae la clave y el servidor no puede
   * distinguir «sin cliente» de «el formulario llegó incompleto».
   */
  it('el campo existe aunque no haya nadie elegido', () => {
    const { container } = render(<Anfitrion />)

    expect(container.querySelector('input[name="clienteId"]')).not.toBeNull()
  })

  it('«Cambiar» lo devuelve a la búsqueda', async () => {
    const usuario = userEvent.setup()
    buscarClientesAnchoAction.mockResolvedValue([cliente()])

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '1043')
    await usuario.click(await screen.findByRole('option', { name: /Pedro/ }))

    await usuario.click(screen.getByRole('button', { name: /Cambiar/ }))

    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

/**
 * Dos búsquedas en vuelo pueden volver al revés.
 *
 * `10432` sale después de `1043` y vuelve antes. Sin guarda, la lista termina
 * mostrando el resultado de lo que se escribió hace dos teclas — y quien está
 * en el mostrador elige a la persona equivocada sin enterarse.
 */
describe('respuestas que llegan tarde', () => {
  it('una respuesta vieja no pisa a la nueva', async () => {
    const usuario = userEvent.setup()

    let resolverVieja!: (c: Cliente[]) => void
    buscarClientesAnchoAction.mockImplementation((documento: string) =>
      documento === '1043'
        ? new Promise<Cliente[]>((r) => {
            resolverVieja = r
          })
        : Promise.resolve([cliente({ id: 'c2', nombre: 'Ana Ruiz' })]),
    )

    render(<Anfitrion />)
    const campo = screen.getByRole('combobox')

    await usuario.type(campo, '1043')
    await waitFor(() => expect(buscarClientesAnchoAction).toHaveBeenCalledWith('1043'))

    await usuario.type(campo, '2')
    await screen.findByRole('option', { name: /Ana/ })

    // Recién ahora contesta la primera, con la persona equivocada.
    resolverVieja([cliente({ id: 'c1', nombre: 'Pedro Martínez' })])

    await waitFor(() => expect(screen.queryByText('Pedro Martínez')).not.toBeInTheDocument())
    expect(screen.getByRole('option', { name: /Ana/ })).toBeInTheDocument()
  })
})
