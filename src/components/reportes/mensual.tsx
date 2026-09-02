import Link from 'next/link'
import type { Mes } from '@/lib/api-types'
import { NOMBRE } from './columnas'

/**
 * El resumen mensual — RN-CON-07.
 *
 * Una fila por mes. Responde «cómo viene el año», que el extracto no contesta
 * sin pedirlo doce veces y sumar a mano.
 *
 * Cada mes enlaza a su propio extracto: el resumen dice DÓNDE mirar y el
 * extracto dice QUÉ pasó. Sin ese enlace, encontrar el mes raro obliga a
 * volver arriba y tipear dos fechas.
 */
export function TablaMensual({ meses }: { meses: Mes[] }) {
  const tipos = ['venta', 'cobro', 'compra', 'devolucion', 'recargo'] as const

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-sutil text-left">
            <th className="aq-micro py-2 pr-4 text-tenue">Mes</th>
            {tipos.map((t) => (
              <th key={t} className="aq-micro py-2 pr-4 text-right text-tenue">
                {NOMBRE[t]}
              </th>
            ))}
            <th className="aq-micro py-2 pr-4 text-right text-tenue">Neto</th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => {
            const vacio = m.totales.entradas === '0.00' && m.totales.salidas === '0.00'

            return (
              <tr key={m.mes} className="border-b border-sutil/50">
                <td className="aq-cifra py-2 pr-4">
                  <Link
                    href={`/modulos/reportes?desde=${m.mes}-01&hasta=${finDeMes(m.mes)}`}
                    className="text-principal underline-offset-4 hover:underline"
                  >
                    {m.mes}
                  </Link>
                </td>

                {tipos.map((t) => (
                  <td
                    key={t}
                    className="aq-cifra py-2 pr-4 text-right text-secundario tabular-nums"
                  >
                    {m.porTipo[t]}
                  </td>
                ))}

                {/*
                  Un mes en cero se marca. En una planta que factura todos los
                  días no es un mes tranquilo: es un mes que nadie cargó, y esa
                  diferencia solo se ve si el reporte la señala.
                */}
                <td className="aq-cifra py-2 pr-4 text-right font-semibold tabular-nums">
                  {vacio ? (
                    <span className="text-alerta" title="Ningún movimiento registrado en el mes">
                      sin movimientos
                    </span>
                  ) : (
                    <span className="text-principal">{m.totales.neto}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** `2026-02` da `2026-02-28`, y en bisiesto da 29. */
function finDeMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number)
  const dia = new Date(Date.UTC(anio!, m!, 0)).getUTCDate()
  return `${mes}-${String(dia).padStart(2, '0')}`
}
