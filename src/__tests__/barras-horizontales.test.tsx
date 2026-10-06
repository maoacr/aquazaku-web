import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarrasHorizontales } from '@/components/graficos/barras-horizontales'

/**
 * Barras horizontales con el nombre al lado.
 *
 * Lo que se prueba no es el ancho en píxeles —eso depende del contenedor y en
 * jsdom no hay layout— sino que la barra **no mienta**: que la proporción salga
 * del máximo y no de la suma, que un cero no dibuje una barra, que el orden sea
 * el que mandó quien llama, y que el dato esté escrito además de dibujado.
 *
 * ── Por qué barras y no una dona ────────────────────────────────────────────
 *
 * Con tres categorías o más, el nombre al lado se lee más rápido que tres
 * colores que hay que ir a buscar a una leyenda. Y la marca de Aquazaku no da
 * para más de DOS series categóricas: azul y acento están a ΔE 7,8 con visión
 * plena. Acá la identidad la lleva la POSICIÓN y el rótulo, no el color.
 */

const filas = [
  { etiqueta: 'Efectivo', valor: 18420, texto: '$18.420.000' },
  { etiqueta: 'Transferencia', valor: 9870, texto: '$9.870.000' },
  { etiqueta: 'Crédito', valor: 6240, texto: '$6.240.000' },
]

/** El ancho que el componente le pidió al navegador, en porcentaje. */
const anchoDe = (li: HTMLElement) =>
  li.querySelector<HTMLElement>('[data-relleno]')?.style.width ?? null

describe('la barra dice lo que vale', () => {
  it('escribe la etiqueta y el valor, además de dibujarlos', () => {
    render(<BarrasHorizontales filas={filas} />)

    expect(screen.getByText('Efectivo')).toBeInTheDocument()
    expect(screen.getByText('$18.420.000')).toBeInTheDocument()
  })

  /**
   * ── La proporción sale del MÁXIMO, no de la suma ──────────────────────────
   *
   * Con la suma, la barra más larga de tres categorías parejas ocuparía un
   * tercio del ancho y la pantalla se vería vacía. El máximo es el que hace que
   * la fila de arriba llegue al borde y las otras se lean CONTRA ella, que es
   * la comparación que alguien quiere hacer.
   */
  it('la fila más alta llega al 100 % y el resto se mide contra ella', () => {
    render(<BarrasHorizontales filas={filas} />)

    const items = screen.getAllByRole('listitem')

    expect(anchoDe(items[0]!)).toBe('100%')
    // 9870 / 18420 = 53,6 %
    expect(anchoDe(items[1]!)).toBe('53.6%')
  })

  /**
   * Un cero no es una barra muy chiquita: es ninguna barra. Dibujar una lámina
   * de un pixel sugiere que hay algo — el mismo criterio que el tanque vacío.
   */
  it('un cero no dibuja una barra', () => {
    render(
      <BarrasHorizontales
        filas={[
          { etiqueta: 'Efectivo', valor: 100, texto: '$100' },
          { etiqueta: 'Crédito', valor: 0, texto: '$0' },
        ]}
      />,
    )

    expect(anchoDe(screen.getAllByRole('listitem')[1]!)).toBe('0%')
  })

  /**
   * ── El orden es del que llama ─────────────────────────────────────────────
   *
   * `/reportes/cartera` ya viene ordenado por monto y
   * `/reportes/ventas-por-producto` por unidades, con desempate. Si este
   * componente reordenara, habría DOS respuestas para «quién va primero» y la
   * de la pantalla taparía la del servidor sin que nadie lo note.
   */
  it('no reordena: respeta el orden que recibió', () => {
    render(
      <BarrasHorizontales
        filas={[
          { etiqueta: 'Chico', valor: 10, texto: '$10' },
          { etiqueta: 'Grande', valor: 90, texto: '$90' },
        ]}
      />,
    )

    const items = screen.getAllByRole('listitem')

    expect(within(items[0]!).getByText('Chico')).toBeInTheDocument()
  })
})

describe('lo que cuelga de la fila', () => {
  it('muestra la etiqueta de estado cuando la fila trae una', () => {
    render(
      <BarrasHorizontales
        filas={[
          { etiqueta: 'Gimnasio Impulso', valor: 760, texto: '$760.000', chip: { texto: '96 d', tono: 'alerta' } },
        ]}
      />,
    )

    expect(screen.getByText('96 d')).toBeInTheDocument()
  })

  it('sin filas no dibuja una lista vacía', () => {
    const { container } = render(<BarrasHorizontales filas={[]} />)

    expect(container.querySelector('ul')).toBeNull()
  })
})
