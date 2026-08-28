import { PackageX } from 'lucide-react'
import type { DisponibilidadDeBases } from '@/lib/api-types'

/**
 * Hay que comprar bases — RN-BAS-13.
 *
 * ── Por qué no avisa en cero ────────────────────────────────────────────────
 *
 * Un pedido de bases tarda 7 días en llegar. Avisar cuando quedan cero es
 * avisar tarde por diseño: para entonces ya se le dijo que no a un cliente y
 * todavía falta una semana.
 *
 * Eso separa a las bases del agua, donde `AvisoDeStock` sí dispara en cero:
 * el agua la produce la planta mañana.
 *
 * ── El aviso muestra su propio razonamiento ─────────────────────────────────
 *
 * No dice «hay que comprar» a secas: dice cuántas quedan y a qué ritmo se van.
 * Quien lo lee tiene que decidir CUÁNTAS pedir, y sin esos dos números tendría
 * que ir a buscarlos a otra pantalla antes de poder hacerlo.
 *
 * Y si alcanzan, no hay cartel. El sistema no felicita.
 */
export function AvisoDeBases({
  disponibilidad,
  hayBases,
}: {
  disponibilidad: DisponibilidadDeBases | null
  hayBases: boolean
}) {
  /*
   * Con el parque vacío no hay nada que avisar: el estado vacío de la lista ya
   * dice que no hay bases, y dos carteles diciendo lo mismo en la primera
   * pantalla que alguien abre enseñan a ignorarlos.
   */
  if (!disponibilidad || disponibilidad.alcanza || !hayBases) return null

  const { libres, prestadasEnLaVentana, diasDeEntrega } = disponibilidad

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-alerta/40 bg-alerta/5 p-4"
    >
      <PackageX aria-hidden className="size-5 shrink-0 text-alerta" />
      <div className="grid gap-1">
        <p className="text-[15px] font-semibold text-principal">
          {libres === 0
            ? 'No quedan bases para prestar'
            : libres === 1
              ? 'Queda 1 base para prestar'
              : `Quedan ${libres} bases para prestar`}
        </p>
        <p className="text-[13px] text-secundario">
          {prestadasEnLaVentana > 0
            ? `En los últimos ${diasDeEntrega} días se prestaron ${prestadasEnLaVentana}. Un pedido tarda ${diasDeEntrega} días en llegar, así que conviene hacerlo ahora.`
            : `Un pedido tarda ${diasDeEntrega} días en llegar. Conviene hacerlo antes de que alguien las pida.`}
        </p>
      </div>
    </div>
  )
}
