import { redirect } from 'next/navigation'
import { AppShell } from '@/components/ui/app-shell'
import { leerTema } from '@/lib/tema'
import { getServerUser } from '@/lib/api-server'

/**
 * Layout de todo lo que requiere sesión.
 *
 * El guard vive acá y no en cada página: una página nueva bajo `(app)/` nace
 * protegida sin que su autor tenga que acordarse de nada. `(app)` es un route
 * group, así que no agrega segmento a la URL — el dashboard queda en `/`.
 *
 * Un `getServerUser()` que devuelve `null` es "no hay sesión" y va a /login.
 * Cualquier otro fallo (403, 5xx, api/ caída) se propaga a propósito: mandar a
 * /login a alguien que SÍ tiene sesión lo dejaría en un loop de redirects.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  // Las dos lecturas van en paralelo: la sesión viaja a `api/` y el tema sale
  // de una cookie local, así que encadenarlas costaría un viaje de más.
  const [user, tema] = await Promise.all([getServerUser(), leerTema()])

  if (!user) {
    redirect('/login')
  }

  // spec §7.2: en el primer ingreso hay que elegir una contraseña propia antes
  // de entrar a ningún lado. El chequeo va acá y no en cada página por el mismo
  // motivo que el de sesión: una página nueva no puede nacer sin él.
  //
  // `/change-password` vive en `(auth)`, fuera de este layout, así que mandarlo
  // ahí no reentra por este guard y no hay loop.
  if (user.mustChangePassword) {
    redirect('/change-password')
  }

  return (
    <AppShell userRoles={user.roles} userName={user.name} tema={tema}>
      {children}
    </AppShell>
  )
}
