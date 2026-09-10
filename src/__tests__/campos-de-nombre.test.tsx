import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  CamposDeNombre,
  faltaElNombre,
  NOMBRE_VACIO,
  type Nombre,
  soloLoEscrito,
} from '@/components/clientes/campos-de-nombre'

/**
 * Los campos del nombre — RN-CLI-17.
 *
 * ── Lo que se vigila ────────────────────────────────────────────────────────
 *
 * Que el formulario NO le pida apellidos a un negocio. Si lo hiciera, lo que
 * pasa de verdad no es que alguien se queje: alguien escribe «Panadería» en
 * primer nombre y «del Centro» en apellidos, y el dato queda peor que con un
 * solo campo.
 *
 * Y que lo que viaja a `api/` no lleve cadenas vacías. Un `apellidos: ''` no es
 * «sin apellidos» — es un dato en blanco, y el CHECK `clientes_partes_sin_vacios`
 * lo rechaza con un error de Postgres en vez de un mensaje.
 */

const con = (extra: Partial<Nombre> = {}): Nombre => ({ ...NOMBRE_VACIO, ...extra })

describe('el formulario cambia con el tipo de cliente', () => {
  it('a una persona le pide nombre, apellidos y apodo', () => {
    render(<CamposDeNombre tipo="residencial" />)

    expect(screen.getByRole('textbox', { name: /Primer nombre/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Segundo nombre/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Apellidos/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Apodo/ })).toBeInTheDocument()
  })

  it('a un negocio le pide UN nombre, y ningún apellido', () => {
    render(<CamposDeNombre tipo="comercial" />)

    expect(screen.getByRole('textbox', { name: /Nombre del negocio/ })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Apellidos/ })).toBeNull()
    expect(screen.queryByRole('textbox', { name: /Primer nombre/ })).toBeNull()
  })

  /**
   * Los dos opcionales van marcados. Sin la marca, quien llena el formulario
   * asume que hacen falta y se inventa un segundo nombre — que es peor que
   * dejarlo vacío, porque nadie va a saber después que fue inventado.
   */
  it('dice cuáles son opcionales', () => {
    render(<CamposDeNombre tipo="residencial" />)

    expect(screen.getByRole('textbox', { name: /Segundo nombre \(opcional\)/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Apodo \(opcional\)/ })).toBeInTheDocument()
  })
})

/**
 * ── Los dos modos de cableado ───────────────────────────────────────────────
 *
 * Controlado y sin `name` es el modo del alta rápida: vive dentro de un
 * `<dialog>` que cuelga del formulario de la venta, y ahí un campo con `name`
 * viajaría en el `FormData` de la venta.
 */
describe('cómo se conecta', () => {
  it('en un formulario normal, emite `name`', () => {
    const { container } = render(<CamposDeNombre tipo="residencial" />)

    const nombres = [...container.querySelectorAll('input')].map((i) => i.name)
    expect(nombres).toEqual(['primerNombre', 'segundoNombre', 'apellidos', 'apodo'])
  })

  it('controlado, NO emite `name`', () => {
    const { container } = render(
      <CamposDeNombre tipo="residencial" valor={NOMBRE_VACIO} onCambio={() => {}} />,
    )

    for (const input of container.querySelectorAll('input')) {
      expect(input.name).toBe('')
    }
  })
})

describe('lo que viaja a la API', () => {
  it('las cadenas vacías se omiten, no se mandan', () => {
    expect(soloLoEscrito(con({ primerNombre: 'Rosa', apellidos: 'Padilla' }))).toEqual({
      primerNombre: 'Rosa',
      apellidos: 'Padilla',
    })
  })

  it('recorta los espacios', () => {
    expect(soloLoEscrito(con({ primerNombre: '  Rosa  ' }))).toEqual({ primerNombre: 'Rosa' })
  })

  /** Un campo con solo espacios es un campo vacío, no un dato. */
  it('un campo con solo espacios tampoco viaja', () => {
    expect(soloLoEscrito(con({ apodo: '   ' }))).toEqual({})
  })
})

/**
 * El mínimo se adelanta acá, pero quien manda es `api/`: el mismo criterio vive
 * en `exigirNombreCoherente` y en cuatro CHECK de la base.
 */
describe('cuándo falta el nombre', () => {
  it('una persona necesita primer nombre Y apellidos', () => {
    expect(faltaElNombre('residencial', con({ primerNombre: 'Rosa' }))).toBe(true)
    expect(faltaElNombre('residencial', con({ apellidos: 'Padilla' }))).toBe(true)
    expect(faltaElNombre('residencial', con({ primerNombre: 'Rosa', apellidos: 'Padilla' }))).toBe(
      false,
    )
  })

  it('un negocio necesita el suyo, y no le sirven las partes', () => {
    expect(faltaElNombre('comercial', con({ nombreLibre: 'Panadería' }))).toBe(false)
    expect(faltaElNombre('comercial', con({ primerNombre: 'Rosa', apellidos: 'Padilla' }))).toBe(
      true,
    )
  })
})
