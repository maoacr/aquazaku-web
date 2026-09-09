import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { UbicacionEnMapa } from '@/components/clientes/ubicacion-en-mapa'
import type { Direccion, Municipio } from '@/lib/api-types'

/*
 * El mapa se carga con `next/dynamic`. En los tests se reemplaza por un doble:
 * Leaflet necesita un navegador de verdad —mide el contenedor, pide tiles— y lo
 * que se prueba acá no es Leaflet, es CUÁNDO aparece y qué manda el formulario.
 */
vi.mock('next/dynamic', () => ({
  default: () => function MapaFalso() {
    return <div data-testid="mapa" />
  },
}))

/**
 * Marcar la ubicación en el mapa — M14.
 *
 * ── Lo que se prueba ────────────────────────────────────────────────────────
 *
 * Que sea OPCIONAL de verdad. Es la misma decisión que el resto de la
 * dirección: Aquazaku reparte en pueblos donde una dirección puede ser «Vereda
 * La Peña, casa de tabla azul», y quien la carga puede no saber ubicarla en un
 * mapa.
 */

const MUNICIPIOS: Municipio[] = [
  { codigo: '08137', departamento: '08', nombre: 'Campo de la Cruz', lat: 10.378, lng: -74.881 },
]

const conPin = (extra: Partial<Direccion> = {}): Direccion =>
  ({ latitud: '10.378291', longitud: '-74.880847', ...extra }) as Direccion

describe('el mapa es opcional', () => {
  it('arranca apagado cuando la dirección no tiene pin', () => {
    render(<UbicacionEnMapa municipios={MUNICIPIOS} />)

    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument()
  })

  /*
   * Los campos ocultos viajan SIEMPRE, vacíos si nadie marcó nada. La acción
   * los filtra: mandar `''` haría que una dirección en blanco pase el control
   * de la base diciendo que tiene coordenadas.
   */
  it('apagado, manda las coordenadas vacías', () => {
    const { container } = render(<UbicacionEnMapa municipios={MUNICIPIOS} />)

    expect(container.querySelector('input[name="latitud"]')).toHaveValue('')
    expect(container.querySelector('input[name="longitud"]')).toHaveValue('')
  })

  it('se enciende con el toggle', () => {
    render(<UbicacionEnMapa municipios={MUNICIPIOS} />)

    fireEvent.click(screen.getByRole('checkbox'))

    expect(screen.getByTestId('mapa')).toBeInTheDocument()
  })

  /*
   * Esconder un dato ya cargado lo vuelve invisible, y alguien lo va a dar por
   * perdido. Si la dirección tenía pin, el mapa se abre solo.
   */
  it('pero arranca abierto si la dirección YA tenía pin', () => {
    render(<UbicacionEnMapa inicial={conPin()} municipios={MUNICIPIOS} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(screen.getByTestId('mapa')).toBeInTheDocument()
  })

  it('y conserva el pin guardado en los campos del formulario', () => {
    const { container } = render(<UbicacionEnMapa inicial={conPin()} municipios={MUNICIPIOS} />)

    expect(container.querySelector('input[name="latitud"]')).toHaveValue('10.378291')
  })
})

describe('lo que dice cuando está apagado', () => {
  /*
   * Un «opcional» sin motivo se lee como «no importa». Decir para qué sirve es
   * lo que hace que alguien lo marque cuando de verdad hace falta.
   */
  it('explica para qué sirve, en vez de solo decir «opcional»', () => {
    render(<UbicacionEnMapa municipios={MUNICIPIOS} />)

    expect(screen.getByText(/rutas de reparto/)).toBeInTheDocument()
  })
})
