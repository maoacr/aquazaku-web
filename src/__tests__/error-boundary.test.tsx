import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorDeApp from '@/app/(app)/error'
import { ApiError } from '@/lib/errors'

/**
 * Qué ve alguien sin permiso.
 *
 * Este boundary es la mitad de `web/` del contrato de RN-ACC-02: `api/` prohíbe
 * con 403, y acá se decide si eso se ve como "no tiene acceso" o como una
 * pantalla rota genérica.
 *
 * Se testea renderizando el componente porque el camino real —entrar a
 * `/modulos/productos/gestion` como `pos`— exige una sesión de otro rol, y el
 * riesgo que importa no es la navegación sino que el 403 termine mostrándose
 * como error de servidor.
 */
const REQUEST_ID = 'req_7f3a91'

function errorConStatus(status: number): Error & { digest?: string } {
  const err = new ApiError(status, 'lo que sea', { path: '/productos', requestId: REQUEST_ID })
  return err as Error & { digest?: string }
}

describe('<ErrorDeApp /> — la UI oculta, la API prohíbe (RN-ACC-02)', () => {
  it('un 403 se explica como falta de permiso, no como pantalla rota', () => {
    render(<ErrorDeApp error={errorConStatus(403)} reset={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/no tiene acceso/i)
    expect(screen.queryByText(/se rompi[óo] de nuestro lado/i)).toBeNull()
  })

  it('avisa que el intento quedó auditado: es cierto y desalienta insistir', () => {
    render(<ErrorDeApp error={errorConStatus(403)} reset={vi.fn()} />)

    expect(screen.getByText(/auditor[ií]a/i)).toBeInTheDocument()
  })

  it('un 403 NO ofrece reintentar: reintentar no va a cambiar los permisos', () => {
    render(<ErrorDeApp error={errorConStatus(403)} reset={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /reintentar/i })).toBeNull()
  })

  it('un 500 sí ofrece reintentar y muestra el código para soporte', () => {
    render(<ErrorDeApp error={errorConStatus(500)} reset={vi.fn()} />)

    expect(screen.getByRole('alert')).toHaveTextContent(/se rompi[óo] de nuestro lado/i)
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument()

    // El código es el `requestId`, no el digest entero.
    expect(screen.getByText(REQUEST_ID)).toBeInTheDocument()
  })

  /**
   * Este test reemplaza a uno que mostraba el digest completo, y el cambio no
   * fue cosmético.
   *
   * `aquazaku-api:500` tenía dos problemas a la vez. Decía «500», que a la
   * persona no le significa nada y que R52 no quiere en pantalla. Y era el
   * MISMO string para todas las fallas del sistema: alguien lo reportaba,
   * soporte lo buscaba en los logs y encontraba cuatrocientas.
   */
  it('el código de soporte NO muestra el status ni el prefijo interno', () => {
    render(<ErrorDeApp error={errorConStatus(500)} reset={vi.fn()} />)

    const pantalla = screen.getByRole('alert').textContent ?? ''

    expect(pantalla).not.toContain('500')
    expect(pantalla).not.toContain('aquazaku-api')
  })

  it('sin requestId no inventa un código: no muestra ninguno', () => {
    const sinId = new ApiError(500, 'x', { path: '/productos' }) as Error & { digest?: string }
    render(<ErrorDeApp error={sinId} reset={vi.fn()} />)

    expect(screen.queryByText(/pasale este c[óo]digo/i)).toBeNull()
  })

  it('un error sin digest no rompe la pantalla', () => {
    render(<ErrorDeApp error={new Error('boom')} reset={vi.fn()} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('reintentar llama a reset y no recarga la página a mano', () => {
    const reset = vi.fn()
    render(<ErrorDeApp error={errorConStatus(500)} reset={reset} />)

    screen.getByRole('button', { name: /reintentar/i }).click()

    expect(reset).toHaveBeenCalledOnce()
  })
})
