import { ResetPasswordForm } from '@/components/auth/reset-password-form'

/**
 * Destino del link del correo: `${WEB_PUBLIC_URL}/reset-password?token=…`.
 *
 * El token llega por query string porque es lo único que un link de correo
 * puede llevar. De acá pasa a un campo oculto del formulario, así el submit no
 * lo vuelve a poner en la URL.
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token } = await searchParams
  const soloUno = Array.isArray(token) ? token[0] : token

  return <ResetPasswordForm token={soloUno ?? ''} />
}
