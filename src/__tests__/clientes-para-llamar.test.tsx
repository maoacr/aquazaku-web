import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClientesParaLlamar } from '@/components/clientes/para-llamar'
import type { DireccionALlamar } from '@/lib/api-types'

/**
 * Las direcciones para llamar — M15.
 *
 * ── Lo que este archivo vigila ──────────────────────────────────────────────
 *
 * Que el botón de WhatsApp **no aparezca sobre un fijo**. `wa.me` con un número
 * que no tiene WhatsApp abre la app y contesta que no existe: un callejón sin
 * salida que quien atiende lee como «el sistema está roto», y que lo hace
 * desconfiar del botón también donde sí funciona.
 *
 * Que el enlace lleve al número CORRECTO. Un dedazo ahí manda el mensaje de un
 * cliente al teléfono de otro — con su nombre adentro.
 *
 * Y que **un cliente con dos direcciones se lea como dos filas**, cada una con
 * su cuenta. Es el bug que motivó todo el cambio: con una fila por cliente, el
 * local llevaba veinte días seco detrás de una casa que pidió ayer.
 *
 * ── Lo que NO vigila, y por qué ─────────────────────────────────────────────
 *
 * Nada de espaciado, alto de fila ni encabezado pegajoso. `jsdom` no hace
 * layout: `position: sticky` y `max-h` existen en el `class` y no se calculan.
 * Un test verde acá no dice nada sobre lo que se ve — eso se mide en el
 * navegador.
 */

const fila = (parcial: Partial<DireccionALlamar> = {}): DireccionALlamar => ({
  clienteId: 'c1',
  nombre: 'Yeimy Padilla',
  documento: '79123456',
  direccionId: 'd1',
  etiqueta: 'la casa',
  direccion: 'Calle 5 # 3 - 20',
  diasSinComprar: 10,
  urgencia: 'urgente',
  ventaSinDireccion: false,
  telefonos: [],
  ...parcial,
})

/** La fila de la tabla que contiene ese texto — el sujeto de casi todo acá. */
const filaCon = (texto: string | RegExp) => screen.getByText(texto).closest('tr')!

describe('una fila por dirección', () => {
  it('un cliente con dos direcciones aparece dos veces, con su cuenta cada una', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[
          fila({ direccionId: 'd1', etiqueta: 'el local', diasSinComprar: 20 }),
          fila({ direccionId: 'd2', etiqueta: 'la casa', diasSinComprar: 9 }),
        ]}
      />,
    )

    expect(screen.getAllByRole('link', { name: 'Yeimy Padilla' })).toHaveLength(2)
    expect(within(filaCon('el local')).getByText('20')).toBeInTheDocument()
    expect(within(filaCon('la casa')).getByText('9')).toBeInTheDocument()
  })

  it('la dirección se lee en la fila, no hay que abrir la ficha para saber cuál es', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila()]} />)

    expect(screen.getByText('Calle 5 # 3 - 20')).toBeInTheDocument()
    expect(screen.getByText(/la casa/)).toBeInTheDocument()
  })

  it('el nombre lleva a la ficha del cliente', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila({ clienteId: 'abc-123' })]} />)

    expect(screen.getByRole('link', { name: 'Yeimy Padilla' })).toHaveAttribute(
      'href',
      '/modulos/clientes/abc-123',
    )
  })
})

describe('la marca de la venta sin dirección asignada', () => {
  /*
   * No es una nota al pie: es la cola de trabajo de quien va a corregir a mano
   * las ventas anteriores a la migración 0022. Si no se ve, esas ventas no se
   * corrigen nunca.
   */
  /*
   * La marca cuelga del NÚMERO, no de la dirección.
   *
   * Hubo un badge «sin asignar» al lado de la etiqueta de la dirección y era
   * confuso con razón: se leía como «esta dirección no está asignada», que es
   * falso — la dirección existe y es del cliente. Lo que no se registró es a
   * cuál de sus puertas fue LA VENTA, o sea que la duda es sobre el conteo.
   */
  it('la fila marcada lo explica a quien no ve el asterisco', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila({ ventaSinDireccion: true })]} />)

    expect(
      screen.getByText(/no registró a qué dirección se entregó/, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('la fila con dirección propia NO se marca', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila({ ventaSinDireccion: false })]} />)

    expect(screen.queryByText(/no registró a qué dirección/)).not.toBeInTheDocument()
  })

  it('la cabecera dice CUÁNTAS quedan, para poder ver que la tarea avanza', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[
          fila({ direccionId: 'd1', ventaSinDireccion: true }),
          fila({ direccionId: 'd2', ventaSinDireccion: true }),
          fila({ direccionId: 'd3', ventaSinDireccion: false }),
        ]}
      />,
    )

    expect(
      screen.getByText(/en 2 filas el conteo viene de una venta que no registró/),
    ).toBeInTheDocument()
  })

  it('sin ninguna marcada, la cabecera no menciona el tema', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila()]} />)

    expect(screen.queryByText(/el conteo viene de una venta/)).not.toBeInTheDocument()
  })
})

