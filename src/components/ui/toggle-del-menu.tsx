import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cambiarEstadoDelMenuAction } from '@/app/actions-menu'
import type { EstadoDelMenu } from '@/lib/menu'

/**
 * Colapsa el menú a un riel de iconos, o lo despliega.
 *
 * ── Por qué es un `<form>` y no un `onClick` ────────────────────────────────
 *
 * Igual que el toggle de tema: la preferencia va a una cookie por Server
 * Action, así que **funciona sin JavaScript**. Un control que solo anda con el
 * bundle cargado no anda mientras la página termina de cargar, que es
 * justamente cuando alguien lo va a tocar por impaciencia.
 *
 * Y persiste. Sin cookie, colapsarlo duraría hasta la próxima navegación y
 * habría que volver a hacerlo cada vez — que es peor que no tener la función.
 *
 * ── Solo escritorio ─────────────────────────────────────────────────────────
 *
 * En teléfono el menú es un cajón que se desliza: no hay riel que colapsar, y
 * un botón que no hace nada visible es un botón que confunde.
 */
export function ToggleDelMenu({ estado }: { estado: EstadoDelMenu }) {
  const colapsado = estado === 'colapsado'
  const siguiente: EstadoDelMenu = colapsado ? 'desplegado' : 'colapsado'
  const Icono = colapsado ? PanelLeftOpen : PanelLeftClose

  return (
    <form action={cambiarEstadoDelMenuAction} className="contents">
      <input type="hidden" name="menu" value={siguiente} />
      <button
        type="submit"
        /*
          `aria-expanded` es lo que ANUNCIA el estado. Sin él, quien navega con
          lector de pantalla oye «botón, contraer menú» y no tiene forma de saber
          si ya está contraído.
        */
        aria-expanded={!colapsado}
        aria-label={colapsado ? 'Desplegar el menú' : 'Contraer el menú'}
        title={colapsado ? 'Desplegar el menú' : 'Contraer el menú'}
        className="hidden size-11 shrink-0 items-center justify-center rounded-md text-secundario hover:bg-menu-realce hover:text-principal sm:flex"
      >
        <Icono aria-hidden className="size-4" />
      </button>
    </form>
  )
}
