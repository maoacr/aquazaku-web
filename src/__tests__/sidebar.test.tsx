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
  function nav() {
    return screen.getByRole('navigation', { name: 'Módulos' })
  }

  it('muestra los módulos de admin', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" />)

    expect(within(nav()).getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
    expect(within(nav()).getByRole('link', { name: 'Auditoría' })).toBeInTheDocument()
  })

  it('apunta cada link al href del módulo', () => {
    render(<Sidebar userRoles={['admin']} userName="Persona de prueba" />)

    expect(within(nav()).getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'href',
      '/modulos/usuarios',
    )
  })

  it('manda al contador a su propia ruta de auditoría', () => {
    render(<Sidebar userRoles={['contador']} userName="Persona de prueba" />)

    expect(within(nav()).getByRole('link', { name: 'Auditoría' })).toHaveAttribute(
      'href',
      '/contador/auditoria',
    )
  })

  it('deja el menú vacío para pos, sin romper el layout', () => {
    render(<Sidebar userRoles={['pos']} userName="Persona de prueba" />)

    expect(within(nav()).queryAllByRole('link')).toHaveLength(0)
  })

  it('deja el menú vacío para seller', () => {
    render(<Sidebar userRoles={['seller']} userName="Persona de prueba" />)

    expect(within(nav()).queryAllByRole('link')).toHaveLength(0)
  })

  // RN-ACC-01: sin switch-role, un admin que además es contador ve las dos
  // puertas a la vez. Si acá apareciera una sola, el multi-rol estaría roto.
  it('muestra la unión de módulos para un usuario multi-rol', () => {
    render(<Sidebar userRoles={['admin', 'contador']} userName="Persona de prueba" />)

    const hrefs = within(nav())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'))

    expect(hrefs).toEqual(['/modulos/usuarios', '/modulos/auditoria', '/contador/auditoria'])
  })

  it('siempre rotula la marca', () => {
    render(<Sidebar userRoles={[]} userName="Persona de prueba" />)

    expect(screen.getByText('Aquazaku')).toBeVisible()
  })
})

describe('cierre de sesión', () => {
  it('el shell ofrece salir: sin esto no habría forma de cerrar sesión', () => {
    render(<Sidebar userRoles={['admin']} userName="Mao Jefe" />)

    // `api/` expone el endpoint desde Task 6, pero el shell no lo usaba: el
    // usuario quedaba adentro hasta que le venciera la cookie.
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument()
  })

  it('muestra quién está usando el sistema', () => {
    render(<Sidebar userRoles={['pos']} userName="Yeimy Rodríguez" />)

    expect(screen.getByText('Yeimy Rodríguez')).toBeInTheDocument()
  })
})
