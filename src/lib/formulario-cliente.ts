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

/**
 * Un `<select>` que no pierde lo elegido cuando la acción falla.
 *
 * ── El problema, medido ─────────────────────────────────────────────────────
 *
 * `startHostTransition` de react-dom llama a `requestFormReset` SIN CONDICIÓN
 * en todo `<form action>`, y el `form.reset()` corre en la fase de commit. No
 * distingue el éxito del error, y no hay opt-out: pasar la acción por el
 * `formAction` del botón entra por el mismo camino.
 *
 * A un `<input>` controlado eso no le hace nada —React lo restaura— pero a un
 * `<select>` sí: queda en blanco aunque el estado siga diciendo qué se eligió.
 * Y eso es caro. Con el desplegable vacío, quien corrige el error y reintenta
 * manda la venta sin dirección, o con otra; RN-VEN-02 prohíbe editar una venta
 * confirmada, así que un botellón a la casa equivocada solo se arregla
 * anulando.
 *
 * ── Por qué un efecto, que normalmente acá se evita ─────────────────────────
 *
 * Se intentó remontar el campo con un `key` atado a los envíos terminados, y la
 * traza de renders mostró por qué no alcanza: el último render YA tiene el valor
 * correcto y el reset llega después. Cualquier arreglo en tiempo de render
 * pierde esa carrera.
 *
 * Los efectos corren DESPUÉS del commit: es el primer momento en que el DOM ya
 * fue reseteado y todavía se puede corregir. Sin lista de dependencias a
 * propósito — tiene que revisar después de cada commit, porque el reset no
 * avisa.
 *
 * El `<select>` sigue siendo controlado: esto no lo reemplaza, lo repara.
 */
export function useSelectResistenteAlReset(valor: string) {
  const ref = useRef<HTMLSelectElement>(null)

  useEffect(() => {
    const campo = ref.current
    if (campo && campo.value !== valor) campo.value = valor
  })

  return ref
}
