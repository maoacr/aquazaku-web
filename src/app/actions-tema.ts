'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { COOKIE_TEMA, MAX_EDAD_TEMA, type Tema, esTemaValido } from '@/lib/tema'

/**
 * Guarda la preferencia de tema.
 *
 * La cookie **no es `httpOnly`**: no es un secreto y no protege nada. Marcarla
 * como secreta sugeriría lo contrario a quien lea el código después.
 *
 * Sí lleva `sameSite: 'lax'`, como todo lo demás del sistema.
 */
export async function cambiarTemaAction(formData: FormData): Promise<void> {
  const elegido = formData.get('tema')

  // Un valor que no es de los tres se ignora en silencio. No hay pantalla que
  // pueda mandarlo, así que un error acá solo confundiría a quien lo vea.
  if (!esTemaValido(elegido)) return

  const almacen = await cookies()
  almacen.set(COOKIE_TEMA, elegido satisfies Tema, {
    maxAge: MAX_EDAD_TEMA,
    sameSite: 'lax',
    path: '/',
  })

  // El tema lo pinta el layout, así que hay que revalidarlo entero: sin esto,
  // la cookie cambia y la pantalla se queda como estaba hasta la próxima
  // navegación completa.
  revalidatePath('/', 'layout')
}
