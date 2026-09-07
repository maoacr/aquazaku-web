import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgregarDireccion, TelefonosDelCliente } from '@/components/clientes/acciones-de-cliente'
import type { Departamento, Municipio, Telefono } from '@/lib/api-types'

const DEPARTAMENTOS: Departamento[] = [{ codigo: '08', nombre: 'Atlántico' }]
const MUNICIPIOS: Municipio[] = [
  { codigo: '08137', departamento: '08', nombre: 'Campo de la Cruz', lat: 10.378, lng: -74.881 },
]

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  agregarDireccionAction: vi.fn(),
  agregarTelefonoAction: vi.fn(),
  desactivarTelefonoAction: vi.fn(),
  cambiarEstadoAction: vi.fn(),
  configurarCreditoAction: vi.fn(),
  verificarDocumentoAction: vi.fn(),
}))

/**
 * El formulario de dirección y los teléfonos — M14.
 *
 * Lo que se prueba es la decisión de fondo: **ningún campo de ubicación es
 * obligatorio**. Aquazaku reparte en pueblos donde hay direcciones que son
 * «Vereda La Peña, casa de tabla azul», y exigir la nomenclatura haría que el
 * operador invente `CL 1 # 1-1` para poder guardar.
 */

describe('el formulario de dirección', () => {
  it('solo la etiqueta es obligatoria', () => {
    render(<AgregarDireccion clienteId="cli-1" departamentos={DEPARTAMENTOS} municipios={MUNICIPIOS} />)

    const requeridos = screen
      .getAllByRole('textbox')
      .filter((c) => c.hasAttribute('required'))
      .map((c) => c.getAttribute('name'))

    expect(requeridos).toEqual(['etiqueta'])
  })

  it('tiene los siete campos de la nomenclatura', () => {
    render(<AgregarDireccion clienteId="cli-1" departamentos={DEPARTAMENTOS} municipios={MUNICIPIOS} />)

    for (const campo of ['Tipo de vía', 'Número de la vía', 'Letra de la vía', 'Número de la placa']) {
      expect(screen.getByLabelText(campo)).toBeInTheDocument()
    }
  })

  /*
   * La salida para lo que no se descompone. No es un campo de respaldo: para
   * media Colombia rural ES la dirección.
   */
  it('y la salida para lo que no se descompone', () => {
    render(<AgregarDireccion clienteId="cli-1" departamentos={DEPARTAMENTOS} municipios={MUNICIPIOS} />)

    expect(screen.getByPlaceholderText(/Vereda La Peña/)).toBeInTheDocument()
  })

  /*
   * `datalist` y no `select`: la lista cubre lo común y quien tenga «Anillo
   * Vial» o «Km 3» la escribe igual. Un desplegable cerrado bloquearía una
   * dirección real.
   */
  it('el tipo de vía sugiere pero no obliga', () => {
    render(<AgregarDireccion clienteId="cli-1" departamentos={DEPARTAMENTOS} municipios={MUNICIPIOS} />)

    expect(screen.getByLabelText('Tipo de vía')).toHaveAttribute('list', 'tipos-de-via')
  })
})

const telefono = (extra: Partial<Telefono> = {}): Telefono => ({
  id: 't-1',
  numero: '300 123 4567',
  etiqueta: 'el dueño',
  activo: true,
  ...extra,
})

describe('los teléfonos', () => {
  /*
   * Los ocho de la planta miran esto desde un celular, parados al lado de una
   * llenadora. Copiar diez dígitos a mano ahí es donde se pierde la llamada.
   */
  it('el número es un enlace que marca', () => {
    render(<TelefonosDelCliente clienteId="cli-1" telefonos={[telefono()]} />)

    expect(screen.getByRole('link', { name: '300 123 4567' })).toHaveAttribute(
      'href',
      'tel:3001234567',
    )
  })

  it('los espacios y paréntesis no viajan en el enlace', () => {
    render(<TelefonosDelCliente clienteId="cli-1" telefonos={[telefono({ numero: '(605) 879 1234' })]} />)

    expect(screen.getByRole('link', { name: '(605) 879 1234' })).toHaveAttribute(
      'href',
      'tel:6058791234',
    )
  })

  it('sin teléfonos dice por qué importa, en vez de dejar un hueco', () => {
    render(<TelefonosDelCliente clienteId="cli-1" telefonos={[]} />)

    expect(screen.getByText(/la cartera dice a quién cobrarle pero no cómo/)).toBeInTheDocument()
  })

  it('cada uno se puede quitar por separado', () => {
    render(
      <TelefonosDelCliente
        clienteId="cli-1"
        telefonos={[telefono(), telefono({ id: 't-2', numero: '6058791234' })]}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'Quitar este teléfono' })).toHaveLength(2)
  })
})
