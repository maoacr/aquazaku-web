'use server'

import { revalidatePath } from 'next/cache'
import { apiServerFetchRaw } from '@/lib/api-server'
import { type EstadoDeFormulario, exito } from '@/lib/formulario'

/**
 * Cambiar un umbral de alerta — M12.
 *
 * El rango lo decide `api`, que lo lee de la misma fila donde vive el valor. No
 * se copia acá: un tercer lugar con los mismos números es un tercer lugar donde
 * pueden discrepar.
 */
export async function cambiarUmbralAction(
  _previo: EstadoDeFormulario,
  datos: FormData,
): Promise<EstadoDeFormulario> {
  const clave = String(datos.get('clave') ?? '')
  const valor = String(datos.get('valor') ?? '').trim()

  if (valor === '') return { error: 'Escriba un número de días.' }

  const res = await apiServerFetchRaw(`/parametros/${clave}`, {
    method: 'PUT',
    body: JSON.stringify({ valor }),
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const cuerpo = (await res.json().catch(() => ({}))) as { mensaje?: string }
    return { error: cuerpo.mensaje ?? 'No pudimos cambiar el umbral. Intente de nuevo.' }
  }

  const p = (await res.json()) as { etiqueta: string; valor: number; unidad: string }

  /*
   * Se revalida `/` y stock además de esta pantalla: el umbral decide qué se
   * pinta como «vence pronto» allá. Sin esto, alguien lo cambia, vuelve al
   * panel y ve los avisos viejos — y concluye que no se guardó.
   */
  revalidatePath('/modulos/alertas')
  revalidatePath('/modulos/stock', 'layout')
  revalidatePath('/')

  return exito(`${p.etiqueta}: ahora avisa a los ${p.valor} ${p.unidad}.`)
}
