import { HandCoins } from 'lucide-react'
import { Vacio } from '@/components/ui/vacio'
import type { CarteraDeCliente } from '@/lib/api-types'

/**
 * Cartera por edad — RN-CON-05.
 *
 * ── Los tramos salen de los datos, no de una lista escrita acá ─────────────
 *
 * Se leen de la primera fila. El servidor los decide —viven en una constante
 * suya— y esta tabla los sigue. Copiarlos acá haría que el día que el contador
 * pida otros, la pantalla siguiera mostrando los viejos con datos nuevos
 * adentro: el peor descuadre posible, porque parece correcto.
 */
export function TablaDeCartera({ cartera }: { cartera: CarteraDeCliente[] }) {
  if (cartera.length === 0) {
    return (
      <Vacio variante="terminado" icono={HandCoins} titulo="Nadie debe nada">
        Cuando alguien compre a crédito y no haya pagado, va a aparecer acá ordenado por cuánto
        debe.
      </Vacio>
    )
  }

  const tramos = Object.keys(cartera[0]!.tramos)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-sutil text-left">
            <th className="aq-micro py-2 pr-4 text-tenue">Cliente</th>
            {tramos.map((t) => (
              <th key={t} className="aq-micro py-2 pr-4 text-right text-tenue">
                {t === '90+' ? 'Más de 90' : `${t} días`}
              </th>
            ))}
            <th className="aq-micro py-2 pr-4 text-right text-tenue">Total</th>
          </tr>
        </thead>
        <tbody>
          {cartera.map((c) => (
            <tr key={c.clienteId} className="border-b border-sutil/50">
              <td className="py-2 pr-4 text-principal">
                {c.cliente}
                <span className="block aq-cifra text-[13px] text-tenue">{c.documento}</span>
              </td>
              {tramos.map((t) => (
                <td key={t} className="aq-cifra py-2 pr-4 text-right tabular-nums text-secundario">
                  {/*
                    Un cero se pinta tenue: la fila importa por dónde SÍ hay
                    plata, y cuatro ceros con el mismo peso que el número que
                    importa obligan a buscarlo con los ojos.
                  */}
                  <span className={c.tramos[t] === '0.00' ? 'text-tenue/50' : undefined}>
                    ${c.tramos[t]}
                  </span>
                </td>
              ))}
              <td className="aq-cifra py-2 pr-4 text-right font-semibold tabular-nums text-principal">
                ${c.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
