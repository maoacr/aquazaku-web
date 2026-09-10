import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BuscadorDeCliente } from '@/components/clientes/buscador-de-cliente'
import type { Cliente } from '@/lib/api-types'

const buscarClientesAction = vi.fn()
const crearClienteRapidoAction = vi.fn()

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  buscarClientesAction: (documento: string) => buscarClientesAction(documento),
  crearClienteRapidoAction: (datos: unknown) => crearClienteRapidoAction(datos),
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
  buscarClientesAction.mockReset()
  buscarClientesAction.mockResolvedValue([])
  crearClienteRapidoAction.mockReset()
  HTMLDialogElement.prototype.showModal ??= function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close ??= function () {
    this.removeAttribute('open')
  }
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
    buscarClientesAction.mockResolvedValue([cliente()])

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '1043')
    await screen.findByRole('option', { name: /Pedro/ })

    expect(screen.queryByRole('button', { name: /Registrar a esta persona/ })).toBeNull()
  })

  it('el documento que se acaba de escribir llega al alta', async () => {
    const usuario = userEvent.setup()

    render(<Anfitrion />)
    await usuario.type(screen.getByRole('combobox'), '5551234')
    await usuario.click(await screen.findByRole('button', { name: /Registrar a esta persona/ }))

    expect(screen.getByRole('textbox', { name: /Número de documento/ })).toHaveValue('5551234')
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
    await usuario.click(screen.getByRole('button', { name: /Registrar y continuar/ }))

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

    expect(buscarClientesAction).not.toHaveBeenCalled()
    expect(screen.getByText(/al menos 3/)).toBeInTheDocument()
  })

  it('a partir de tres, sí', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), '104')

    await waitFor(() => expect(buscarClientesAction).toHaveBeenCalledWith('104'))
  })

  /**
   * Una cédula se dicta y se escribe con puntos. El servidor normaliza, pero si
   * el punto viaja, el prefijo que busca no es el que la persona quiso.
   */
  it('los puntos y guiones no llegan a la consulta', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('combobox'), '1.043')

    await waitFor(() => expect(buscarClientesAction).toHaveBeenCalledWith('1043'))
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
    buscarClientesAction.mockResolvedValue([cliente()])

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
    buscarClientesAction.mockResolvedValue([
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
    buscarClientesAction.mockResolvedValue([cliente({ id: 'el-id-real' })])

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
    buscarClientesAction.mockResolvedValue([cliente()])

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
    buscarClientesAction.mockImplementation((documento: string) =>
      documento === '1043'
        ? new Promise<Cliente[]>((r) => {
            resolverVieja = r
          })
        : Promise.resolve([cliente({ id: 'c2', nombre: 'Ana Ruiz' })]),
    )

    render(<Anfitrion />)
    const campo = screen.getByRole('combobox')

    await usuario.type(campo, '1043')
    await waitFor(() => expect(buscarClientesAction).toHaveBeenCalledWith('1043'))

    await usuario.type(campo, '2')
    await screen.findByRole('option', { name: /Ana/ })

    // Recién ahora contesta la primera, con la persona equivocada.
    resolverVieja([cliente({ id: 'c1', nombre: 'Pedro Martínez' })])

    await waitFor(() => expect(screen.queryByText('Pedro Martínez')).not.toBeInTheDocument())
    expect(screen.getByRole('option', { name: /Ana/ })).toBeInTheDocument()
  })
})
