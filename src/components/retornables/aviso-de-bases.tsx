import { PackageX } from 'lucide-react'
import type { DisponibilidadDeBases, TipoDeBase } from '@/lib/api-types'

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
 *
 * ── Un aviso POR TIPO — RN-BAS-14 ───────────────────────────────────────────
 *
 * Desde que existe el dispensador, `api` manda una entrada por tipo y acá se
 * dibuja un cartel por cada una que no alcance. Un solo cartel sumando los dos
 * parques haría que veinte estructuras libres tapen que no queda ningún
 * dispensador — el aviso callaría justo cuando hace falta.
 *
 * Y cada cartel **nombra el tipo**: sin eso el número no alcanza para pedir,
 * porque no se le compra lo mismo a la misma persona.
 */
const NOMBRE: Record<TipoDeBase, { singular: string; plural: string }> = {
  estructura: { singular: 'estructura', plural: 'estructuras' },
  dispensador: { singular: 'dispensador', plural: 'dispensadores' },
}

export function AvisoDeBases({
  disponibilidad,
  hayBases,
}: {
  disponibilidad: DisponibilidadDeBases[]
  hayBases: boolean
}) {
  /*
   * Con el parque vacío no hay nada que avisar: el estado vacío de la lista ya
   * dice que no hay bases, y dos carteles diciendo lo mismo en la primera
   * pantalla que alguien abre enseñan a ignorarlos.
   */
  if (!hayBases) return null

  const faltantes = disponibilidad.filter((d) => !d.alcanza)

  if (faltantes.length === 0) return null

  return (
    <div className="grid gap-3">
      {faltantes.map((d) => (
        <AvisoDeUnTipo key={d.tipo} disponibilidad={d} />
      ))}
    </div>
  )
}

function AvisoDeUnTipo({ disponibilidad }: { disponibilidad: DisponibilidadDeBases }) {
  const { tipo, libres, prestadasEnLaVentana, diasDeEntrega } = disponibilidad
  const { singular, plural } = NOMBRE[tipo]

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-alerta/40 bg-alerta/5 p-4"
    >
      <PackageX aria-hidden className="size-5 shrink-0 text-alerta" />
      <div className="grid gap-1">
        <p className="text-[15px] font-semibold text-principal">
          {libres === 0
            ? `No queda ningún ${singular} para prestar`
            : libres === 1
              ? `Queda 1 ${singular} para prestar`
              : `Quedan ${libres} ${plural} para prestar`}
        </p>
        <p className="text-[13px] text-secundario">
          {prestadasEnLaVentana > 0
            ? `En los últimos ${diasDeEntrega} días se prestaron ${prestadasEnLaVentana}. Un pedido tarda ${diasDeEntrega} días en llegar, así que conviene hacerlo ahora.`
            : `Un pedido tarda ${diasDeEntrega} días en llegar. Conviene hacerlo antes de que alguien lo pida.`}
        </p>
      </div>
    </div>
  )
}
