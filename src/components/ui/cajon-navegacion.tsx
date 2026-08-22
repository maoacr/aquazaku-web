'use client'

import { Menu, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * La cabecera y el menú, juntos porque comparten un estado: abierto o cerrado.
 *
 * ── Por qué los dos en un mismo componente ──────────────────────────────────
 *
 * El botón vive en la cabecera y el panel es una columna del grid: en el árbol
 * son hermanos, no padre e hijo. Si el panel colgara del `<header>` —como en el
 * primer intento— en escritorio no podría ser una celda del grid, porque
 * estaría anidado dentro de otra.
 *
 * Devuelve un fragmento con `<header>` y `<nav>`, cada uno asignado a su área.
 * El contenido llega como props ya renderizado en el servidor: lo único que
 * necesita JavaScript es el abierto/cerrado.
 *
 * ── Por qué esto lleva JavaScript ───────────────────────────────────────────
 *
 * Los dos intentos anteriores lo evitaron y salieron peor: un `<details>` —que
 * es un *disclosure*, no un cajón— y después dos copias del mismo menú para
 * esquivar cómo el navegador esconde su contenido.
 *
 * Un cajón necesita estado: animarse, cerrarse tocando afuera, responder a
 * `Escape` y devolver el foco. Eso es un componente.
 */
export function CabeceraYMenu({
  marca,
  marcaDelPanel,
  acciones,
  menu,
}: {
  marca: ReactNode
  marcaDelPanel: ReactNode
  acciones: ReactNode
  menu: ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const panelId = useId()
  const botonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return

    const alPresionar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      // Devolver el foco al botón: si se pierde, quien navega con teclado
      // vuelve al principio del documento sin saber por qué.
      botonRef.current?.focus()
    }

    document.addEventListener('keydown', alPresionar)
    return () => document.removeEventListener('keydown', alPresionar)
  }, [abierto])

  return (
    <>
      <header
        style={{ gridArea: 'cabecera' }}
        /*
          Sin superficie propia: ni fondo, ni borde, ni sombra.
 
          La cabecera NO se superpone a nada. El contenido scrollea en su propia
          fila del grid, debajo, así que una lámina acá no está tapando nada — es
          una barra que se dibuja sola y parte la pantalla en dos.

          Sin ella, los tres controles quedan flotando sobre el mismo fondo que
          el contenido, que es exactamente lo que son: chrome, no una sección.
        */
        className="relative flex items-center gap-1 px-2 py-2 sm:px-4"
      >
        <button
          ref={botonRef}
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-controls={panelId}
          aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
          // 44 px: objetivo táctil mínimo del sistema de diseño.
          className="flex size-11 items-center justify-center rounded-md text-principal hover:bg-fondo sm:hidden"
        >
          {abierto ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>

        {/*
          En teléfono la marca va acá porque el menú está detrás de un cajón: sin
          ella, la pantalla no dice en qué sistema estás. En escritorio vive
          arriba del panel de marca —como en el arte de referencia— y acá
          desaparece: repetirla al lado del panel la deja huérfana.
        */}
        <span className="sm:hidden">{marca}</span>
        {acciones}

        {/*
          Acá había una línea de 2 px con el gradiente de marca, y se fue.

          Contaba la misma historia que ahora cuenta el panel del menú —el agua
          que entra azul y sale potable— así que eran dos veces el mismo gesto
          en la misma pantalla. Repetido pierde significado, y en 2 px cruzando
          todo el ancho deja de leerse como marca: se lee como una raya de color
          suelta.

          La cabecera se separa del contenido con el borde del vidrio, que es lo
          que un borde tiene que hacer.
        */}
      </header>

      {/* Fondo que cierra al tocar afuera. `aria-hidden` porque `Escape` y el
          botón ya cubren el teclado. */}
      <div
        onClick={() => setAbierto(false)}
        aria-hidden
        className={`fixed inset-0 z-20 bg-velo transition-opacity duration-200 motion-reduce:transition-none sm:hidden ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <nav
        id={panelId}
        aria-label="Módulos"
        style={{ gridArea: 'menu' }}
        // `-translate-x-full` en vez de `hidden`: un elemento con `display:none`
        // no se puede animar, y el cajón entra deslizándose.
        // En teléfono es un cajón que ocupa el alto completo; en escritorio, una
        // tarjeta con margen que flota sobre el agua como las demás.
        className={`aq-panel-marca fixed inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col rounded-none py-4 transition-transform duration-200 ease-out motion-reduce:transition-none sm:relative sm:m-3 sm:w-auto sm:max-w-none sm:translate-x-0 sm:rounded-xl ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/*
          La marca corona el panel, que es donde la pone el arte. En teléfono el
          cajón ya se abre desde la cabecera —que la muestra— así que acá sería
          la segunda vez en la misma pantalla.
        */}
        <div className="mb-1 hidden px-5 sm:block">{marcaDelPanel}</div>

        {/* Cerrar al navegar: tocar un módulo y que el cajón quede tapando la
            pantalla a la que acabás de llegar es la forma más rápida de que se
            sienta roto. */}
        <div onClick={() => setAbierto(false)} className="contents">
          {menu}
        </div>
      </nav>
    </>
  )
}
