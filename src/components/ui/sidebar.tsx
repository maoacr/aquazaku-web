import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { CerrarSesion } from '@/components/ui/cerrar-sesion'
import { SelectorTema } from '@/components/ui/selector-tema'
import { computeVisibleModules, type MenuModule } from '@/lib/modules'
import type { Role } from '@/lib/roles'
import type { Tema } from '@/lib/tema'

/**
 * Menú lateral de la app autenticada.
 *
 * Recibe los roles ya resueltos en vez de ir a buscarlos: la sesión se consulta
 * UNA vez en el layout, y el sidebar es una función pura de esos roles. Así se
 * puede probar sin levantar api/.
 *
 * Recordá que esto es cosmética (RN-ACC-02): esconder un link no protege nada.
 * La barrera real la pone `requirePermission()` en cada endpoint de api/.
 *
 * ── Dos instancias, no una que se transforma ────────────────────────────────
 *
 * En un teléfono el menú es un cajón que se abre; en escritorio es una columna
 * fija. El primer intento fue un solo `<details>` con CSS que lo mostrara
 * siempre en pantalla ancha, y **no funcionó**: el navegador esconde el
 * contenido de un `<details>` cerrado y ni `display` ni `content-visibility`
 * lo revierten de forma confiable. En escritorio el menú reservaba su espacio
 * y no pintaba nada.
 *
 * Se descubrió mirándolo, no testeándolo: `checkVisibility()` devolvía `false`
 * incluso con el panel abierto y midiendo 256 px. La captura de pantalla fue lo
 * único que dijo la verdad.
 *
 * Ahora son dos instancias con el mismo componente adentro, y cuál se muestra
 * lo decide `display` — que sí es determinista. La que está oculta sale del
 * árbol de accesibilidad, así que un lector de pantalla ve un solo menú.
 */
export function Sidebar({
  userRoles,
  userName,
  tema,
}: {
  userRoles: Role[]
  userName: string
  tema: Tema
}) {
  const modules = computeVisibleModules(userRoles)

  return (
    <>
      {/* Teléfono: cajón. `<details>` trae gratis el teclado, el anuncio a
          lectores de pantalla y el cierre con Escape. */}
      <details className="group shrink-0 sm:hidden" data-testid="menu-lateral">
        <summary
          // 44 px: objetivo táctil mínimo del sistema de diseño.
          className="absolute left-4 top-4 z-30 flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-md border border-sutil bg-tarjeta text-principal [&::-webkit-details-marker]:hidden"
          aria-label="Abrir el menú"
        >
          <Menu aria-hidden className="size-5 group-open:hidden" />
          <X aria-hidden className="hidden size-5 group-open:block" />
        </summary>

        <aside
          data-testid="menu-mobile"
          className="absolute inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-sutil bg-tarjeta p-4 shadow-elev-3"
        >
          <ContenidoDelMenu modules={modules} userName={userName} tema={tema} />
        </aside>
      </details>

      {/* Escritorio: columna fija. `hidden` la saca del árbol en mobile. */}
      <aside
        data-testid="menu-escritorio"
        className="hidden w-64 shrink-0 flex-col border-r border-sutil bg-tarjeta p-4 sm:flex"
      >
        <ContenidoDelMenu modules={modules} userName={userName} tema={tema} />
      </aside>
    </>
  )
}

function ContenidoDelMenu({
  modules,
  userName,
  tema,
}: {
  modules: MenuModule[]
  userName: string
  tema: Tema
}) {
  return (
    <>
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-principal">Aquazaku</h2>

      {/* El aria-label distingue este nav de cualquier otro que aparezca
          después (breadcrumbs, paginación) y lo hace direccionable en tests. */}
      <nav aria-label="Módulos" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {modules.map((modulo) => (
          <Link
            key={modulo.id}
            href={modulo.href}
            // El par fondo/texto va junto: cambiar el fondo sin cambiar el
            // texto es como nace un contraste ilegible.
            className="flex min-h-11 items-center rounded-md px-3 text-[14px] text-principal hover:bg-accion hover:text-invertido"
          >
            {modulo.label}
          </Link>
        ))}
      </nav>

      {/* `shrink-0` para que el pie no se comprima cuando el nav es largo: era
          justo lo que pasaba en Auditoría, donde quedaba fuera de la pantalla. */}
      <div className="mt-4 grid shrink-0 gap-4 border-t border-sutil pt-4">
        <SelectorTema actual={tema} />
        <CerrarSesion nombre={userName} />
      </div>
    </>
  )
}
