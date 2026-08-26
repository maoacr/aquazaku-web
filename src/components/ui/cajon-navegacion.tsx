'use client'

import { Menu, X } from 'lucide-react'
import type { Role } from '@/lib/roles'
import { NavegacionInferior } from './navegacion-inferior'
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
  roles,
  creditos,
  estadoDelMenu,
  toggleDelMenu,
}: {
  marca: ReactNode
  marcaDelPanel: ReactNode
  acciones: ReactNode
  menu: ReactNode
  /**
   * Los roles de quien entró.
   *
   * La barra inferior los necesita para resolver sus propios módulos. No se le
   * pasan los módulos ya armados porque `icono` es un componente, y una función
   * no cruza la frontera servidor/cliente.
   */
  roles: Role[]
  /**
   * Los créditos del pie.
   *
   * En teléfono el pie lo ocupa la barra de navegación, así que esto se muda al
   * fondo del cajón — que es donde alguien va a buscar «de quién es esto».
   */
  creditos: ReactNode
  /** Resuelto en el SERVIDOR: la primera pintura ya sale con el ancho correcto. */
  estadoDelMenu: 'desplegado' | 'colapsado'
  /** El botón que lo colapsa. Es un `<form>`, así que anda sin JavaScript. */
  toggleDelMenu: ReactNode
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
        /*
          Sin superficie propia: ni fondo, ni borde, ni sombra. Son chrome —tres
          controles— y no una sección, así que flotan sobre la misma agua que
          todo lo demás en vez de dibujarse una barra que parte la pantalla.

          En escritorio la cabecera NO ocupa fila propia: `aq-cabecera` la manda
          encima del contenido (ver `globals.css`). Es lo que permite que el
          `<main>` empiece en el borde del viewport y que su primera línea quede
          a la misma altura que el borde del panel del menú. Con la cabecera
          como fila, el contenido arrancaba 68 px más abajo que el menú y la
          pantalla se leía partida en dos.

          Y no lleva padding propio: la distancia al borde la pone el canal del
          armazón, igual que para el menú, el contenido y el pie. Cuando cada
          pieza traía el suyo, los iconos caían en un canal distinto al de los
          títulos y las tarjetas.
        */
        className="aq-cabecera relative flex items-center gap-1"
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

      {/*
        La barra inferior vive acá y no en el armazón porque «Más» tiene que
        abrir el cajón, y el estado del cajón es de este componente.
      */}
      <NavegacionInferior roles={roles} onAbrirCajon={() => setAbierto(true)} />

      <nav
        id={panelId}
        aria-label="Módulos"
        style={{ gridArea: 'menu' }}
        // `-translate-x-full` en vez de `hidden`: un elemento con `display:none`
        // no se puede animar, y el cajón entra deslizándose.
        // En teléfono es un cajón que ocupa el alto completo —por eso `fixed` y
        // `rounded-none`—; en escritorio, una tarjeta que flota sobre el agua
        // como las demás. Su separación del borde la pone el canal del armazón:
        // el `sm:m-3` que tenía acá era el valor correcto, pero solo suyo, y por
        // eso el contenido terminó al doble de distancia.
        /*
          `aq-menu-colapsado` solo hace efecto en escritorio: en teléfono el
          menú es un cajón que se desliza y no hay riel que colapsar.
        */
        className={`aq-panel-marca fixed inset-y-0 left-0 z-30 flex w-72 max-w-[85vw] flex-col rounded-none py-4 transition-transform duration-200 ease-out motion-reduce:transition-none sm:relative sm:w-auto sm:max-w-none sm:translate-x-0 sm:rounded-xl ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        } ${estadoDelMenu === 'colapsado' ? 'aq-menu-colapsado' : ''}`}
      >
        {/*
          La marca corona el panel, que es donde la pone el arte. En teléfono el
          cajón ya se abre desde la cabecera —que la muestra— así que acá sería
          la segunda vez en la misma pantalla.
        */}
        {/*
          La marca y el toggle comparten la fila: el botón vive junto a lo que
          colapsa. `min-w-0` deja que la marca se encoja en vez de empujar al
          botón fuera del riel.
        */}
        <div className="aq-menu-encabezado mb-1 hidden min-w-0 px-3 sm:block">
          {marcaDelPanel}
        </div>

        {/* Cerrar al navegar: tocar un módulo y que el cajón quede tapando la
            pantalla a la que acabás de llegar es la forma más rápida de que se
            sienta roto. */}
        <div onClick={() => setAbierto(false)} className="contents">
          {menu}
        </div>

        {/*
          Los créditos, solo en teléfono. Ahí abajo el pie lo ocupa la barra de
          navegación, así que este es el único lugar donde alguien puede ver de
          quién es el sistema. En escritorio el pie sigue existiendo y repetirlo
          acá sería decirlo dos veces en la misma pantalla.
        */}
        <div className="mt-auto">
          {/* Los créditos, solo en teléfono: ahí abajo el pie lo ocupa la barra
              de navegación. */}
          <div className="px-2 pt-4 sm:hidden">{creditos}</div>

          {/*
            El toggle vive ABAJO, y no arriba junto a la marca.

            Arriba tenía que compartir fila con el logo, y al colapsar los dos se
            repartían 48 px útiles: ninguno caía donde caen los iconos de módulo,
            y el orden de la columna se reacomodaba solo. Acá abajo tiene su
            propia fila, cae en el mismo eje que todo lo demás, y colapsar deja
            de mover nada de lugar.
          */}
          <div className="hidden px-3 pb-1 pt-2 sm:block">{toggleDelMenu}</div>
        </div>
      </nav>
    </>
  )
}
