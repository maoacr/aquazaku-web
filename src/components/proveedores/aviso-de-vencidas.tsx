import { CalendarClock } from 'lucide-react'
import type { CompraVencida } from '@/lib/api-types'

/**
 * Compras a crédito que ya pasaron su fecha — RN-PRO-07.
 *
 * ── Este aviso no necesita umbral, y ahí está la diferencia ─────────────────
 *
 * El aviso de bases tuvo que DERIVAR el suyo —cuántas se prestan mientras llega
 * el pedido— porque nadie sabía cuál era el mínimo. Acá el dato ya es una
 * fecha: o pasó o no pasó. No hay nada que estimar ni que configurar.
 *
 * ── Y hoy no debería aparecer nunca ────────────────────────────────────────
 *
 * Aquazaku paga todo de contado o por transferencia, y lo de contado nace
 * pagado. Si este cartel aparece, es porque alguien registró una compra a
 * crédito — que es exactamente cuando hace falta verlo.
 *
 * Si no hay nada vencido, no hay cartel. El sistema no felicita.
 */
export function AvisoDeVencidas({ vencidas }: { vencidas: CompraVencida[] }) {
  if (vencidas.length === 0) return null

  return (
    <div
      role="status"
      className="grid gap-3 rounded-lg border border-alerta/40 bg-alerta/5 p-4"
    >
      <div className="flex items-start gap-3">
        <CalendarClock aria-hidden className="size-5 shrink-0 text-alerta" />
        <p className="text-[15px] font-semibold text-principal">
          {vencidas.length === 1
            ? 'Hay una compra vencida sin pagar'
            : `Hay ${vencidas.length} compras vencidas sin pagar`}
        </p>
      </div>

      {/*
        Cada una con su proveedor, su monto y CUÁNTOS días lleva. El número de
        días es lo que ordena la urgencia: no es lo mismo un día que treinta, y
        sin ese dato hay que ir a mirar fecha por fecha.
      */}
      <ul className="grid gap-1 pl-8">
        {vencidas.map((c) => (
          <li key={c.id} className="text-[14px] text-secundario">
            <span className="text-principal">{c.proveedor}</span> — ${c.total}, vencida hace{' '}
            {c.diasDeAtraso === 1 ? 'un día' : `${c.diasDeAtraso} días`}
          </li>
        ))}
      </ul>
    </div>
  )
}
