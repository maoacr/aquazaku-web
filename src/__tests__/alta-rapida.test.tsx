import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AltaRapidaDeCliente } from '@/components/clientes/alta-rapida'
import type { Cliente } from '@/lib/api-types'

const crearClienteRapidoAction = vi.fn()

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  crearClienteRapidoAction: (datos: unknown) => crearClienteRapidoAction(datos),
}))

/**
 * El alta rápida — RN-ENV-09.
 *
 * ── Lo que este archivo vigila de verdad ────────────────────────────────────
 *
 * El diálogo se monta DENTRO del formulario de la venta, y ahí los campos de
 * un `<dialog>` pertenecen al formulario que lo rodea. Eso abre dos agujeros
 * que no se ven leyendo el componente aislado:
 *
 * - Un Enter escribiendo el nombre dispara el envío implícito de la venta.
 * - Un botón sin `type="button"` es `submit`, y también cobra.
 *
 * jsdom no implementa el envío implícito, así que un test que espere el
 * `submit` pasa igual con los frenos sacados. Por eso acá se mira
 * `defaultPrevented` y el atributo `type`, que sí son el mecanismo real.
 */

const cliente: Cliente = {
  id: 'nuevo',
  nombre: 'Rosa Elena Padilla',
  documento: 'CC 1.042.857.391',
} as Cliente

function Anfitrion({ alTeclearEnter = vi.fn() }: { alTeclearEnter?: (frenado: boolean) => void }) {
  const [elegido, setElegido] = useState<Cliente | null>(null)

  return (
    <form onKeyDown={(e) => e.key === 'Enter' && alTeclearEnter(e.defaultPrevented)}>
      <AltaRapidaDeCliente
        abierto
        cerrar={vi.fn()}
        documentoInicial="1042857391"
        alRegistrar={setElegido}
      />
      <button type="submit">Cobrar</button>
      <output>{elegido?.nombre ?? 'sin cliente'}</output>
    </form>
  )
}

const llenar = async (usuario: ReturnType<typeof userEvent.setup>) => {
  await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
  await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
  await usuario.type(screen.getByRole('textbox', { name: /Teléfono/ }), '3001234567')
}

beforeEach(() => {
  crearClienteRapidoAction.mockReset()
  crearClienteRapidoAction.mockResolvedValue({ cliente })
})

describe('nada de acá adentro puede cobrar la venta', () => {
  it('ningún botón es de envío', () => {
    render(<Anfitrion />)

    const propios = screen
      .getAllByRole('button')
      .filter((b) => b.textContent !== 'Cobrar')

    expect(propios.length).toBeGreaterThan(1)
    for (const boton of propios) expect(boton).toHaveAttribute('type', 'button')
  })

  it('el Enter en un campo llega frenado al formulario de la venta', async () => {
    const usuario = userEvent.setup()
    const enter = vi.fn()

    render(<Anfitrion alTeclearEnter={enter} />)
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa{Enter}')

    expect(enter).toHaveBeenCalledWith(true)
  })

  /** Y ese Enter hace lo que la gente espera acá: registrar. */
  it('el Enter registra', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await llenar(usuario)
    await usuario.keyboard('{Enter}')

    expect(crearClienteRapidoAction).toHaveBeenCalled()
  })
})

describe('lo que manda', () => {
  it('el documento que ya se había escrito viene puesto', () => {
    render(<Anfitrion />)

    expect(screen.getByRole('textbox', { name: /Número de documento/ })).toHaveValue('1042857391')
  })

  /**
   * El teléfono viaja en el MISMO pedido del alta y no en uno aparte.
   *
   * `POST /clientes/:id/telefonos` pide `clientes:editar`, y el `pos` —que es
   * quien registra en el mostrador— no lo tiene. Partirlo en dos llamadas le
   * daría 403 en la segunda: cliente registrado, sin número al cual llamar.
   */
  it('el teléfono va adentro del alta', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await llenar(usuario)
    await usuario.click(screen.getByRole('button', { name: /Registrar y continuar/ }))

    expect(crearClienteRapidoAction).toHaveBeenCalledWith(
      expect.objectContaining({
        primerNombre: 'Rosa',
        apellidos: 'Padilla',
        numeroDocumento: '1042857391',
        telefono: { numero: '3001234567' },
      }),
    )
  })

  it('sin teléfono, no manda la clave vacía', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await usuario.click(screen.getByRole('button', { name: /Registrar y continuar/ }))

    expect(crearClienteRapidoAction.mock.calls[0]?.[0]).not.toHaveProperty('telefono')
  })

  it('el cliente creado queda elegido, sin salir de la pantalla', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await llenar(usuario)
    await usuario.click(screen.getByRole('button', { name: /Registrar y continuar/ }))

    expect(await screen.findByText('Rosa Elena Padilla')).toBeInTheDocument()
  })
})

describe('lo que no deja mandar', () => {
  it('sin nombre no se puede registrar', () => {
    render(<Anfitrion />)

    expect(screen.getByRole('button', { name: /Registrar y continuar/ })).toBeDisabled()
  })

  /**
   * El mismo mínimo de siete dígitos que el esquema de `api/`. Acá solo
   * adelanta el rechazo: quien manda sigue siendo el servidor.
   */
  it('un teléfono demasiado corto frena el envío y lo dice', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await usuario.type(screen.getByRole('textbox', { name: /Teléfono/ }), '30012')

    expect(screen.getByText(/al menos 7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar y continuar/ })).toBeDisabled()
  })

  /**
   * El botón deshabilitado NO alcanza, y esto lo demuestra.
   *
   * El Enter llama a `registrar()` derecho: no pasa por el botón, así que no
   * hereda su `disabled`. Sin la guarda dentro de la función, un teléfono de
   * cinco dígitos se manda igual con solo apretar Enter — y la validación de
   * la pantalla queda siendo decorativa.
   */
  it('y el Enter tampoco lo manda', async () => {
    const usuario = userEvent.setup()
    render(<Anfitrion />)

    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await usuario.type(screen.getByRole('textbox', { name: /Teléfono/ }), '30012{Enter}')

    expect(crearClienteRapidoAction).not.toHaveBeenCalled()
  })

  it('un error del servidor se muestra y no elige a nadie', async () => {
    const usuario = userEvent.setup()
    crearClienteRapidoAction.mockResolvedValue({ error: 'Ya hay un cliente con ese documento.' })

    render(<Anfitrion />)
    await llenar(usuario)
    await usuario.click(screen.getByRole('button', { name: /Registrar y continuar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Ya hay un cliente/)
    expect(screen.getByText('sin cliente')).toBeInTheDocument()
  })
})
