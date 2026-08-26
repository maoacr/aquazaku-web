'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'

/**
 * Envuelve los controles de sesión y les da lámina **solo al scrollear**.
 *
 * ── Por qué no siempre ──────────────────────────────────────────────────────
 *
 * Arriba de todo, los tres iconos flotan sobre la misma agua que el contenido y
 * eso es exactamente lo que son: chrome, no una sección. Darles superficie ahí
 * dibuja una barra que parte la pantalla en dos sin que nada la haya pedido.
 *
 * Pero cuando el contenido empieza a pasar por debajo, la cosa cambia: los
 * iconos se mezclan con lo que scrollea y por un momento no se sabe qué es
 * chrome y qué es dato. Ahí la lámina deja de ser decoración y pasa a ser lo que
 * los separa.
 *
 * ── Por qué un listener y no `animation-timeline: scroll()` ─────────────────
 *
 * La versión en CSS puro existe y sería más elegante, pero todavía no funciona
 * en Safari ni en Firefox — y quien atiende el mostrador puede estar en
 * cualquiera de los dos.
 *
 * El costo es bajo y está acotado a propósito: el listener es `passive`, y el
 * estado solo se toca cuando se CRUZA el umbral, no en cada píxel. Un `setState`
 * por scroll haría re-renderizar el árbol entero sesenta veces por segundo.
 */
export function CabeceraAlScroll({ children }: { children: ReactNode }) {
  const [separada, setSeparada] = useState(false)
  // En una ref y no en estado: leerla no debe provocar render.
  const separadaRef = useRef(false)

  useEffect(() => {
    // El scroll no vive en la ventana: vive en el `<main>`, que es lo único que
    // scrollea del armazón. Escuchar `window` acá no recibiría nada.
    const contenido = document.querySelector('main')
    if (!contenido) return

    const alScrollear = () => {
      const debeSeparar = contenido.scrollTop > 8
      if (debeSeparar === separadaRef.current) return

      separadaRef.current = debeSeparar
      setSeparada(debeSeparar)
    }

    // Una vez al montar: si se llega a la pantalla con el scroll ya movido
    // —volviendo atrás en el historial— el estado tiene que arrancar bien.
    alScrollear()

    contenido.addEventListener('scroll', alScrollear, { passive: true })
    return () => contenido.removeEventListener('scroll', alScrollear)
  }, [])

  return (
    <div
      /*
        La transición va en las propiedades que NO repintan el layout. `opacity`
        y `box-shadow` se resuelven en el compositor; animar `background` con un
        gradiente detrás fue lo que costó 17 fps la primera vez.
      */
      className={`aq-cabecera-flotante ml-auto flex items-center gap-1 ${
        separada ? 'aq-cabecera-flotante-separada' : ''
      }`}
    >
      {children}
    </div>
  )
}
