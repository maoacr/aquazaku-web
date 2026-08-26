'use client'

import { useEffect, useRef, useState } from 'react'
import { avisarExito } from './avisos'
import type { EstadoDeFormulario } from './formulario'

/**
 * La plomería de React que comparten los formularios de todas las pantallas.
 *
 * Vive aparte de `formulario.ts` porque ese lo importan las Server Actions, y
 * un `'use client'` ahí arrastraría estos hooks al bundle del servidor.
 */

/**
 * Dispara el toast UNA vez por éxito.
 *
 * Se ancla al `token` y no al mensaje: dos entradas seguidas con el mismo saldo
 * darían el mismo texto, y sin el token la segunda no avisaría. El token cambia
 * siempre.
 *
 * `useEffect` acá sí corresponde: mostrar un toast es un efecto externo al
 * render, no un valor derivado. La limpieza de los campos —que SÍ es derivada—
 * va por `key` o por `useLimpiezaAlRegistrar`, sin efecto.
 */
export function useAvisoDeExito(estado: EstadoDeFormulario): void {
  const ultimoAvisado = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!estado.token || !estado.ok) return
    if (estado.token === ultimoAvisado.current) return

    ultimoAvisado.current = estado.token
    avisarExito(estado.ok)
  }, [estado.token, estado.ok])
}

/**
 * Vuelve el estado controlado a su valor inicial cuando la acción tuvo éxito.
 *
 * Corre DURANTE el render, no en un `useEffect`. Es el patrón que React
 * documenta para ajustar estado cuando cambia una prop: React descarta el
 * render en curso y vuelve a empezar con el estado nuevo, sin pintar el
 * intermedio y sin la cascada de renders que trae sincronizar con un efecto.
 */
export function useLimpiezaAlRegistrar(token: string | undefined, limpiar: () => void): void {
  const [ultimo, setUltimo] = useState(token)

  if (token !== ultimo) {
    setUltimo(token)
    if (token) limpiar()
  }
}

/**
 * El `key` que limpia un campo NO controlado al registrar.
 *
 * Se DERIVA del token, sin efecto: cambiar el `key` remonta el campo.
 *
 * El nombre del campo va en la clave porque estas `key` se aplican a elementos
 * HERMANOS: con la misma clave en dos hermanos, React avisa «two children with
 * the same key» y el formulario se rompe de formas que no se explican solas.
 */
export function limpiezaKey(estado: EstadoDeFormulario, campo: string): string {
  return `${campo}-${estado.token ?? 'inicial'}`
}
