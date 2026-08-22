import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '@/app/(app)/layout'
import ModulosPage from '@/app/(app)/modulos/page'
import type { ServerUser } from '@/lib/api-server'
import type { Role } from '@/lib/roles'

vi.mock('@/lib/api-server', () => ({ getServerUser: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

/**
 * `leerTema` va a la cookie, y `cookies()` solo existe dentro de una petición.
 *
 * Este archivo llama al layout como función, sin request alrededor, así que el
 * tema se mockea. No es lo que estos tests verifican —el tema tiene los
 * suyos— y sin el mock reventarían por algo que no están probando.
 */
vi.mock('@/lib/tema', async (original) => ({
  ...(await original<typeof import('@/lib/tema')>()),
  leerTema: vi.fn(async () => 'claro' as const),
}))

const { getServerUser } = await import('@/lib/api-server')
const { redirect } = await import('next/navigation')

/** Props que Next le pasa a un layout de la ruta `/`. */
function layoutProps(children: React.ReactNode) {
  return { children, params: Promise.resolve({}) }
}

/** Perfil de `/auth/me`. Solo los roles cambian entre casos de este archivo. */
function usuario(roles: Role[]): ServerUser {
  return {
    id: 'u1',
    name: 'Ana',
    email: 'ana@aquazaku.com',
    roles,
    permisos: [],
    mustChangePassword: false,
  }
}

beforeEach(() => {
  // `redirect()` de Next corta la ejecución tirando. Si el mock no tirara, el
  // layout seguiría de largo y el test no probaría el guard de verdad.
  vi.mocked(redirect).mockImplementation(() => {
    throw new Error('NEXT_REDIRECT')
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('<AppLayout />', () => {
  it('manda a /login cuando no hay sesión', async () => {
    vi.mocked(getServerUser).mockResolvedValue(null)

    await expect(AppLayout(layoutProps(<p>privado</p>))).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('no renderiza el contenido privado cuando no hay sesión', async () => {
    vi.mocked(getServerUser).mockResolvedValue(null)

    await expect(AppLayout(layoutProps(<p>privado</p>))).rejects.toThrow()
    expect(screen.queryByText('privado')).not.toBeInTheDocument()
  })

  it('renderiza el contenido cuando hay sesión', async () => {
    vi.mocked(getServerUser).mockResolvedValue(usuario(['admin']))

    render(await AppLayout(layoutProps(<p>contenido</p>)))

    expect(screen.getByText('contenido')).toBeVisible()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('le pasa al sidebar los roles reales del usuario', async () => {
    vi.mocked(getServerUser).mockResolvedValue(usuario(['contador']))

    render(await AppLayout(layoutProps(<p>contenido</p>)))

    // El menú se renderiza dos veces —cajón de teléfono y columna de
    // escritorio— y en jsdom no hay media queries que oculten una.
    expect(
      within(screen.getByTestId('menu-escritorio')).getByRole('link', { name: 'Auditoría' }),
    ).toHaveAttribute('href', '/contador/auditoria')
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument()
  })

  // spec §7.2. El guard vive en el layout, así que una página nueva bajo (app)
  // no puede nacer salteándoselo.
  it('manda a cambiar la contraseña en el primer ingreso', async () => {
    vi.mocked(getServerUser).mockResolvedValue({
      ...usuario(['admin']),
      mustChangePassword: true,
    })

    await expect(AppLayout(layoutProps(<p>privado</p>))).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/change-password')
  })

  it('no muestra el dashboard mientras deba cambiar la contraseña', async () => {
    vi.mocked(getServerUser).mockResolvedValue({
      ...usuario(['admin']),
      mustChangePassword: true,
    })

    await expect(AppLayout(layoutProps(<p>privado</p>))).rejects.toThrow()
    expect(screen.queryByText('privado')).not.toBeInTheDocument()
  })

  it('deja pasar a quien ya cambió la contraseña', async () => {
    vi.mocked(getServerUser).mockResolvedValue(usuario(['admin']))

    render(await AppLayout(layoutProps(<p>contenido</p>)))

    expect(redirect).not.toHaveBeenCalled()
  })

  // El guard es del layout, no de cada página: si esto se rompe, cada página
  // nueva bajo (app) nace desprotegida sin que nadie lo note.
  it('consulta la sesión exactamente una vez por render', async () => {
    vi.mocked(getServerUser).mockResolvedValue(usuario(['admin']))

    render(await AppLayout(layoutProps(<p>contenido</p>)))

    expect(getServerUser).toHaveBeenCalledTimes(1)
  })
})

/**
 * El dashboard dejó de ser un título con una línea de bienvenida: ahora trae
 * datos y contesta «qué está esperando que alguien haga algo».
 *
 * Sus casos viven en `dashboard.test.tsx`, que puede mockear las lecturas. Acá
 * quedaría a medio probar y obligaría a este archivo —que verifica el guard de
 * sesión— a saber de stock.
 */

describe('<ModulosPage />', () => {
  it('explica que hay que elegir un módulo del menú', () => {
    render(<ModulosPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Módulos' })).toBeInTheDocument()
  })
})
