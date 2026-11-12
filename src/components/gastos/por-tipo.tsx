import { BarrasHorizontales } from '@/components/graficos/barras-horizontales'
import type { GastoPorTipo } from '@/lib/api-types'
import { ETIQUETA_DE_EGRESO } from '@/lib/gastos'
import { aCentavos, aMonto, pesos } from '@/lib/plata'

/**
 * En qué se fue la plata del mes — M17.
 *
 * ── Usa `BarrasHorizontales`, no barras propias ─────────────────────────────
 *
 * La primera versión dibujaba su propio carril con un `div` y un `width` en
 * porcentaje. Los anchos salían bien —100 %, 42 %, 23 %— pero las barras eran
 * INVISIBLES: pintaban con `bg-acento`, que no existe como utilidad en este
 * proyecto, así que el color computado era `rgba(0,0,0,0)`. Se veía el carril
 * de fondo y nada más, y «Arriendo $1.800.000» y «Gas $66.200» quedaban
 * idénticos.
 *
 * Nada falló: typecheck, lint y la suite pasaron. Una clase de Tailwind que no
 * existe no es un error de tipos, y jsdom no calcula color. Lo destapó mirar la
 * pantalla y medir el `backgroundColor` computado.
 *
 * El componente que ya existía resuelve eso y más: pinta con `bg-agua/30`, usa
 * el MÁXIMO como techo —misma decisión que había tomado yo, pero escrita antes
 * y explicada— y trae el argumento de por qué el color no codifica categoría.
 */
export function PorTipo({ gastos }: { gastos: GastoPorTipo[] }) {
  if (gastos.length === 0) {
    return <p className="text-[14px] text-tenue">Todavía no hay gastos registrados en este mes.</p>
  }

  const totalCentavos = gastos.reduce((t, g) => t + aCentavos(g.total), 0)

  return (
    <div className="grid gap-3">
      <p className="aq-cifra text-xl font-semibold text-principal">
        {pesos(aMonto(totalCentavos))}
        <span className="aq-micro ml-2 font-normal text-tenue">en total</span>
      </p>

      <BarrasHorizontales
        filas={gastos.map((g) => ({
          etiqueta: ETIQUETA_DE_EGRESO[g.tipoDeEgreso],
          /* En centavos, que es como se compara sin perder plata. */
          valor: aCentavos(g.total),
          texto: pesos(g.total),
          /*
           * Cuántos pagos, porque un total alto puede ser un pago grande o
           * veinte chicos, y eso cambia qué hacer con el dato.
           */
          chip: { texto: g.cuantos === 1 ? '1 pago' : `${g.cuantos} pagos`, tono: 'neutro' },
        }))}
      />
    </div>
  )
}
