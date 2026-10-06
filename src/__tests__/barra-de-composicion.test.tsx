import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarraDeComposicion } from '@/components/graficos/barra-de-composicion'

/**
 * Una barra apilada: las partes de un entero.
 *
 * Es OTRA pregunta que la de `BarrasHorizontales`. Allá se comparan filas entre
 * sí y la referencia es el máximo. Acá las partes SUMAN un todo —la cartera por
 * edad, el parque de botellones— y la referencia es la suma. Mezclarlas daría
 * barras que no llenan la caja y se leerían como si faltara algo.
 *
 * Lo que se prueba es que no mienta: que la proporción salga de la suma, que un
 * cero no deje una astilla de color, y que cada parte esté ESCRITA además de
 * pintada — con una rampa de un solo tono, el color por sí solo no distingue
 * cuatro tramos.
 */

const tramos = [
  { etiqueta: '0–30 días', valor: 4820, texto: '$4.820.000' },
  { etiqueta: '31–60', valor: 2640, texto: '$2.640.000' },
  { etiqueta: '61–90', valor: 1180, texto: '$1.180.000' },
  { etiqueta: '90+', valor: 760, texto: '$760.000' },
]

const segmentos = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[data-segmento]')]

describe('las partes suman el todo', () => {
  /**
   * 4820 de 9400 es 51,3 %. Si la referencia fuera el máximo —como en
   * `BarrasHorizontales`— daría 100 % y la barra se desbordaría sola.
   */
  it('la proporción sale de la SUMA, no del máximo', () => {
    const { container } = render(<BarraDeComposicion partes={tramos} />)

    expect(segmentos(container)[0]!.style.width).toBe('51.3%')
  })

  it('las cuatro partes llenan la barra', () => {
    const { container } = render(<BarraDeComposicion partes={tramos} />)

    const suma = segmentos(container).reduce((a, s) => a + Number.parseFloat(s.style.width), 0)

    expect(suma).toBeCloseTo(100, 0)
  })

  /**
   * Un tramo en cero no deja una astilla de color: deja nada. Una línea de un
   * pixel en la barra se lee como «hay poquito», que es otra cosa que «no hay».
   */
  it('una parte en cero no deja astilla', () => {
    const { container } = render(
      <BarraDeComposicion
        partes={[
          { etiqueta: 'Con deuda', valor: 100, texto: '$100' },
          { etiqueta: 'Vencida', valor: 0, texto: '$0' },
        ]}
      />,
    )

    expect(segmentos(container)).toHaveLength(1)
  })

  it('sin partes no dibuja una barra vacía', () => {
    const { container } = render(<BarraDeComposicion partes={[]} />)

    expect(segmentos(container)).toHaveLength(0)
  })
})

describe('el color no es el único canal', () => {
  /**
   * ── Por qué esto importa MÁS acá que en otros gráficos ────────────────────
   *
   * La rampa es de un solo tono: cuatro azules que se diferencian solo por
   * luminosidad. Entre `61–90` y `90+` hay un paso de luminosidad, no de
   * matiz — y a contraluz en la planta esa diferencia se pierde.
   *
   * Por eso cada parte va escrita en la leyenda con su etiqueta y su valor. El
   * color ordena; el texto identifica.
   */
  it('cada parte está escrita con su etiqueta y su valor', () => {
    render(<BarraDeComposicion partes={tramos} />)

    for (const t of tramos) {
      expect(screen.getByText(t.etiqueta)).toBeInTheDocument()
      expect(screen.getByText(t.texto)).toBeInTheDocument()
    }
  })

  /**
   * La barra entera se anuncia de una sola vez. Cuatro `<span>` de color sin
   * nombre son cuatro cosas invisibles para un lector de pantalla; la leyenda
   * de abajo ya dice todo, así que el dibujo se marca como decorativo.
   */
  it('el dibujo es decorativo: lo que se lee es la leyenda', () => {
    const { container } = render(<BarraDeComposicion partes={tramos} />)

    expect(container.querySelector('[data-barra]')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('qué escala usa cada composición', () => {
  /**
   * ── No toda composición es un ORDEN ───────────────────────────────────────
   *
   * La cartera por edad sí lo es: 0–30 está antes que 90+, y la rampa de un
   * tono dice exactamente eso. El parque de botellones NO: «en bodega» y «en
   * poder de clientes» son dos lugares, no dos grados de nada.
   *
   * Pintar lo categórico con la rampa secuencial inventa una jerarquía que no
   * existe — y encima deja dos azules vecinos que a contraluz no se separan.
   * Para dos categorías la marca sí alcanza: azul y verde están a ΔE 19,6 en
   * visión plena, medido.
   *
   * Este caso existe porque lo hice mal la primera vez y lo vi recién al abrir
   * la página.
   */
  it('por defecto usa la rampa, que es para magnitud', () => {
    const { container } = render(<BarraDeComposicion partes={tramos} />)

    expect(segmentos(container)[0]).toHaveClass('bg-escala-1')
  })

  it('con dos categorías usa los dos tonos validados, no la rampa', () => {
    const { container } = render(
      <BarraDeComposicion
        escala="categoria"
        partes={[
          { etiqueta: 'En poder de clientes', valor: 92, texto: '92' },
          { etiqueta: 'En bodega', valor: 200, texto: '200' },
        ]}
      />,
    )

    const [uno, dos] = segmentos(container)

    expect(uno).toHaveClass('bg-accion')
    expect(dos).toHaveClass('bg-exito')
    expect(uno).not.toHaveClass('bg-escala-1')
  })
})

describe('el total', () => {
  it('lo muestra cuando se lo pasan', () => {
    render(<BarraDeComposicion partes={tramos} total="$9.400.000" />)

    expect(screen.getByText('$9.400.000')).toHaveClass('aq-cifra')
  })

  it('sin total no inventa uno sumando', () => {
    render(<BarraDeComposicion partes={tramos} />)

    expect(screen.queryByText('$9.400.000')).toBeNull()
  })
})
