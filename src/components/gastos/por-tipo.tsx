import type { GastoPorTipo } from '@/lib/api-types'
import { ETIQUETA_DE_EGRESO } from '@/lib/gastos'
import { aCentavos, aMonto, pesos } from '@/lib/plata'

/**
 * En qué se gastó la plata del mes.
 *
 * ── Barras de una sola tinta, no una por categoría ──────────────────────────
 *
 * La tentación es pintar cada tipo de un color. No se puede: la marca tiene dos
 * cupos de serie —acento y éxito están a ΔE 7,8 con visión plena, y con
 * deficiencia de color se vuelven el mismo—, y catorce tipos necesitarían
 * catorce tintas distinguibles que esta paleta no tiene.
 *
 * El largo de la barra ya codifica la magnitud, y está ordenada de mayor a
 * menor. El color no agregaría información: agregaría catorce decisiones que se
 * ven distintas en una pantalla al sol.
 */
export function PorTipo({ gastos }: { gastos: GastoPorTipo[] }) {
  if (gastos.length === 0) {
    return (
      <p className="text-[14px] text-tenue">
        Todavía no hay gastos registrados en este mes.
      </p>
    )
  }

  const totalCentavos = gastos.reduce((t, g) => t + aCentavos(g.total), 0)
  const mayor = aCentavos(gastos[0]!.total)

  return (
    <div className="grid gap-3">
      <p className="aq-cifra text-xl font-semibold text-principal">
        {pesos(aMonto(totalCentavos))}
        <span className="aq-micro ml-2 font-normal text-tenue">en total</span>
      </p>

      <ul className="grid gap-2">
        {gastos.map((g) => {
          const centavos = aCentavos(g.total)

          return (
            <li key={g.tipoDeEgreso} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="text-secundario">
                  {ETIQUETA_DE_EGRESO[g.tipoDeEgreso]}
                  {/*
                    Cuántos movimientos, porque un total alto puede ser un pago
                    grande o veinte chicos, y eso cambia qué hacer con el dato.
                  */}
                  <span className="aq-micro ml-2 text-tenue">
                    {g.cuantos === 1 ? '1 pago' : `${g.cuantos} pagos`}
                  </span>
                </span>
                <span className="aq-cifra font-medium text-principal">{pesos(g.total)}</span>
              </div>

              {/*
                La barra es proporcional al MAYOR, no al total: con catorce tipos
                donde el primero es el 30 %, todas las barras quedarían cortas y
                la comparación entre ellas —que es para lo que sirven— se
                perdería.
              */}
              <div
                className="h-1.5 overflow-hidden rounded-full bg-sutil"
                role="presentation"
              >
                <div
                  className="h-full rounded-full bg-acento"
                  style={{ width: `${mayor === 0 ? 0 : (centavos / mayor) * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
