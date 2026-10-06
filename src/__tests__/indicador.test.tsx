import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Indicador } from '@/components/ui/indicador'

/**
 * El cuadro de un número del negocio.
 *
 * Lo que se prueba no es el tamaño de la tipografía —eso es una decisión
 * estética y cambiarla no debería poner nada en rojo— sino que el cuadro **no
 * mienta**: que una subida no se cuente solo con color, que un número que no
 * sigue al filtro lo diga con su motivo, y que no se invente una comparación
 * cuando no la hay.
 *
 * ── Por qué vive en `ui/` y no en el tablero ────────────────────────────────
 *
 * Un número grande con su etiqueta y su comparación no es del tablero: lo
 * necesita cualquier módulo que muestre un total. Nace compartido para que el
 * segundo que lo precise no lo copie con otro alto de línea.
 */

describe('dice lo que muestra', () => {
  it('muestra la etiqueta, el valor y la nota', () => {
    render(
      <Indicador
        etiqueta="Vendido en el período"
        valor="$33.860.000"
        nota="contra los 30 días anteriores"
      />,
    )

    expect(screen.getByText('Vendido en el período')).toBeInTheDocument()
    expect(screen.getByText('$33.860.000')).toBeInTheDocument()
    expect(screen.getByText('contra los 30 días anteriores')).toBeInTheDocument()
  })

  /**
   * ── La cifra va en tabular, y es funcional ────────────────────────────────
   *
   * Cuatro indicadores en fila se leen comparando columnas de dígitos. Con una
   * tipografía proporcional, el `1` es más angosto que el `8` y los montos
   * quedan desalineados: hay que leerlos de a uno en vez de barrerlos.
   */
  it('el valor va en cifra tabular', () => {
    render(<Indicador etiqueta="Cobrado" valor="$19.140.000" />)

    expect(screen.getByText('$19.140.000')).toHaveClass('aq-cifra')
  })

  it('sin comparación no inventa una', () => {
    const { container } = render(<Indicador etiqueta="Cobrado" valor="$19.140.000" />)

    expect(container.querySelector('[data-direccion]')).toBeNull()
  })
})

describe('la dirección no se cuenta solo con color', () => {
  /**
   * Cerca del 8 % de los varones no separa el par verde/rojo. Un indicador que
   * solo pinta el número de verde no dice nada para esa persona — y al sol, en
   * la planta, no dice nada para nadie.
   *
   * Por eso la dirección viaja en el nombre accesible además de en el color.
   */
  it('una subida se anuncia con palabras, no solo en verde', () => {
    render(<Indicador etiqueta="Vendido" valor="$33.860.000" comparacion={{ texto: '+14,2 %', direccion: 'sube' }} />)

    expect(screen.getByText('+14,2 %').closest('[data-direccion]')).toHaveAccessibleName(
      /sube/i,
    )
  })

  it('una bajada también', () => {
    render(<Indicador etiqueta="Vendido" valor="$21.000.000" comparacion={{ texto: '−9,4 %', direccion: 'baja' }} />)

    expect(screen.getByText('−9,4 %').closest('[data-direccion]')).toHaveAccessibleName(
      /baja/i,
    )
  })

  /**
   * «Sin cambio» es una dirección más, y tiene que poder decirse: un indicador
   * que solo sabe subir y bajar obliga a elegir una de las dos cuando la
   * respuesta real es «igual que antes».
   */
  it('sin cambio es una dirección, no la ausencia de una', () => {
    render(<Indicador etiqueta="Vendido" valor="$33.000.000" comparacion={{ texto: '0,0 %', direccion: 'igual' }} />)

    expect(screen.getByText('0,0 %').closest('[data-direccion]')).toHaveAttribute(
      'data-direccion',
      'igual',
    )
  })
})

describe('el número que no sigue al filtro lo dice', () => {
  /**
   * ── Por qué el motivo es obligatorio ──────────────────────────────────────
   *
   * En el tablero, «Por recaudar» sale de la cartera, que es una foto de HOY:
   * el endpoint no acepta fechas y es correcto que no las acepte. Puesto al
   * lado de tres números que sí siguen al rango, uno que se queda quieto se lee
   * como un bug.
   *
   * Marcarlo sin decir por qué sería la misma falta que apagar un botón sin
   * explicar: el lector ve que algo es distinto y no sabe qué hacer con eso.
   * Por eso `anclado` ES el motivo — no un booleano con el motivo aparte, que
   * se puede olvidar.
   */
  it('muestra el motivo del ancla, no solo una marca', () => {
    render(
      <Indicador
        etiqueta="Por recaudar"
        valor="$9.400.000"
        anclado="al día de hoy — no sigue el rango"
      />,
    )

    expect(screen.getByText(/no sigue el rango/)).toBeInTheDocument()
  })

  it('sin ancla no marca nada', () => {
    const { container } = render(<Indicador etiqueta="Vendido" valor="$33.860.000" />)

    expect(container.querySelector('[data-anclado]')).toBeNull()
  })
})
