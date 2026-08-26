import { CalendarCheck } from 'lucide-react'
import { Cifra } from '@/components/stock/cifra'
import { Vacio } from '@/components/ui/vacio'
import type { CierreDeProduccion } from '@/lib/api-types'

/**
 * Los cierres registrados, del más nuevo al más viejo.
 *
 * ── No hay botón de editar, y es a propósito ────────────────────────────────
 *
 * Un cierre no se edita ni se borra (RN-PRD-08): mueve el agua, el stock y los
 * insumos de una vez, y cambiarlo dejaría los tres saldos sin explicación. Una
 * corrección es un ajuste posterior, con motivo y responsable.
 *
 * `api/` tampoco expone `PATCH` ni `DELETE` sobre un cierre — que esas rutas no
 * existan es parte del contrato, y hay tests que lo verifican. Acá la ausencia
 * del botón no es la barrera: es la coherencia.
 */
export function HistorialDeCierres({ cierres }: { cierres: CierreDeProduccion[] }) {
  if (cierres.length === 0) {
    return (
      <Vacio variante="primera-vez" icono={CalendarCheck} titulo="Todavía no hay cierres">
        Cada día de producción se cierra una vez. El cierre convierte los litros en
        producto: descuenta el agua, consume las tapas y genera los lotes.
      </Vacio>
    )
  }

  return (
    <ul className="grid gap-3">
      {cierres.map((cierre) => (
        <li key={cierre.id}>
          <FilaDeCierre cierre={cierre} />
        </li>
      ))}
    </ul>
  )
}

function FilaDeCierre({ cierre }: { cierre: CierreDeProduccion }) {
  const envasado =
    cierre.pacas600 + cierre.pacas300 + cierre.botellonesLlenados === 0
      ? 'No se envasó nada'
      : [
          cierre.pacas600 > 0 && `${cierre.pacas600} pacas de 600 ml`,
          cierre.pacas300 > 0 && `${cierre.pacas300} pacas de 300 ml`,
          cierre.botellonesLlenados > 0 && `${cierre.botellonesLlenados} botellones`,
        ]
          .filter(Boolean)
          .join(' · ')

  return (
    <article className="aq-tarjeta grid gap-3 p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <p className="aq-cifra text-[15px] font-medium text-principal">{cierre.fecha}</p>

      <div className="min-w-0">
        <p className="text-[14px] text-secundario">{envasado}</p>
        <p className="mt-0.5 text-[13px] text-tenue">
          {cierre.minutosProcesando} min procesando
          {cierre.botellonesLavados > 0 ? ` · ${cierre.botellonesLavados} lavados` : ''}
        </p>
      </div>

      <dl className="flex gap-5 sm:justify-end">
        <div>
          <dt className="aq-micro text-tenue">Consumió</dt>
          <dd>
            <Cifra tono="agua">{cierre.litrosConsumidos.toLocaleString('es-CO')}</Cifra>{' '}
            <span className="text-[13px] text-tenue">L</span>
          </dd>
        </div>
        <div>
          <dt className="aq-micro text-tenue">Procesó</dt>
          <dd>
            {cierre.litrosProcesados === null ? (
              // `null` no es cero: es que ese día no había caudal medido. Un
              // cero diría que no se procesó, que es otra cosa.
              <span className="text-[13px] text-tenue">sin caudal</span>
            ) : (
              <>
                <Cifra tono="agua">{cierre.litrosProcesados.toLocaleString('es-CO')}</Cifra>{' '}
                <span className="text-[13px] text-tenue">L</span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}
