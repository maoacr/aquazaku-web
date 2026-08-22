import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Isotipo, LogoCompleto, Marca } from '@/components/ui/marca'

/**
 * La marca tiene que decir su nombre una sola vez.
 *
 * Es el defecto clásico de un logo compuesto: el isotipo trae su `alt` y al lado
 * va el nombre en texto, así que un lector de pantalla anuncia «Aquazaku
 * Aquazaku». Y el opuesto también existe —marcar todo como decorativo y dejar la
 * marca muda—, que es peor: quien no ve la pantalla se queda sin saber en qué
 * sistema está.
 */
describe('la marca dice su nombre exactamente una vez', () => {
  it('el isotipo solo, sin texto al lado, se anuncia', () => {
    render(<Isotipo />)

    expect(screen.getByRole('img', { name: 'Aquazaku' })).toBeInTheDocument()
  })

  it('acompañado del nombre en texto, el isotipo calla', () => {
    render(<Marca />)

    // Una sola vez: la del texto. El isotipo va como decorativo.
    expect(screen.queryAllByRole('img', { name: /aquazaku/i })).toHaveLength(0)
    expect(screen.getByText('Aquazaku')).toBeInTheDocument()
  })

  it('el lockup de la pantalla de acceso sí se anuncia: ahí no hay texto', () => {
    render(<LogoCompleto />)

    expect(screen.getByRole('img', { name: 'Aquazaku' })).toBeInTheDocument()
  })
})

describe('el arte se sirve optimizado', () => {
  /**
   * El original pesa 9,7 MB. Si alguien apunta el componente al archivo grande
   * —o mete el PNG en `public/`— esto lo agarra antes de que llegue a un
   * teléfono con datos móviles en Campo de la Cruz.
   */
  it('la marca apunta a los WebP de `public/marca`, no a un PNG', () => {
    const { container } = render(<Marca />)
    const img = container.querySelector('img')

    expect(img).not.toBeNull()
    // `next/image` reescribe el `src` a `/_next/image?url=…`, así que la ruta
    // original viaja codificada adentro.
    expect(decodeURIComponent(img!.getAttribute('src') ?? '')).toContain('/marca/isotipo.webp')
  })
})
