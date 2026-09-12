import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AltaEnPasos } from '@/components/clientes/alta-en-pasos'
import type { Cliente } from '@/lib/api-types'

const buscarClientesAction = vi.fn()
const crearClienteRapidoAction = vi.fn()

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  buscarClientesAction: (d: string) => buscarClientesAction(d),
  crearClienteRapidoAction: (datos: unknown) => crearClienteRapidoAction(datos),
}))

/**
 * El alta en pasos — M16.
 *
 * ── Por qué un stepper y no un formulario largo ─────────────────────────────
 *
 * El alta pedía nueve campos en una sola columna, y la dirección quedaba fuera:
 * había que registrar al cliente y después buscarlo otra vez para cargársela.
 * En el mostrador eso pasa con alguien esperando enfrente.
 *
 * Tres pasos, y cada uno contesta una pregunta:
 *
 *   1. **Quién es** — el documento primero, para no escribir nada si ya existe
 *   2. **A qué número llamarlo**
 *   3. **Dónde queda**
 *
 * ── Y por qué UN solo envío al final ────────────────────────────────────────
 *
 * `POST /clientes` acepta cliente, teléfono y dirección en una transacción. Con
 * tres envíos, un fallo en el tercero dejaría un cliente a medio cargar y quien
 * atiende no sabría qué quedó guardado.
 */

const cliente = (p: Partial<Cliente> = {}): Cliente =>
  ({
    id: 'c1',
    nombre: 'Rosa Padilla',
    tipoDocumento: 'CC',
    numeroDocumento: '79123456',
    ...p,
  }) as Cliente

const props = {
  abierto: true,
  cerrar: vi.fn(),
  departamentos: [{ codigo: '08', nombre: 'Atlántico' }],
  municipios: [{ codigo: '08137', departamento: '08', nombre: 'Campo de la Cruz', lat: 10, lng: -74 }],
}

beforeEach(() => {
  buscarClientesAction.mockReset()
  buscarClientesAction.mockResolvedValue([])
  crearClienteRapidoAction.mockReset()
  crearClienteRapidoAction.mockResolvedValue({ cliente: cliente() })
  props.cerrar.mockReset()
})

async function escribirDocumento(texto: string) {
  const usuario = userEvent.setup()
  await usuario.type(screen.getByRole('textbox', { name: /Número/ }), texto)
}

describe('el recorrido', () => {
  it('arranca en el paso 1, y lo dice', async () => {
    render(<AltaEnPasos {...props} />)

    expect(screen.getByText(/Paso 1 de 3/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Número/ })).toBeInTheDocument()
  })

  /*
   * El paso 1 no deja avanzar sin documento. Es el dato que identifica al
   * cliente: sin él no hay a quién reclamarle nada (RN-CLI-13).
   */
  it('no deja pasar del 1 sin documento', async () => {
    render(<AltaEnPasos {...props} />)

    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled()
  })

  it('con documento libre y nombre, avanza al 2', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')

    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))

    expect(screen.getByText(/Paso 2 de 3/)).toBeInTheDocument()
  })

  it('se puede volver atrás sin perder lo escrito', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))

    await usuario.click(screen.getByRole('button', { name: /Atrás/ }))

    expect(screen.getByText(/Paso 1 de 3/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Primer nombre/ })).toHaveValue('Rosa')
  })
})

describe('el documento tomado frena en el paso 1', () => {
  /*
   * Si ese cliente ya existe no hay nada que registrar, y avanzar sería hacer
   * escribir un nombre para nada.
   */
  /*
   * ── El nombre se escribe A PROPÓSITO ──────────────────────────────────────
   *
   * La primera versión de este test no lo escribía, y el botón quedaba
   * deshabilitado igual — por falta de nombre, no por el documento tomado.
   * Pasaba por la razón equivocada: la ablación de `documentoLibre` lo dejó
   * verde, que es la señal de un test decorativo.
   *
   * Con el nombre completo, lo ÚNICO que puede frenar el paso es el documento.
   */
  it('no deja avanzar aunque el nombre esté completo, y ofrece su ficha', async () => {
    const usuario = userEvent.setup()
    buscarClientesAction.mockResolvedValue([cliente()])
    render(<AltaEnPasos {...props} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')

    expect(await screen.findByRole('link', { name: /ficha|ver/i })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeDisabled())
  })
})

describe('los pasos 2 y 3 se pueden saltar', () => {
  async function llegarAlPaso(n: 2 | 3) {
    const usuario = userEvent.setup()
    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))
    if (n === 3) await usuario.click(screen.getByRole('button', { name: /Siguiente|sin teléfono/i }))
  }

  /*
   * Un cliente sin teléfono es un cliente válido. Uno que nadie registró porque
   * el formulario exigía datos que no estaban a mano, no.
   */
  it('el teléfono no es obligatorio', async () => {
    render(<AltaEnPasos {...props} />)
    await llegarAlPaso(2)

    expect(screen.getByRole('button', { name: /Siguiente|sin teléfono/i })).toBeEnabled()
  })

  it('la dirección tampoco', async () => {
    render(<AltaEnPasos {...props} />)
    await llegarAlPaso(3)

    expect(screen.getByText(/Paso 3 de 3/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Registrar/ })).toBeEnabled()
  })
})

describe('el envío', () => {
  /*
   * UNA sola llamada con todo. `POST /clientes` lo mete en una transacción: con
   * tres envíos, un fallo en el tercero dejaría un cliente a medio cargar.
   */
  it('manda cliente, teléfono y dirección en un solo viaje', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))

    await usuario.type(screen.getByRole('textbox', { name: /Teléfono/ }), '3001234567')
    await usuario.click(screen.getByRole('button', { name: /Siguiente|sin teléfono/i }))

    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    await waitFor(() => expect(crearClienteRapidoAction).toHaveBeenCalledTimes(1))

    const enviado = crearClienteRapidoAction.mock.calls[0]![0]
    expect(enviado).toMatchObject({
      numeroDocumento: '79123456',
      primerNombre: 'Rosa',
      apellidos: 'Padilla',
      telefono: { numero: '3001234567' },
    })
  })

  it('avisa a quien lo abrió con el cliente creado', async () => {
    const usuario = userEvent.setup()
    const alCrear = vi.fn()
    render(<AltaEnPasos {...props} alCrear={alCrear} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))
    await usuario.click(screen.getByRole('button', { name: /Siguiente|sin teléfono/i }))
    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    await waitFor(() => expect(alCrear).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' })))
  })
})
