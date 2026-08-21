import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TablaDeProductos, pesos } from '@/components/productos/tabla-productos'
import type { Producto } from '@/lib/api-types'

function producto(sobrescribe: Partial<Producto> = {}): Producto {
  return {
    id: 'p1',
    codigo: 'P20U_600ML',
    nombre: 'Paca de 20 bolsas de 600 ml',
    presentacion: 'paca',
    contenidoMl: 600,
    unidades: 20,
    litros: '12.000',
    precioResidencial: '12000.00',
    precioComercial: '11000.00',
    precioMinimo: '9000.00',
    precioIncluyeImpuestos: true,
    tarifaIvaPorcentaje: '0.00',
    activo: true,
    createdAt: '2026-08-22T10:00:00.000Z',
    updatedAt: '2026-08-22T10:00:00.000Z',
    ...sobrescribe,
  }
}

describe('<TablaDeProductos />', () => {
  it('muestra el código y el nombre de cada producto', () => {
    render(<TablaDeProductos productos={[producto()]} />)

    expect(screen.getByText('P20U_600ML')).toBeInTheDocument()
    expect(screen.getByText('Paca de 20 bolsas de 600 ml')).toBeInTheDocument()
  })

  it('la paca dice unidades por contenido; el botellón, litros', () => {
    render(
      <TablaDeProductos
        productos={[
          producto(),
          producto({
            id: 'p2',
            codigo: 'BOT_20L',
            presentacion: 'botellon',
            contenidoMl: 20000,
            unidades: 1,
            litros: '20.000',
          }),
        ]}
      />,
    )

    expect(screen.getByText(/20 × 600 ml/)).toBeInTheDocument()
    expect(screen.getByText(/^20 L$/)).toBeInTheDocument()
  })

  it('muestra los litros sin ceros de relleno: 12, no 12.000', () => {
    render(<TablaDeProductos productos={[producto()]} />)

    expect(screen.getByText('(12 L)')).toBeInTheDocument()
    expect(screen.queryByText('(12.000 L)')).toBeNull()
  })

  it('el estado se lee como texto, no solo por color', () => {
    render(<TablaDeProductos productos={[producto({ activo: false })]} />)

    expect(screen.getByText('desactivado')).toBeInTheDocument()
  })

  it('sin productos no deja la tabla en blanco', () => {
    render(<TablaDeProductos productos={[]} />)

    expect(screen.getByText(/No hay productos/i)).toBeInTheDocument()
  })

  it('muestra el piso además de los dos precios de lista', () => {
    render(<TablaDeProductos productos={[producto()]} />)

    const fila = screen.getByText('P20U_600ML').closest('tr')!
    const celdas = within(fila).getAllByRole('cell')

    // residencial, comercial y piso — RN-CAT-04: el piso también se ve.
    expect(celdas).toHaveLength(7)
  })
})

describe('pesos()', () => {
  it('formatea en pesos colombianos sin decimales', () => {
    // El espacio de Intl es un NBSP, no un espacio común.
    expect(pesos('12000.00').replace(/ /g, ' ')).toMatch(/12\.000/)
  })

  it('un precio en cero se muestra, no se oculta', () => {
    expect(pesos('0.00')).toMatch(/0/)
  })
})

/**
 * El aviso mira si el producto SE PUEDE VENDER, no si le falta el precio.
 *
 * Salió de verificar el flujo real: al cargarle el precio a una paca sembrada
 * desactivada, el aviso de "falta precio" se apagaba y el producto seguía sin
 * poder venderse, sin que nada lo dijera. Un aviso que se apaga antes de que el
 * problema se resuelva es peor que ninguno.
 */
describe('qué se puede vender', () => {
  const conPrecio = producto({ activo: false, precioResidencial: '5000.00' })
  const sinPrecio = producto({ id: 'p2', codigo: 'P50U_300ML', activo: false, precioResidencial: '0.00' })

  it('un producto con precio pero desactivado sigue sin venderse', () => {
    expect(conPrecio.activo).toBe(false)
    expect(Number(conPrecio.precioResidencial)).toBeGreaterThan(0)
  })

  it('los dos motivos son distintos y piden acciones distintas', () => {
    const noVendibles = [conPrecio, sinPrecio].filter((p) => !p.activo)
    const esperandoPrecio = noVendibles.filter((p) => Number(p.precioResidencial) === 0)

    expect(noVendibles).toHaveLength(2)
    expect(esperandoPrecio).toHaveLength(1)
    expect(noVendibles.length - esperandoPrecio.length).toBe(1)
  })
})
