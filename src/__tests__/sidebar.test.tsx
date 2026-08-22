import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sidebar } from '@/components/ui/sidebar'

/**
 * Además de cubrir el sidebar, este test verifica que el arnés de testing de
 * web/ siga bien cableado de punta a punta: jsdom, plugin de React, alias `@/`
 * y los matchers de jest-dom. Heredó ese rol de `src/app/page.test.tsx`, que se
 * retiró junto con la landing provisoria al llegar el dashboard.
 */
describe('<Sidebar />', () => {
  /**
   * El menú se renderiza DOS veces: un cajón para el teléfono y una columna
   * para escritorio. Cuál se ve lo decide `display`, que es determinista —
   * a diferencia del intento anterior, que dependía de que el navegador
   * revelara el contenido de un `<details>` cerrado y no funcionaba.
   *
   * En jsdom no hay media queries, así que las dos existen y hay que elegir.
   * Los casos de contenido usan la de escritorio: da lo mismo cuál, porque
   * las dos renderizan el mismo componente.
   */
  function nav(cual: 'escritorio' | 'mobile' = 'escritorio') {
    return within(screen.getByTestId(`menu-${cual}`)).getByRole('navigation', { name: 'Módulos' })
  }

  it('muestra los módulos de admin', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" tema="claro" />)

    expect(within(nav()).getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Auditoría' })).toBeInTheDocument()
  })

  it('apunta cada link al href del módulo', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" tema="claro" />)

    expect(within(nav()).getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'href',
      '/modulos/usuarios',
    )
  })

  it('manda al contador a su propia ruta de auditoría', () => {
    render(<Sidebar userRoles={['contador']} userName="Persona de prueba" tema="claro" />)

    expect(within(nav()).getByRole('link', { name: 'Auditoría' })).toHaveAttribute(
      'href',
      '/contador/auditoria',
    )
  })

  // Hasta M0 estos dos roles tenían el menú vacío. M1 les da su primera
  // pantalla: los cuatro roles leen el catálogo (RN-CAT-06), porque un `pos`
  // que no ve precios no puede vender.
  it.each(['pos', 'seller'] as const)('%s ve catálogo y stock', (rol) => {
    render(<Sidebar userRoles={[rol]} userName="Persona de prueba" tema="claro" />)

    const hrefs = within(nav())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(hrefs).toEqual(['/modulos/productos', '/modulos/stock'])
  })

  it('no muestra el link de gestión: esa pantalla es solo de admin', () => {
    render(<Sidebar userRoles={['pos']} userName="Persona de prueba" tema="claro" />)

    expect(within(nav()).queryByRole('link', { name: /gestion/i })).toBeNull()
  })

  // RN-ACC-01: sin switch-role, un admin que además es contador ve las dos
  // puertas a la vez. Si acá apareciera una sola, el multi-rol estaría roto.
  it('muestra la unión de módulos para un usuario multi-rol', () => {
    render(<Sidebar userRoles={['admin', 'contador']} userName="Persona de prueba" tema="claro" />)

    const hrefs = within(nav())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(hrefs).toEqual([
      '/modulos/productos',
      '/modulos/stock',
      '/modulos/usuarios',
      '/modulos/auditoria',
      '/contador/auditoria',
    ])
  })

  /**
   * Este test decía «siempre rotula la marca» y usaba `toBeVisible()`.
   *
   * Dejó de ser cierto cuando el menú pasó a ser colapsable, y **está bien**:
   * en un teléfono el panel arranca cerrado y su contenido no se ve hasta que
   * alguien lo abre. Eso es lo que hace un menú colapsable.
   *
   * Lo que sí tiene que valer siempre es que la marca **esté en el documento**:
   * un lector de pantalla la encuentra, y en escritorio el CSS la muestra.
   */
  it('la marca está siempre en el documento', () => {
    render(<Sidebar userRoles={[]} userName="Persona de prueba" tema="claro" />)

    expect(within(screen.getByTestId('menu-escritorio')).getByText('Aquazaku')).toBeInTheDocument()
  })

  it('las dos instancias muestran los mismos módulos', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" tema="claro" />)

    const enEscritorio = within(nav('escritorio')).getAllByRole('link').map((l) => l.textContent)
    const enMobile = within(nav('mobile')).getAllByRole('link').map((l) => l.textContent)

    // Si divergen, alguien editó una copia y no la otra.
    expect(enMobile).toEqual(enEscritorio)
  })

  it('solo la de escritorio se ve en pantalla ancha, y al revés', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" tema="claro" />)

    // jsdom no aplica media queries, así que se verifica la intención en las
    // clases: es lo único comprobable sin un navegador.
    expect(screen.getByTestId('menu-escritorio').className).toContain('hidden')
    expect(screen.getByTestId('menu-escritorio').className).toContain('sm:flex')
    expect(screen.getByTestId('menu-lateral').className).toContain('sm:hidden')
  })

  it('el menú se puede abrir y cerrar sin JavaScript', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" tema="claro" />)

    // `<details>` trae gratis el teclado y el anuncio a lectores de pantalla.
    const menu = screen.getByTestId('menu-lateral')
    expect(menu.tagName).toBe('DETAILS')
    expect(menu.querySelector('summary')).not.toBeNull()
  })

  it('el botón de abrir dice qué hace', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" tema="claro" />)

    expect(screen.getByLabelText('Abrir el menú')).toBeInTheDocument()
  })
})

describe('cierre de sesión', () => {
  it('el shell ofrece salir: sin esto no habría forma de cerrar sesión', () => {
    render(<Sidebar userRoles={['admin']} userName="Mao Jefe" tema="claro" />)

    // `api/` expone el endpoint desde Task 6, pero el shell no lo usaba: el
    // usuario quedaba adentro hasta que le venciera la cookie.
    expect(
      within(screen.getByTestId('menu-escritorio')).getByRole('button', { name: /cerrar sesión/i }),
    ).toBeInTheDocument()
  })

  it('muestra quién está usando el sistema', () => {
    render(<Sidebar userRoles={['pos']} userName="Yeimy Rodríguez" tema="claro" />)

    expect(
      within(screen.getByTestId('menu-escritorio')).getByText('Yeimy Rodríguez'),
    ).toBeInTheDocument()
  })
})
