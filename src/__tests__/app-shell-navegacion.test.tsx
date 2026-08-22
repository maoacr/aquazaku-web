import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppShell } from '@/components/ui/app-shell'
import type { Role } from '@/lib/roles'

/**
 * El armazón: cabecera, menú, contenido y pie.
 *
 * Reemplaza a `sidebar.test.tsx`. El menú dejó de ser un componente suelto y
 * pasó a ser una celda del grid, así que probarlo aislado ya no dice nada útil
 * sobre lo que el usuario ve.
 *
 * Y hay UNA sola instancia del menú: la versión anterior lo renderizaba dos
 * veces —cajón y columna— y cada consulta encontraba todo duplicado.
 */
function pintar(roles: Role[] = ['admin']) {
  render(
    <AppShell userRoles={roles} userName="Ana Gómez" tema="claro">
      <p>contenido</p>
    </AppShell>,
  )
}

const menu = () => screen.getByRole('navigation', { name: 'Módulos' })

describe('se puede volver al inicio', () => {
  /**
   * Faltaba por completo: ni la marca enlazaba, ni había una entrada de menú.
   * Quien entraba a un módulo no tenía forma de volver al dashboard salvo
   * editar la URL.
   */
  it('la marca lleva al inicio', () => {
    pintar()

    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/')
  })

  it('el menú tiene una entrada explícita de Inicio', () => {
    pintar()

    // La convención del logo es de quien vive en la web. Alguien que atiende un
    // mostrador merece un link que lo diga.
    expect(within(menu()).getByRole('link', { name: /inicio/i })).toHaveAttribute('href', '/')
  })

  it('Inicio está antes que los módulos', () => {
    pintar()

    const enlaces = within(menu()).getAllByRole('link')
    expect(enlaces[0]).toHaveTextContent(/inicio/i)
  })
})

describe('el menú muestra lo que cada rol puede ver', () => {
  it('hay UNA sola instancia del menú', () => {
    pintar()

    expect(screen.getAllByRole('navigation', { name: 'Módulos' })).toHaveLength(1)
  })

  it('admin ve usuarios y auditoría', () => {
    pintar(['admin'])

    expect(within(menu()).getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
    expect(within(menu()).getByRole('link', { name: 'Auditoría' })).toHaveAttribute(
      'href',
      '/modulos/auditoria',
    )
  })

  it('el contador entra a la auditoría por su propia ruta', () => {
    pintar(['contador'])

    expect(within(menu()).getByRole('link', { name: 'Auditoría' })).toHaveAttribute(
      'href',
      '/contador/auditoria',
    )
  })

  it('pos y seller ven catálogo y stock, y nada de administración', () => {
    pintar(['pos'])

    expect(within(menu()).getByRole('link', { name: 'Stock' })).toBeInTheDocument()
    expect(within(menu()).queryByRole('link', { name: 'Usuarios' })).toBeNull()
  })

  it('sin roles queda solo Inicio: un menú vacío no rompe el armazón', () => {
    pintar([])

    expect(within(menu()).getAllByRole('link')).toHaveLength(1)
  })
})

describe('el cajón se abre y se cierra', () => {
  it('el botón anuncia su estado a un lector de pantalla', () => {
    pintar()

    const boton = screen.getByRole('button', { name: 'Abrir el menú' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    expect(boton).toHaveAttribute('aria-controls')
  })

  it('el botón controla el panel que dice controlar', () => {
    pintar()

    const boton = screen.getByRole('button', { name: 'Abrir el menú' })
    expect(menu().id).toBe(boton.getAttribute('aria-controls'))
  })
})

describe('el pie está siempre', () => {
  it('acredita a quien lo hizo, con link a su sitio', () => {
    pintar()

    const enlace = screen.getByRole('link', { name: '@maoacr' })
    expect(enlace).toHaveAttribute('href', 'https://maoacr.com')
    // Sin `noopener`, el sitio destino puede manipular esta pestaña.
    expect(enlace).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('lleva el año en curso, no uno escrito a mano', () => {
    pintar()

    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} Aquazaku`)),
    ).toBeInTheDocument()
  })

  it('vive en el armazón, no dentro del contenido que scrollea', () => {
    pintar()

    const pie = screen.getByRole('contentinfo')
    expect(pie.closest('main')).toBeNull()
  })
})

describe('el scroll vive en el contenido', () => {
  it('solo el main puede scrollear', () => {
    pintar()

    const main = screen.getByRole('main')
    // `min-h-0` es lo que permite que un hijo de grid se encoja; sin él el
    // scroll se escapa al documento y arrastra el menú y el pie con él.
    expect(main.className).toContain('min-h-0')
    expect(main.className).toContain('overflow-y-auto')
  })
})
