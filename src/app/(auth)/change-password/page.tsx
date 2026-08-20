import { redirect } from 'next/navigation'
import { ChangePasswordForm } from '@/components/auth/change-password-form'
import { getServerUser } from '@/lib/api-server'

/**
 * Vive en `(auth)` y no en `(app)` a propósito.
 *
 * Necesita sesión —`/auth/change-password` exige auth— pero NO puede quedar
 * detrás del guard de primer ingreso: ese guard manda justamente acá, y estar
 * del otro lado produciría un loop de redirects. Por eso resuelve la sesión
 * por su cuenta.
 */
export default async function ChangePasswordPage() {
  const user = await getServerUser()
  if (!user) redirect('/login')

  return <ChangePasswordForm primerIngreso={user.mustChangePassword} />
}
