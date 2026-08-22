import { render, screen } from '@testing-library/react'
import { Package } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { Vacio } from '@/components/ui/vacio'

/**
 * R50 · Tres vacíos, no uno.
 *
 * Los tres se ven igual —una lista sin nada— y significan cosas opuestas. Lo que
 * este test cuida es que la app no los confunda, porque confundirlos tiene
 * consecuencias concretas: un «crear» ofrecido en un filtro vacío termina en un
 * producto duplicado que alguien tiene que descubrir y limpiar.
 */
describe('R50 · cada vacío dice lo suyo', () => {
  it('`primera-vez` invita a empezar: acá SÍ va crear', () => {
    render(
      <Vacio
        variante="primera-vez"
        icono={Package}
        titulo="Todavía no hay productos"
        accion={<a href="/modulos/productos/gestion">Cargar el primero</a>}
      >
        Cuando cargues el primero, aparece acá.
      </Vacio>,
    )

    expect(screen.getByRole('link', { name: /cargar el primero/i })).toBeInTheDocument()
  })

  it('`sin-resultados` ofrece quitar los filtros', () => {
    render(
      <Vacio
        variante="sin-resultados"
        icono={Package}
        titulo="Nada coincide con esos filtros"
        hrefSinFiltros="/modulos/productos"
      />,
    )

    const salida = screen.getByRole('link', { name: /quitar los filtros/i })
    expect(salida).toHaveAttribute('href', '/modulos/productos')
  })

  /**
   * **La regla dura de R50.**
   *
   * No se testea mirando el texto renderizado —eso solo probaría lo que escribí
   * hoy— sino la forma del componente: `sin-resultados` no recibe `accion`, la
   * arma él. Ofrecer «crear» ahí no es un error de criterio que un revisor tenga
   * que atrapar: es un error de compilación.
   */
  it('`sin-resultados` NO puede ofrecer crear: no acepta una acción propia', () => {
    render(
      <Vacio
        variante="sin-resultados"
        icono={Package}
        titulo="Nada coincide"
        hrefSinFiltros="/modulos/productos"
      />,
    )

    // Un solo enlace, y es la salida del filtro.
    const enlaces = screen.getAllByRole('link')
    expect(enlaces).toHaveLength(1)
    expect(enlaces[0]).toHaveAccessibleName(/quitar los filtros/i)

    for (const tentacion of [/crear/i, /nuevo/i, /agregar/i, /cargar/i]) {
      expect(screen.queryByText(tentacion)).toBeNull()
    }
  })

  it('`terminado` es una buena noticia, no una falla', () => {
    const { container } = render(
      <Vacio variante="terminado" icono={Package} titulo="No queda nada pendiente" />,
    )

    // El icono va en verde: es el único de los tres que celebra algo.
    expect(container.querySelector('.text-exito')).not.toBeNull()
  })

  /**
   * `status` y no `alert`: que una lista esté vacía es información, no una
   * emergencia. `alert` interrumpe lo que el lector de pantalla esté diciendo.
   */
  it('se anuncia sin interrumpir', () => {
    render(<Vacio variante="terminado" icono={Package} titulo="Al día" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
