'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { COOKIE_MENU, type EstadoDelMenu, MAX_EDAD_MENU, esEstadoValido } from '@/lib/menu'

/**
 * Colapsa o despliega el menú lateral.
 *
 * Va por Server Action y no por estado de cliente para que la preferencia
 * PERSISTA: sin esto, colapsarlo duraría hasta la próxima navegación y habría
 * que volver a hacerlo cada vez.
 *
 * Es el mismo mecanismo que el toggle de tema —un `<form>` con una acción— así
 * que **funciona sin JavaScript**. Un botón que solo anda con el bundle cargado
 * es un botón que no anda mientras la página termina de cargar.
 */
export async function cambiarEstadoDelMenuAction(formData: FormData): Promise<void> {
  const elegido = formData.get('menu')

  // Un valor que no es de los dos se ignora en silencio: no hay pantalla que
  // pueda mandarlo, así que un error acá solo confundiría a quien lo vea.
  if (!esEstadoValido(elegido)) return

  const almacen = await cookies()
  almacen.set(COOKIE_MENU, elegido satisfies EstadoDelMenu, {
    maxAge: MAX_EDAD_MENU,
    sameSite: 'lax',
    path: '/',
  })

  // El armazón lo pinta el layout de `(app)`, así que se revalida desde ahí: el
  // menú es parte del marco, no de la pantalla que se esté mirando.
  revalidatePath('/', 'layout')
}
