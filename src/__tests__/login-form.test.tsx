import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AuthLayout from '@/app/(auth)/layout'
import LoginPage from '@/app/(auth)/login/page'
import { LoginForm } from '@/components/auth/login-form'

vi.mock('@/app/(auth)/login/actions', () => ({ loginAction: vi.fn() }))

const { loginAction } = await import('@/app/(auth)/login/actions')

afterEach(() => {
  vi.clearAllMocks()
})

describe('<LoginForm />', () => {
  it('pide email y contraseña con labels asociados', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })

  // Sin `type="password"` la contraseña se ve en pantalla y queda en el
  // historial de autocompletado como texto plano.
  it('enmascara la contraseña', () => {
    render(<LoginForm />)

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password')
  })

  it('ofrece la salida a recuperar contraseña', () => {
    render(<LoginForm />)

    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('no muestra ningún error antes de intentar', () => {
    render(<LoginForm />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  // Este es el bug que tenía el snippet del plan: devolvía `{ error }` desde la
  // action pero el `<form action={fn}>` descartaba el retorno, así que el
  // usuario nunca veía nada. Con `useActionState` sí llega a la pantalla.
  it('muestra en pantalla el error que devuelve la action', async () => {
    vi.mocked(loginAction).mockResolvedValue({ error: 'Credenciales inválidas.' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'ana@aquazaku.com')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Credenciales inválidas.')
  })

  it('asocia el error a los campos para lectores de pantalla', async () => {
    vi.mocked(loginAction).mockResolvedValue({ error: 'Credenciales inválidas.' })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText('Email'), 'ana@aquazaku.com')
    await user.type(screen.getByLabelText('Contraseña'), 'mala')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'login-error')
  })
})

describe('<LoginPage />', () => {
  it('renderiza el formulario', () => {
    render(<LoginPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument()
  })
})

describe('<AuthLayout />', () => {
  it('envuelve a sus hijos', () => {
    render(<AuthLayout>{<p>contenido</p>}</AuthLayout>)

    expect(screen.getByText('contenido')).toBeVisible()
  })
})
