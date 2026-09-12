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

    await usuario.click(screen.getByRole('button', { name: /Volver al paso anterior/ }))

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

    await usuario.type(screen.getByRole('textbox', { name: /Teléfono 1/ }), '3001234567')
    await usuario.click(screen.getByRole('button', { name: /Siguiente|sin teléfono/i }))

    /*
     * La dirección se ESCRIBE. Sin esto el caso no probaba lo que su nombre
     * dice: pasaba en verde con la dirección rota, que es como llegó rota a
     * producción.
     */
    await usuario.type(screen.getByRole('textbox', { name: /Cómo la llaman/ }), 'La casa')
    await usuario.type(screen.getByRole('textbox', { name: /Número de la vía/ }), '30')

    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    await waitFor(() => expect(crearClienteRapidoAction).toHaveBeenCalledTimes(1))

    const enviado = crearClienteRapidoAction.mock.calls[0]![0]
    expect(enviado).toMatchObject({
      numeroDocumento: '79123456',
      primerNombre: 'Rosa',
      apellidos: 'Padilla',
      telefonos: [{ numero: '3001234567' }],
      direccion: { etiqueta: 'La casa', viaNumero: '30' },
    })

    /*
     * Y NO se lleva puesto el documento del cliente. Los campos del paso 1
     * también tienen `name`, y un `FormData` del formulario entero los metía
     * adentro de la dirección.
     */
    expect(enviado.direccion).not.toHaveProperty('numeroDocumento')
    expect(enviado.direccion).not.toHaveProperty('tipoDocumento')
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

/**
 * Varios teléfonos en el paso 2 — M16.
 *
 * ── Por qué no alcanzaba con uno ────────────────────────────────────────────
 *
 * Un comercial tiene el celular del dueño y el fijo del local, y son dos cosas
 * distintas: al primero se le escribe por WhatsApp, al segundo solo se le
 * llama. Ya hay una regla construida sobre esa diferencia — el botón de
 * WhatsApp no se dibuja sobre un fijo.
 *
 * Y agregarle el segundo después exige `clientes:editar`, que el `pos` no
 * tiene. Con un solo campo, quien atiende el mostrador capturaba uno y el otro
 * se perdía.
 */
describe('varios teléfonos', () => {
  const llegarAlPaso2 = async (usuario: ReturnType<typeof userEvent.setup>) => {
    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))
  }

  it('los dos viajan en el mismo alta, cada uno con su etiqueta', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await llegarAlPaso2(usuario)

    await usuario.type(screen.getByRole('textbox', { name: /Teléfono 1/ }), '3001234567')
    await usuario.type(screen.getAllByRole('textbox', { name: /Cómo se llama/ })[0]!, 'el celular')

    await usuario.click(screen.getByRole('button', { name: /Agregar otro número/ }))

    await usuario.type(screen.getByRole('textbox', { name: /Teléfono 2/ }), '6058781234')
    await usuario.type(screen.getAllByRole('textbox', { name: /Cómo se llama/ })[1]!, 'el fijo')

    await usuario.click(screen.getByRole('button', { name: /Siguiente|sin teléfono/i }))
    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    await waitFor(() => expect(crearClienteRapidoAction).toHaveBeenCalledTimes(1))

    expect(crearClienteRapidoAction.mock.calls[0]![0].telefonos).toEqual([
      { numero: '3001234567', etiqueta: 'el celular' },
      { numero: '6058781234', etiqueta: 'el fijo' },
    ])
  })

  /*
   * Borrar la PRIMERA de tres es el caso que rompe si las filas se identifican
   * por posición: con el índice como clave, React reusa el nodo y los valores
   * se corren una fila hacia arriba.
   */
  it('quitar una fila se lleva su número y no el del vecino', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await llegarAlPaso2(usuario)

    await usuario.type(screen.getByRole('textbox', { name: /Teléfono 1/ }), '3001111111')
    await usuario.click(screen.getByRole('button', { name: /Agregar otro número/ }))
    await usuario.type(screen.getByRole('textbox', { name: /Teléfono 2/ }), '3002222222')

    await usuario.click(screen.getByRole('button', { name: /Quitar el teléfono 1/ }))

    expect(screen.getByRole('textbox', { name: /Teléfono 1/ })).toHaveValue('3002222222')
    expect(screen.queryByRole('textbox', { name: /Teléfono 2/ })).toBeNull()
  })

  /*
   * La fila vacía de arranque no puede convertirse en un teléfono en blanco:
   * `api` exige siete dígitos y rebotaría el alta entera al final de los tres
   * pasos.
   */
  it('una fila vacía no viaja', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await llegarAlPaso2(usuario)
    await usuario.click(screen.getByRole('button', { name: /sin teléfono/i }))
    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    await waitFor(() => expect(crearClienteRapidoAction).toHaveBeenCalledTimes(1))

    expect(crearClienteRapidoAction.mock.calls[0]![0]).not.toHaveProperty('telefonos')
  })
})

