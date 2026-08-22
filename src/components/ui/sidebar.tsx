import Link from 'next/link'
import { CerrarSesion } from '@/components/ui/cerrar-sesion'
import { SelectorTema } from '@/components/ui/selector-tema'
import { computeVisibleModules } from '@/lib/modules'
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
    <aside className="flex w-64 shrink-0 flex-col border-r border-sutil p-4">
      <h2 className="mb-4 text-lg font-semibold tracking-tight">Aquazaku</h2>

      {/* El aria-label distingue este nav de cualquier otro que aparezca
          después (breadcrumbs, paginación) y lo hace direccionable en tests. */}
      <nav aria-label="Módulos" className="flex flex-col gap-1">
        {modules.map((modulo) => (
          <Link
            key={modulo.id}
            href={modulo.href}
            className="rounded p-2 text-sm hover:bg-accion"
          >
            {modulo.label}
          </Link>
        ))}
      </nav>

      {/* `mt-auto` empuja lo de abajo al pie sin que el nav tenga que crecer. */}
      <div className="mt-auto grid gap-4 pt-4">
        <SelectorTema actual={tema} />
        <CerrarSesion nombre={userName} />
      </div>
    </aside>
  )
}
