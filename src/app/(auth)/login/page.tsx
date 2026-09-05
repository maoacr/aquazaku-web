import { LoginForm } from '@/components/auth/login-form'
import { leerAviso } from '@/lib/avisos-de-navegacion'

/**
 * El login.
 *
 * Lee el aviso que puedan haberle dejado en la URL: quien acaba de cambiar su
 * contraseña llega acá, y sin una línea que lo explique la pantalla se lee como
 * «algo salió mal, volvé a empezar».
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>
}) {
  const { aviso } = await searchParams

  return <LoginForm aviso={leerAviso(aviso)} />
}
