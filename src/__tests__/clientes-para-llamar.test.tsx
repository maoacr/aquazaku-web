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
  ventaId: 'v1',
  cuantasVentas: 1,
  telefonos: [],
  ...parcial,
})

/** La fila de la tabla que contiene ese texto — el sujeto de casi todo acá. */
const filaCon = (texto: string | RegExp) => screen.getByText(texto).closest('tr')!

/*
 * `productos` y `stock` van vacíos en todos los casos: los consume el mostrador
 * que abre el lápiz, y acá ese modal nunca se abre. Lo que estos tests miran es
 * la fila.
 */

describe('una fila por dirección', () => {
  it('un cliente con dos direcciones aparece dos veces, con su cuenta cada una', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]}
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
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila()]} />)

    expect(screen.getByText('Calle 5 # 3 - 20')).toBeInTheDocument()
    expect(screen.getByText(/la casa/)).toBeInTheDocument()
  })

  it('el nombre lleva a la ficha del cliente', () => {
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila({ clienteId: 'abc-123' })]} />)

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
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila({ ventaSinDireccion: true })]} />)

    expect(
      screen.getByText(/no registró a qué dirección se entregó/, { selector: '.sr-only' }),
    ).toBeInTheDocument()
  })

  it('la fila con dirección propia NO se marca', () => {
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila({ ventaSinDireccion: false })]} />)

    expect(screen.queryByText(/no registró a qué dirección/)).not.toBeInTheDocument()
  })

  it('la cabecera dice CUÁNTAS quedan, para poder ver que la tarea avanza', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]}
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
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila()]} />)

    expect(screen.queryByText(/el conteo viene de una venta/)).not.toBeInTheDocument()
  })
})

describe('la fila cuya venta no registró dirección', () => {
  /*
   * ── La queja que reescribió el modelo ───────────────────────────────────
   *
   * Una versión anterior repartía esas ventas entre TODAS las direcciones del
   * cliente, y cada fila mostraba una dirección concreta al lado de un conteo
   * que no era de esa puerta. Se leía como si ya estuviera asignada.
   *
   * Ahora la celda dice qué falta hacer. Es la diferencia entre una etiqueta
   * que miente y una acción que se puede tocar.
   */
  it('dice «Asignar una dirección» en vez de mostrar una', () => {
    render(
      <ClientesParaLlamar
        productos={[]}
        stock={[]}
        canal="botellones"
        filas={[fila({ direccionId: null, etiqueta: null, direccion: null, ventaSinDireccion: true })]}
      />,
    )

    expect(screen.getByRole('link', { name: 'Yeimy Padilla' })).toBeInTheDocument()
    expect(screen.getByText('Asignar una dirección')).toBeInTheDocument()
  })

  it('la fila con dirección propia muestra la dirección, no la acción', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila()]} />,
    )

    expect(screen.getByText('Calle 5 # 3 - 20')).toBeInTheDocument()
    expect(screen.queryByText('Asignar una dirección')).not.toBeInTheDocument()
  })

  it('el lápiz se nombra según lo que va a hacer', () => {
    render(
      <ClientesParaLlamar
        productos={[]}
        stock={[]}
        canal="botellones"
        filas={[fila({ direccionId: null, etiqueta: null, direccion: null, ventaSinDireccion: true })]}
      />,
    )

    /*
     * «Asignarle la dirección» y no «Corregir la venta»: quien usa lector de
     * pantalla tiene que saber qué botón está tocando, y en esta fila el
     * trabajo concreto es el domicilio.
     */
    expect(
      screen.getByRole('button', { name: /Asignarle la dirección a la venta de Yeimy Padilla/ }),
    ).toBeInTheDocument()
  })
})

/**
 * ── El número de la fila sin dirección BAJA ─────────────────────────────────
 *
 * Es el error que la operación reportó tres veces. Esa fila agrupa todas las
 * ventas viejas del cliente y mostraba los días de la más reciente: al corregir
 * una, la fila pasaba a la siguiente —más vieja— y el número SUBÍA. 40, 47, 54.
 *
 * Se veía como si corregir no hubiera servido de nada. Ahora cuenta ventas, y
 * el número va en la dirección del trabajo hecho.
 */
