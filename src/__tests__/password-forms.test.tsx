import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChangePasswordPage from '@/app/(auth)/change-password/page'
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page'
import ResetPasswordPage from '@/app/(auth)/reset-password/page'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { FormError } from '@/components/auth/form-error'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { resolveWebUrl } from '@/lib/form-errors'

vi.mock('@/app/(auth)/forgot-password/actions', () => ({ forgotPasswordAction: vi.fn() }))
vi.mock('@/app/(auth)/reset-password/actions', () => ({ resetPasswordAction: vi.fn() }))
vi.mock('@/app/(auth)/change-password/actions', () => ({ changePasswordAction: vi.fn() }))
vi.mock('@/lib/api-server', () => ({ getServerUser: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const { forgotPasswordAction } = await import('@/app/(auth)/forgot-password/actions')
const { changePasswordAction } = await import('@/app/(auth)/change-password/actions')
const { getServerUser } = await import('@/lib/api-server')
const { redirect } = await import('next/navigation')

afterEach(() => {
  vi.clearAllMocks()
})

describe('<FormError />', () => {
  it('no renderiza nada sin mensaje', () => {
    const { container } = render(<FormError id="x" />)

    expect(container).toBeEmptyDOMElement()
  })

  it('anuncia el mensaje como alerta', () => {
    render(<FormError id="x">algo salió mal</FormError>)

    expect(screen.getByRole('alert')).toHaveTextContent('algo salió mal')
  })
})

describe('<ForgotPasswordForm />', () => {
  it('pide solo el email', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument()
  })

  it('ofrece volver al login', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByRole('link', { name: /volver a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  // El mensaje de éxito no confirma que el email exista: si lo hiciera, este
  // formulario serviría para enumerar cuentas.
  it('tras enviar no confirma que la cuenta exista', async () => {
    vi.mocked(forgotPasswordAction).mockResolvedValue({ enviado: true })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'ana@aquazaku.com')
    await user.click(screen.getByRole('button', { name: /enviarme el link/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/si ese email tiene una cuenta/i)
  })

  it('muestra el error que devuelve la action', async () => {
    vi.mocked(forgotPasswordAction).mockResolvedValue({ error: 'Demasiados intentos.' })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText('Email'), 'ana@aquazaku.com')
    await user.click(screen.getByRole('button', { name: /enviarme el link/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos.')
  })
})

describe('<ResetPasswordForm />', () => {
  // Si el token viajara en la URL del submit quedaría en el historial del
  // browser y en los logs de acceso. En un campo oculto, no.
  it('lleva el token en un campo oculto', () => {
    const { container } = render(<ResetPasswordForm token="tok-123" />)

    const oculto = container.querySelector('input[name="token"]')
    expect(oculto).toHaveAttribute('type', 'hidden')
    expect(oculto).toHaveValue('tok-123')
  })

  it('pide la contraseña nueva dos veces', () => {
    render(<ResetPasswordForm token="tok" />)

    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
    expect(screen.getByLabelText('Repetí la contraseña nueva')).toBeInTheDocument()
  })

  it('enmascara ambos campos y exige el mínimo del spec', () => {
    render(<ResetPasswordForm token="tok" />)

    for (const label of ['Contraseña nueva', 'Repetí la contraseña nueva']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password')
      expect(screen.getByLabelText(label)).toHaveAttribute('minlength', '8')
    }
  })

  it('ofrece pedir un link nuevo si el suyo venció', () => {
    render(<ResetPasswordForm token="" />)

    expect(screen.getByRole('link', { name: /pedir un link nuevo/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })
})

describe('<ChangePasswordForm />', () => {
  it('exige la contraseña actual además de la nueva', () => {
    render(<ChangePasswordForm />)

    expect(screen.getByLabelText('Contraseña actual')).toBeRequired()
    expect(screen.getByLabelText('Contraseña nueva')).toBeInTheDocument()
  })

  // Cambiarla cierra todas las sesiones: avisarlo antes, no después.
  it('avisa que se van a cerrar todas las sesiones', () => {
    render(<ChangePasswordForm />)

    expect(screen.getByText(/se cierran todas sus sesiones/i)).toBeVisible()
  })

  it('no habla de primer ingreso por defecto', () => {
    render(<ChangePasswordForm />)

    expect(screen.queryByText(/primer ingreso/i)).not.toBeInTheDocument()
  })

  it('explica el motivo cuando es el primer ingreso', () => {
    render(<ChangePasswordForm primerIngreso />)

    expect(screen.getByRole('status')).toHaveTextContent(/primer ingreso/i)
  })

  it('muestra el error que devuelve la action', async () => {
    vi.mocked(changePasswordAction).mockResolvedValue({
      error: 'La contraseña actual no es correcta.',
    })
    const user = userEvent.setup()
    render(<ChangePasswordForm />)

    await user.type(screen.getByLabelText('Contraseña actual'), 'vieja')
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nuevaClave1')
    await user.type(screen.getByLabelText('Repetí la contraseña nueva'), 'nuevaClave1')
    await user.click(screen.getByRole('button', { name: /cambiar contraseña/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('La contraseña actual no es correcta.')
  })
})

describe('páginas', () => {
  it('/forgot-password renderiza su formulario', () => {
    render(<ForgotPasswordPage />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Recuperar contraseña' }),
    ).toBeInTheDocument()
  })

  it('/reset-password toma el token del query string', async () => {
    render(
      await ResetPasswordPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ token: 'desde-el-mail' }),
      }),
    )

    expect(document.querySelector('input[name="token"]')).toHaveValue('desde-el-mail')
  })

  // Un link mal copiado puede duplicar el parámetro. Se toma el primero en vez
  // de mandar "tok,tok" a api/.
  it('/reset-password aguanta un token duplicado en la URL', async () => {
    render(
      await ResetPasswordPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({ token: ['uno', 'dos'] }),
      }),
    )

    expect(document.querySelector('input[name="token"]')).toHaveValue('uno')
  })

  it('/reset-password sin token deja el campo vacío', async () => {
    render(
      await ResetPasswordPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({}),
      }),
    )

    expect(document.querySelector('input[name="token"]')).toHaveValue('')
  })

  it('/change-password manda a login si no hay sesión', async () => {
    vi.mocked(getServerUser).mockResolvedValue(null)
    vi.mocked(redirect).mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })

    await expect(ChangePasswordPage()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('/change-password avisa del primer ingreso cuando corresponde', async () => {
    vi.mocked(getServerUser).mockResolvedValue({
      id: 'u1',
      name: 'Ana',
      email: 'ana@aquazaku.com',
      roles: ['pos'],
      permisos: [],
      mustChangePassword: true,
    })

    render(await ChangePasswordPage())

    expect(screen.getByRole('status')).toHaveTextContent(/primer ingreso/i)
  })
})

describe('resolveWebUrl()', () => {
  it('falla con un mensaje accionable si falta WEB_PUBLIC_URL', () => {
    vi.stubEnv('WEB_PUBLIC_URL', '')

    expect(() => resolveWebUrl()).toThrow(/WEB_PUBLIC_URL/)

    vi.unstubAllEnvs()
  })

  it('recorta la barra final para no armar links con doble barra', () => {
    vi.stubEnv('WEB_PUBLIC_URL', 'http://localhost:3000/')

    expect(resolveWebUrl()).toBe('http://localhost:3000')

    vi.unstubAllEnvs()
  })
})