describe('el cliente sin ninguna dirección cargada', () => {
  /*
   * Aparece igual. Es el mismo criterio que «sin teléfono cargado»: la lista
   * existe para mostrar trabajo, y acá el trabajo es cargarle la dirección. Una
   * fila que se va sola es trabajo que nadie ve.
   */
  it('aparece, y lo dice en vez de mostrar una celda vacía', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[fila({ direccionId: null, etiqueta: null, direccion: null })]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Yeimy Padilla' })).toBeInTheDocument()
    expect(screen.getByText('Sin dirección cargada')).toBeInTheDocument()
  })
})

describe('a qué número se escribe', () => {
  it('el enlace de WhatsApp usa el número de SU línea, no el del vecino', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[
          fila({
            telefonos: [
              { numero: '300 111 1111', etiqueta: 'el dueño', whatsapp: '573001111111' },
              { numero: '301 222 2222', etiqueta: 'la señora', whatsapp: '573012222222' },
            ],
          }),
        ]}
      />,
    )

    expect(
      screen.getByRole('link', { name: /a Yeimy Padilla al 300 111 1111/ }),
    ).toHaveAttribute('href', 'https://wa.me/573001111111')
    expect(
      screen.getByRole('link', { name: /a Yeimy Padilla al 301 222 2222/ }),
    ).toHaveAttribute('href', 'https://wa.me/573012222222')
  })

  it('un fijo se muestra pero NO ofrece WhatsApp', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[
          fila({
            telefonos: [{ numero: '605 878 1234', etiqueta: 'el fijo', whatsapp: null }],
          }),
        ]}
      />,
    )

    expect(screen.getByText('605 878 1234')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument()
  })

  it('sin teléfono cargado la fila aparece igual: hay que saber que falta el dato', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila({ telefonos: [] })]} />)

    expect(screen.getByText('Sin teléfono cargado')).toBeInTheDocument()
  })
})

describe('la urgencia no vive solo en el color', () => {
  /*
   * Quien no distingue rojo de ámbar tiene que poder triar esta lista igual, y
   * esta pantalla se mira de reojo entre cliente y cliente. La palabra acompaña
   * al color; no lo reemplaza ni depende de él.
   */
  it('lo urgente se nombra, aunque la palabra no esté a la vista', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila({ urgencia: 'urgente' })]} />)

    /*
     * `title` es lo que ve quien pasa el mouse; el `sr-only` es lo que oye
     * quien usa lector de pantalla. La palabra salió de la pantalla porque era
     * larga y le robaba protagonismo al número — pero salir de la VISTA no es
     * salir del documento.
     */
    expect(screen.getByTitle('Urgente')).toBeInTheDocument()
    expect(screen.getByText(/urgente/, { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('un aviso no se anuncia como urgente', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[fila({ urgencia: 'aviso', diasSinComprar: 6 })]}
      />,
    )

    expect(screen.getByTitle('Aviso')).toBeInTheDocument()
    expect(screen.queryByTitle('Urgente')).not.toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('la cabecera cuenta cuántas urgentes hay', () => {
    render(
      <ClientesParaLlamar
        canal="botellones"
        filas={[
          fila({ direccionId: 'd1', urgencia: 'urgente' }),
          fila({ direccionId: 'd2', urgencia: 'aviso' }),
        ]}
      />,
    )

    expect(screen.getByText(/y 1 hace rato que está sin recibir/)).toBeInTheDocument()
  })
})

describe('la lista vacía', () => {
  /*
   * Se DICE. Una tabla que desaparece se lee como una tabla rota: quien la vio
   * ayer y hoy no la encuentra no piensa «no hay nadie», piensa «se cayó algo».
   */
  it('en botellones dice que todo está al día', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[]} />)

    expect(screen.getAllByText(/La lista está al día/).length).toBeGreaterThan(0)
  })

  it('en otros productos habla de pacas, no de botellones', () => {
    render(<ClientesParaLlamar canal="otros" filas={[]} />)

    expect(screen.getAllByText(/Ninguna dirección está atrasada con pacas/).length).toBeGreaterThan(
      0,
    )
  })
})

describe('el encabezado de la tabla', () => {
  it('nombra las cuatro columnas: sin títulos, una planilla no se lee', () => {
    render(<ClientesParaLlamar canal="botellones" filas={[fila()]} />)

    for (const columna of ['Días', 'Cliente', 'Dirección', 'Teléfonos']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeInTheDocument()
    }
  })
})
