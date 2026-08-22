import { Monitor, Moon, Sun } from 'lucide-react'
import { cambiarTemaAction } from '@/app/actions-tema'
import type { Tema } from '@/lib/tema'

const OPCIONES: { valor: Tema; etiqueta: string; Icono: typeof Sun }[] = [
  { valor: 'claro', etiqueta: 'Claro', Icono: Sun },
  { valor: 'oscuro', etiqueta: 'Oscuro', Icono: Moon },
  { valor: 'sistema', etiqueta: 'Sistema', Icono: Monitor },
]

/**
 * Selector de tema.
 *
 * Es un formulario con Server Action, no un botón con `onClick`: el tema vive
 * en una cookie que lee el servidor, así que cambiarlo **es** una petición.
 * Resolverlo en el cliente devolvería el destello que la cookie evita.
 *
 * Sin `'use client'` — no hay estado ni interacción que necesite JavaScript.
 * Tres botones que envían un formulario funcionan igual con JS deshabilitado.
 *
 * Las tres opciones se muestran siempre, con la activa marcada. Un botón que
 * cicla entre temas obliga a adivinar cuál viene después y a pasar por el que
 * no se quiere.
 */
export function SelectorTema({ actual }: { actual: Tema }) {
  return (
    <form action={cambiarTemaAction}>
      <fieldset className="grid gap-1.5">
        <legend className="aq-micro mb-1.5 text-secundario">Tema</legend>

        <div className="flex gap-1 rounded-md border border-sutil bg-tarjeta p-1">
          {OPCIONES.map(({ valor, etiqueta, Icono }) => {
            const activo = valor === actual

            return (
              <button
                key={valor}
                type="submit"
                name="tema"
                value={valor}
                aria-pressed={activo}
                title={etiqueta}
                // 44px de alto: objetivo táctil mínimo del sistema de diseño.
                className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-sm text-[13px] font-medium transition-colors ${
                  activo
                    ? 'bg-accion text-invertido'
                    : 'text-secundario hover:bg-fondo hover:text-principal'
                }`}
              >
                <Icono aria-hidden className="size-4 shrink-0" />
                {/* La etiqueta se muestra siempre. Tres iconos sin texto —sol, luna,
                    monitor— obligan a adivinar cuál es cuál, y en el cajón de
                    288 px o en la columna de 256 px sobra lugar para decirlo. */}
                <span>{etiqueta}</span>
              </button>
            )
          })}
        </div>
      </fieldset>
    </form>
  )
}
