import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EntregaDeBase, SelectorDeDireccion } from '@/components/retornables/entrega-de-base'
import type { Cliente, Direccion } from '@/lib/api-types'

const direccionesDeClienteAction = vi.fn()

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  direccionesDeClienteAction: (id: string) => direccionesDeClienteAction(id),
}))

/**
 * Llevarse una base con la venta — RN-BAS-03.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que las direcciones que se ven sean las del cliente que está elegido AHORA.
 * Es la equivocación más cara posible en esta pantalla: si se muestran las del
 * anterior, la base queda prestada en la casa de otra persona — y una base se
 * reclama yendo al lugar donde el sistema dice que está.
 *
 * Y que sin cliente no se ofrezca nada: una base va a una dirección, no a una
 * persona, así que sin saber de quién no hay dónde apuntar.
 */

const cliente = (id: string, nombre: string): Cliente => ({ id, nombre }) as Cliente

const direccion = (id: string, etiqueta: string): Direccion =>
  ({ id, etiqueta, legible: 'CL 30 # 12 - 45' }) as Direccion

beforeEach(() => {
  direccionesDeClienteAction.mockReset()
  direccionesDeClienteAction.mockResolvedValue([])
})

describe('sin cliente no hay base', () => {
  it('no ofrece nada', () => {
    const { container } = render(<EntregaDeBase cliente={null} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('ni siquiera pregunta al servidor', () => {
    render(<EntregaDeBase cliente={null} />)

    expect(direccionesDeClienteAction).not.toHaveBeenCalled()
  })
})

describe('con cliente', () => {
  it('se abre y pide el código del sticker, no una lista', async () => {
    const usuario = userEvent.setup()
    direccionesDeClienteAction.mockResolvedValue([direccion('d1', 'La casa')])

    render(<EntregaDeBase cliente={cliente('c1', 'Rosa Padilla')} />)
    await usuario.click(screen.getByRole('button', { name: /Se lleva una base/ }))

    const sticker = await screen.findByRole('textbox', { name: /Código de la base/ })
    expect(sticker).toHaveAttribute('name', 'baseSticker')
    expect(screen.queryByRole('combobox', { name: /Código de la base/ })).toBeNull()
  })

  /**
   * Preguntar entre una sola opción es una pregunta que no existe.
   *
   * Se mira lo que VIAJARÍA en el formulario, no lo que dibuja el select: el
   * navegador muestra la única opción igual, así que mirar la pantalla no
   * distingue «elegida» de «el DOM la mostró por defecto». Lo que decide es qué
   * sale en el `FormData`.
   */
  it('con una sola dirección, es la que viaja en el formulario', async () => {
    direccionesDeClienteAction.mockResolvedValue([direccion('d1', 'La casa')])

    const { container } = render(
      <form>
        <SelectorDeDireccion cliente={cliente('c1', 'Rosa')} name="baseDireccionId" />
      </form>,
    )

    await screen.findByRole('combobox', { name: /A qué dirección/ })
    await waitFor(() =>
      expect(new FormData(container.querySelector('form')!).get('baseDireccionId')).toBe('d1'),
    )
    expect(screen.queryByRole('option', { name: 'Elija una' })).toBeNull()
  })

  /** Sin cliente el selector no existe: no hay a quién pedirle direcciones. */
  it('sin cliente, el selector no se dibuja', () => {
    const { container } = render(<SelectorDeDireccion cliente={null} name="baseDireccionId" />)

    expect(container).toBeEmptyDOMElement()
    expect(direccionesDeClienteAction).not.toHaveBeenCalled()
  })

  it('con varias, hay que elegir', async () => {
    direccionesDeClienteAction.mockResolvedValue([
      direccion('d1', 'La casa'),
      direccion('d2', 'El local'),
    ])

    render(<SelectorDeDireccion cliente={cliente('c1', 'Rosa')} name="baseDireccionId" />)

    await screen.findByRole('option', { name: /La casa/ })
    expect(screen.getByRole('combobox', { name: /A qué dirección/ })).toHaveValue('')
  })

  /**
   * Sin direcciones hay que DECIRLO y decir qué hacer. Un desplegable vacío
   * deja a quien atiende mirando la pantalla sin saber por qué no puede.
   */
  it('sin direcciones, explica dónde cargarlas', async () => {
    direccionesDeClienteAction.mockResolvedValue([])

    render(<SelectorDeDireccion cliente={cliente('c1', 'Rosa Padilla')} name="baseDireccionId" />)

    expect(await screen.findByText(/no tiene ninguna dirección cargada/)).toBeInTheDocument()
    expect(screen.getByText(/desde su ficha/)).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})

/**
 * ── La guarda de carrera ────────────────────────────────────────────────────
 *
 * Dos consultas en vuelo pueden volver al revés. Si la del cliente anterior
 * llega después, sus direcciones se pintarían bajo el cliente nuevo — y la base
 * quedaría prestada en la casa de otra persona.
 *
 * La guarda no es un flag: es que la respuesta se guarda CON el id de quién es,
 * y las direcciones se derivan comparándolo.
 */
describe('respuestas que llegan tarde', () => {
  function Anfitrion() {
    const [elegido, setElegido] = useState<Cliente | null>(cliente('c1', 'Rosa'))

    return (
      <>
        <button type="button" onClick={() => setElegido(cliente('c2', 'Ana'))}>
          cambiar de cliente
        </button>
        <SelectorDeDireccion cliente={elegido} name="baseDireccionId" />
      </>
    )
  }

  it('las direcciones del cliente anterior no se muestran bajo el nuevo', async () => {
    const usuario = userEvent.setup()

    let resolverVieja!: (d: Direccion[]) => void
    direccionesDeClienteAction.mockImplementation((id: string) =>
      id === 'c1'
        ? new Promise<Direccion[]>((r) => {
            resolverVieja = r
          })
        : Promise.resolve([direccion('d2', 'La de Ana')]),
    )

    render(<Anfitrion />)
    await waitFor(() => expect(direccionesDeClienteAction).toHaveBeenCalledWith('c1'))

    await usuario.click(screen.getByRole('button', { name: 'cambiar de cliente' }))
    await waitFor(() => expect(direccionesDeClienteAction).toHaveBeenCalledWith('c2'))

    /*
     * Se mira el VALOR del select y no las opciones por rol: un `<select>` de
     * una sola opción no expone `role="option"` hasta desplegarse, y de todas
     * formas lo que importa es qué id terminaría guardado — no qué se dibuja.
     */
    const select = screen.getByRole('combobox', { name: /A qué dirección/ })
    await waitFor(() => expect(select).toHaveValue('d2'))

    // Recién ahora contesta la primera, con la dirección equivocada.
    resolverVieja([direccion('d1', 'La de Rosa')])
    await new Promise((r) => setTimeout(r, 50))

    expect(select).toHaveValue('d2')
    expect(select.textContent).not.toMatch(/La de Rosa/)
    expect(select.textContent).toMatch(/La de Ana/)
  })
})
