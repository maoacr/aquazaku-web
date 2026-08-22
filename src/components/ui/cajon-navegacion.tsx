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
export function CabeceraYMenu({ marca, menu }: { marca: ReactNode; menu: ReactNode }) {
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
        className="relative flex items-center gap-1 border-b border-sutil bg-tarjeta px-2 py-2 sm:px-4"
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

        {marca}

        {/*
          La línea de marca repite la secuencia del isotipo: azul, aqua, verde.
          Es el agua entrando de la red y saliendo potable.

          Va absoluta sobre el borde en vez de ser una fila del grid: una fila
          de 2 px para una línea decorativa desordena el resto del armazón.
        */}
        <span
          aria-hidden
          className="absolute inset-x-0 -bottom-px h-0.5"
          style={{ background: 'var(--aq-gradiente-cinta)' }}
        />
      </header>

      {/* Fondo que cierra al tocar afuera. `aria-hidden` porque `Escape` y el
          botón ya cubren el teclado. */}
      <div
        onClick={() => setAbierto(false)}
        aria-hidden
        className={`fixed inset-0 z-20 bg-neutral-950/50 transition-opacity duration-200 motion-reduce:transition-none sm:hidden ${
          abierto ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <nav
        id={panelId}
        aria-label="Módulos"
        style={{ gridArea: 'menu' }}
        // `-translate-x-full` en vez de `hidden`: un elemento con `display:none`
        // no se puede animar, y el cajón entra deslizándose.
        className={`fixed inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col border-r border-sutil bg-tarjeta p-4 shadow-elev-3 transition-transform duration-200 ease-out motion-reduce:transition-none sm:static sm:w-auto sm:max-w-none sm:translate-x-0 sm:shadow-none ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
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
