import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/ui/app-shell'
import type { Role } from '@/lib/roles'

/**
 * El enlace del menú marca el módulo activo, y para eso pregunta en qué ruta
 * está. `usePathname()` necesita el router del App Router, que en un render
 * suelto no existe.
 *
 * Se fija en `/`: es la ruta donde el armazón se ve con Inicio activo y ningún
 * módulo, que es el estado que estos tests dan por sentado.
 */
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

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
  return render(
    <AppShell userRoles={roles} userName="Ana Gómez">
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

describe('los controles de sesión viven en la cabecera', () => {
  /**
   * Antes estaban al pie del menú lateral, que en un teléfono está detrás de un
   * cajón: cambiar el tema exigía abrir el menú, bajar y cerrar.
   */
  it('el perfil, el tema y la salida están fuera del menú', () => {
    pintar()

    const nav = menu()
    for (const nombre of [/perfil de/i, /cambiar a tema/i, /cerrar sesión/i]) {
      const control = screen.getAllByLabelText(nombre)[0]!
      expect(nav.contains(control)).toBe(false)
    }
  })

  /**
   * Se renderizan los dos botones —luna y sol— y el CSS muestra el que
   * corresponde. Esa decisión vive en `globals.css`, y para ganarle a la
   * utilidad `.flex` necesita el escalón de especificidad que da
   * `aq-toggle-tema`. Sin esa clase se ven los dos a la vez, que es
   * justamente el defecto que este test cuida.
   *
   * jsdom no resuelve la cascada, así que acá se verifica el enganche: que los
   * dos botones existan y que cuelguen del contenedor que les da el escalón.
   */
  it('los dos botones del tema cuelgan del contenedor que les da especificidad', () => {
    const { container } = pintar()

    const escalon = container.querySelector('.aq-toggle-tema')
    expect(escalon).not.toBeNull()

    for (const clase of ['aq-en-claro', 'aq-en-oscuro']) {
      expect(escalon!.querySelector(`.${clase}`)).not.toBeNull()
    }
  })

  it('el perfil lleva a la pantalla de perfil', () => {
    pintar()

    expect(screen.getByLabelText(/perfil de Ana Gómez/i)).toHaveAttribute('href', '/perfil')
  })

  /**
   * Se renderizan los DOS botones y el CSS muestra el que corresponde. Del lado
   * del servidor no se puede saber qué prefiere el sistema operativo de quien
   * mira, y preguntarlo con JavaScript traería de vuelta el destello.
   */
  it('ofrece los dos sentidos del tema, y el CSS elige cuál se ve', () => {
    pintar()

    const aOscuro = screen.getByLabelText('Cambiar a tema oscuro')
    const aClaro = screen.getByLabelText('Cambiar a tema claro')

    expect(aOscuro.className).toContain('aq-en-claro')
    expect(aClaro.className).toContain('aq-en-oscuro')
  })

  it('cada botón manda el tema que promete', () => {
    pintar()

    expect(screen.getByLabelText('Cambiar a tema oscuro')).toHaveAttribute('value', 'oscuro')
    expect(screen.getByLabelText('Cambiar a tema claro')).toHaveAttribute('value', 'claro')
  })

  it('salir es un botón de formulario, no un link', () => {
    pintar()

    // Un `GET` desde un link lo dejaría expuesto a que un prefetch lo dispare.
    expect(screen.getByLabelText('Cerrar sesión').tagName).toBe('BUTTON')
  })

  it('el menú queda solo con navegación', () => {
    pintar()

    expect(within(menu()).queryByLabelText(/cerrar sesión/i)).toBeNull()
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
