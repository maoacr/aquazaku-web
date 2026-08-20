'use server'

import { redirect } from 'next/navigation'
import { apiServerFetchRaw, forwardSetCookies } from '@/lib/api-server'

/**
 * Cierra la sesión (spec §7.4).
 *
 * Se delega en `api/`, que invalida la sesión en la base y devuelve la cookie
 * de borrado con los mismos atributos con que la creó. Borrarla desde `web/`
 * con otro `path` o `domain` no borraría nada: el usuario se quedaría logueado
 * creyendo que salió.
 *
 * El `set-cookie` se reenvía ANTES del redirect, por el mismo motivo que en el
 * login: al revés, `api/` habría cerrado la sesión y el browser seguiría
 * mandando una cookie que ya no vale.
 */
export async function cerrarSesionAction(): Promise<void> {
  const res = await apiServerFetchRaw('/auth/sign-out', { method: 'POST' })

  // Aunque `api/` falle, al usuario hay que sacarlo igual: dejarlo adentro
  // porque el logout no anduvo es lo contrario de lo que pidió.
  if (res.ok) {
    await forwardSetCookies(res)
  }

  redirect('/login')
}
