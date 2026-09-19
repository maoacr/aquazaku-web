import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UltimasVentas } from '@/components/ventas/ultimas-ventas'
import type { VentaDelListado } from '@/lib/api-types'

/**
 * La misma lista, mirada desde dos lados.
 *
 * ── La jerarquía la fija el CONTEXTO, no la tarjeta ─────────────────────────
 *
 * Arriba de cada tarjeta va el dato que distingue una venta de otra, y ese dato
 * cambia según dónde se esté parado:
 *
 * · en la pantalla de ventas, veinte tarjetas son de veinte personas: distingue
 *   **a quién**;
 * · en la ficha de un cliente, las veinte son de la misma persona. El nombre
 *   repetido veinte veces no distingue nada —es ruido con el peso tipográfico
 *   de un título— y lo que distingue pasa a ser **cuándo**.
 */
const CREADA = '2026-09-15T20:00:00.000Z'
const CUANDO = '15/09/26, 3:00 p. m.'

function venta(sobrescribe: Partial<VentaDelListado> = {}): VentaDelListado {
  return {
    id: 'v1',
    clienteId: 'c1',
    clienteNombre: 'Yeimy Poveda',
    clienteDocumento: 'CC 79.123.456',
    tipoClienteAlMomento: 'residencial',
    medioDePago: 'efectivo',
    canal: 'mostrador',
    tipo: 'producto',
    estado: 'confirmada',
    total: '20000.00',
    codigoDescuentoId: null,
    requiereFacturaElectronica: false,
    registradoPor: 'u1',
    registradoPorNombre: 'Ana Gómez',
    createdAt: CREADA,
    anuladaPor: null,
    anuladaEn: null,
    motivoAnulacion: null,
    corrigeAId: null,
    corregidaPorId: null,
    lineas: [
      {
        productoId: 'p1',
        productoNombre: 'Recarga de botellón de 20 L',
        cantidad: 2,
        precioFinal: '10000.00',
        precioManual: false,
      },
    ],
    ...sobrescribe,
  }
}

const titulo = () => screen.getByRole('heading', { level: 3 }).textContent

describe('en la pantalla de ventas, arriba va a QUIÉN', () => {
  it('el título de la tarjeta es el nombre del cliente', () => {
    render(<UltimasVentas ventas={[venta()]} />)

    expect(titulo()).toBe('Yeimy Poveda')
  })

  it('y la fecha va en el pie, con el canal y quién la cargó', () => {
    render(<UltimasVentas ventas={[venta()]} />)

    expect(screen.getByText(new RegExp(`^${CUANDO} · Mostrador · Ana Gómez$`))).toBeInTheDocument()
  })

  it('el vacío habla del negocio', () => {
    render(<UltimasVentas ventas={[]} />)

    expect(screen.getByText('Todavía no hay ventas')).toBeInTheDocument()
  })
})

describe('en la ficha del cliente, arriba va CUÁNDO', () => {
  const enLaFicha = (ventas: VentaDelListado[]) =>
    render(<UltimasVentas ventas={ventas} desde="la-ficha-del-cliente" />)

  it('el nombre del cliente no se repite en cada tarjeta', () => {
    enLaFicha([venta(), venta({ id: 'v2' })])

    expect(screen.queryByText('Yeimy Poveda')).not.toBeInTheDocument()
  })

  it('el título de la tarjeta es la fecha y la hora', () => {
    enLaFicha([venta()])

    expect(titulo()).toBe(CUANDO)
  })

  /*
   * Subirla al título y dejarla también en el pie sería escribir el mismo dato
   * dos veces en cuatro centímetros de tarjeta.
   */
  it('y entonces el pie ya no la repite', () => {
    enLaFicha([venta()])

    expect(screen.getByText('Mostrador · Ana Gómez')).toBeInTheDocument()
  })

  it('lo que salió y la plata siguen estando', () => {
    enLaFicha([venta()])

    expect(screen.getByText(/Recarga de botellón de 20 L/)).toBeInTheDocument()
    expect(screen.getByText('$20.000')).toBeInTheDocument()
  })

  it('el vacío habla del cliente, no del negocio', () => {
    enLaFicha([])

    expect(screen.getByText('Este cliente todavía no compró')).toBeInTheDocument()
  })
})

/**
 * Las ventas con precio escrito a mano se ven en la lista — RN-VEN-15.
 *
 * ── Por qué acá y no solo en Auditoría ──────────────────────────────────────
 *
 * `ventas:precio_manual` guarda el delta contra la lista, pero vive en otra
 * pantalla: hay que acordarse de ir. Ésta se mira todos los días, y hasta acá
 * una venta a $3.800 se dibujaba igual que una a $10.000.
 *
 * Un control que exige acordarse no es un control — y son ventas como cualquier
 * otra: suman al total, al reporte y al arqueo. Esconder que se cobraron
 * distinto es esconderlo justo donde se iba a ver.
 */
describe('una venta con precio escrito a mano', () => {
  const conPrecioManual = () =>
    venta({
      total: '7600.00',
      lineas: [
        {
          productoId: 'p1',
          productoNombre: 'Recarga de botellón de 20 L',
          cantidad: 2,
          precioFinal: '3800.00',
          precioManual: true,
        },
      ],
    })

  it('muestra el precio que se cobró', () => {
    render(<UltimasVentas ventas={[conPrecioManual()]} />)

    expect(screen.getByText(/3\.800/)).toBeInTheDocument()
  })

  it('dice que ese precio lo escribió alguien', () => {
    render(<UltimasVentas ventas={[conPrecioManual()]} />)

    expect(screen.getByText(/a mano/i)).toBeInTheDocument()
  })

  /**
   * Sin esto, el precio en la línea manual se leería como una columna que la
   * lista siempre tuvo y que en las demás filas quedó vacía por un error.
   * El precio aparece SOLO cuando alguien lo escribió; su ausencia significa
   * «se cobró la lista».
   */
  it('una venta a precio de lista no muestra ningún precio por línea', () => {
    render(
      <UltimasVentas
        ventas={[
          venta({
            lineas: [
              {
                productoId: 'p1',
                productoNombre: 'Recarga de botellón de 20 L',
                cantidad: 2,
                precioFinal: '10000.00',
                precioManual: false,
              },
            ],
          }),
        ]}
      />,
    )

    expect(screen.queryByText(/a mano/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/10\.000/)).not.toBeInTheDocument()
  })

  /**
   * Una venta puede mezclar las dos cosas. La marca es de la LÍNEA, no de la
   * venta: marcar la venta entera diría que los dos productos se cobraron
   * distinto, y sería falso para uno de ellos.
   */
  it('en una venta mixta, marca solo la línea que lo llevó', () => {
    render(
      <UltimasVentas
        ventas={[
          venta({
            lineas: [
              {
                productoId: 'p1',
                productoNombre: 'Recarga de botellón de 20 L',
                cantidad: 2,
                precioFinal: '3800.00',
                precioManual: true,
              },
              {
                productoId: 'p1',
                productoNombre: 'Paca de 20 bolsas de 600 ml',
                cantidad: 1,
                precioFinal: '5000.00',
                precioManual: false,
              },
            ],
          }),
        ]}
      />,
    )

    expect(screen.getAllByText(/a mano/i)).toHaveLength(1)
    expect(screen.getByText(/3\.800/)).toBeInTheDocument()
    expect(screen.queryByText(/5\.000/)).not.toBeInTheDocument()
  })
})