/**
 * El paso 3 no se puede saltar — el defecto que este bloque existe para impedir.
 *
 * ── Lo que pasaba ───────────────────────────────────────────────────────────
 *
 * En el paso 2, un clic en «Seguir sin teléfono» registraba al cliente ahí
 * mismo, sin dirección y sin pasar por el paso 3.
 *
 * El primario es UN solo `<button>` que React reusa entre pasos. El clic pasaba
 * el estado a 3, React repintaba de forma síncrona y le dejaba
 * `type="submit"` — y recién DESPUÉS el navegador evaluaba la acción por
 * defecto del clic, sobre el botón ya cambiado. Enviaba el formulario, y
 * `onSubmit` con `paso === 3` registraba.
 *
 * ── Por qué se mira el ATRIBUTO y no el comportamiento ──────────────────────
 *
 * jsdom no implementa el envío implícito de un `submit`. Un test que hiciera el
 * clic y esperara no ver el alta pasaría IGUAL con el bug puesto: pasaría por
 * la razón equivocada. Lo que se vigila es el mecanismo — que ningún botón de
 * acá traiga acción por defecto —, que es lo mismo que vigila el alta del
 * mostrador, donde un botón sin `type` cobraba la venta.
 */
describe('el paso 3 no se puede saltar', () => {
  it('ningún botón del alta es de envío', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())

    for (const paso of [1, 2, 3]) {
      for (const boton of screen.getAllByRole('button')) {
        expect(boton, `paso ${paso}: «${boton.textContent}»`).toHaveAttribute('type', 'button')
      }

      if (paso < 3) await usuario.click(screen.getByRole('button', { name: /Siguiente|sin teléfono/i }))
    }
  })

  it('seguir sin teléfono lleva al paso 3, no al alta', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))
    await usuario.click(screen.getByRole('button', { name: /sin teléfono/i }))

    expect(screen.getByText(/Paso 3 de 3/)).toBeInTheDocument()
    expect(crearClienteRapidoAction).not.toHaveBeenCalled()
  })
})

/**
 * La dirección escrita no se puede perder en silencio — el defecto reportado.
 *
 * `api` exige la etiqueta: «la casa», «el local». Es lo que distingue una
 * dirección de otra cuando el cliente tiene tres.
 *
 * El paso 3 la trataba como cualquier otro campo opcional, y armaba la
 * dirección SOLO si venía la etiqueta. Quien llenaba vía, placa, municipio y
 * departamento y no le ponía nombre, daba «Registrar cliente», veía el alta
 * salir bien, y abría la ficha sin dirección. Ocho campos tirados sin decir una
 * palabra.
 */
describe('la dirección a medias', () => {
  const llegarAlPaso3 = async (usuario: ReturnType<typeof userEvent.setup>) => {
    await escribirDocumento('79123456')
    await usuario.type(screen.getByRole('textbox', { name: /Primer nombre/ }), 'Rosa')
    await usuario.type(screen.getByRole('textbox', { name: /Apellidos/ }), 'Padilla')
    await waitFor(() => expect(screen.getByRole('button', { name: /Siguiente/ })).toBeEnabled())
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }))
    await usuario.click(screen.getByRole('button', { name: /sin teléfono/i }))
  }

  it('sin etiqueta, avisa y no registra a nadie', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await llegarAlPaso3(usuario)
    await usuario.type(screen.getByRole('textbox', { name: /Número de la vía/ }), '30')
    await usuario.type(screen.getByRole('textbox', { name: /Número de la placa/ }), '12')

    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Cómo la llaman|nombre/i)
    expect(crearClienteRapidoAction).not.toHaveBeenCalled()
  })

  /* Sin NADA escrito sigue siendo válido: la dirección es opcional de verdad. */
  it('vacía del todo, el alta sigue', async () => {
    const usuario = userEvent.setup()
    render(<AltaEnPasos {...props} />)

    await llegarAlPaso3(usuario)
    await usuario.click(screen.getByRole('button', { name: /Registrar/ }))

    await waitFor(() => expect(crearClienteRapidoAction).toHaveBeenCalledTimes(1))
    expect(crearClienteRapidoAction.mock.calls[0]![0]).not.toHaveProperty('direccion')
  })
})