describe('la fila sin dirección cuenta ventas, no días', () => {
  const sinUbicar = (cuantas: number, dias: number) =>
    fila({
      direccionId: null,
      etiqueta: null,
      direccion: null,
      ventaSinDireccion: true,
      cuantasVentas: cuantas,
      diasSinComprar: dias,
    })

  it('muestra cuántas faltan, no los días de la más reciente', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[sinUbicar(3, 40)]} />,
    )

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('40')).not.toBeInTheDocument()
  })

  it('el detalle dice cuántas son y de cuándo es la más reciente', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[sinUbicar(3, 40)]} />,
    )

    expect(screen.getByText(/3 ventas sin ubicar · la más reciente, hace 40 días/)).toBeInTheDocument()
  })

  it('en singular no dice «1 ventas»', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[sinUbicar(1, 12)]} />,
    )

    expect(screen.getByText('1 venta sin ubicar, de hace 12 días')).toBeInTheDocument()
  })

  it('no lleva píldora de urgencia: no es una llamada', () => {
    render(
      <ClientesParaLlamar
        productos={[]}
        stock={[]}
        canal="botellones"
        filas={[sinUbicar(2, 60)]}
      />,
    )

    /*
     * Con 60 días sería «urgente» en el eje de las llamadas. Pero acá los días
     * no miden una puerta esperando agua: miden la más reciente de dos ventas
     * que no sabemos dónde se entregaron. Pintarla de rojo sería comparar dos
     * cosas distintas en el mismo eje.
     */
    expect(screen.queryByTitle('Urgente')).not.toBeInTheDocument()
  })

  it('las filas con dirección siguen mostrando días', () => {
    render(
      <ClientesParaLlamar
        productos={[]}
        stock={[]}
        canal="botellones"
        filas={[fila({ diasSinComprar: 30, cuantasVentas: 4 })]}
      />,
    )

    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })
})

describe('a qué número se escribe', () => {
  it('el enlace de WhatsApp usa el número de SU línea, no el del vecino', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]}
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
      <ClientesParaLlamar productos={[]} stock={[]}
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
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila({ telefonos: [] })]} />)

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
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila({ urgencia: 'urgente' })]} />)

    /*
     * `title` es lo que ve quien pasa el mouse; el `sr-only` es lo que oye
     * quien usa lector de pantalla. La palabra salió de la pantalla porque era
     * larga y le robaba protagonismo al número — pero salir de la VISTA no es
     * salir del documento.
     */
    expect(screen.getByTitle('Urgente')).toBeInTheDocument()
    expect(screen.getByText(/urgente/, { selector: '.sr-only' })).toBeInTheDocument()
  })

  it('la tercera franja existe y se nombra: al día', () => {
    render(
      <ClientesParaLlamar
        productos={[]}
        stock={[]}
        canal="botellones"
        filas={[fila({ urgencia: 'al-dia', diasSinComprar: 2 })]}
      />,
    )

    /*
     * La lista dejó de filtrar por el umbral: quien compró anteayer también
     * aparece. Sin este estado, consultar «¿cuándo compró éste?» exigía
     * esperar a que se atrasara.
     */
    expect(screen.getByTitle('Al día')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByTitle('Urgente')).not.toBeInTheDocument()
  })

  it('un aviso no se anuncia como urgente', () => {
    render(
      <ClientesParaLlamar productos={[]} stock={[]}
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
      <ClientesParaLlamar productos={[]} stock={[]}
        canal="botellones"
        filas={[
          fila({ direccionId: 'd1', urgencia: 'urgente' }),
          fila({ direccionId: 'd2', urgencia: 'aviso' }),
        ]}
      />,
    )

    expect(screen.getByText(/1 lleva tanto sin recibir/)).toBeInTheDocument()
    expect(screen.getByText(/y 0 al día/)).toBeInTheDocument()
  })
})

describe('la lista vacía', () => {
  /*
   * Se DICE. Una tabla que desaparece se lee como una tabla rota: quien la vio
   * ayer y hoy no la encuentra no piensa «no hay nadie», piensa «se cayó algo».
   */
  /*
   * El vacío cambió de significado.
   *
   * Cuando la lista filtraba por el umbral, vacía quería decir «nadie
   * atrasado» — una buena noticia. Ahora entran todos los que alguna vez
   * compraron, así que vacía significa que NADIE compró nunca de este tipo de
   * producto: un hecho distinto y mucho más raro. Decir lo anterior sería
   * tranquilizar por el motivo equivocado.
   */
  it('en botellones dice que todavía no hay ninguna venta, no que todo está al día', () => {
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[]} />)

    expect(screen.getByText(/Todavía no hay ninguna venta de botellón/)).toBeInTheDocument()
    expect(screen.queryByText(/al día/)).not.toBeInTheDocument()
  })

  it('en otros productos habla de pacas, no de botellones', () => {
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="otros" filas={[]} />)

    expect(screen.getByText(/Todavía no hay ninguna venta de pacas/)).toBeInTheDocument()
  })
})

describe('el encabezado de la tabla', () => {
  it('nombra las cuatro columnas: sin títulos, una planilla no se lee', () => {
    render(<ClientesParaLlamar productos={[]} stock={[]} canal="botellones" filas={[fila()]} />)

    for (const columna of ['Días', 'Cliente', 'Dirección', 'Teléfonos']) {
      expect(screen.getByRole('columnheader', { name: columna })).toBeInTheDocument()
    }
  })
})
