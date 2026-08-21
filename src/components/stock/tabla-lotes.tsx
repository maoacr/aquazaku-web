import { Boxes } from 'lucide-react'
import type { LoteConSaldo } from '@/lib/api-types'
import { Cifra } from './cifra'

/**
 * Los lotes de un producto, del más próximo a vencer.
 *
 * Ese orden ES el FIFO: no es una preferencia de presentación, es la regla
 * hecha lista. El primero de la tabla es el que va a salir en la próxima venta.
 */
export function TablaDeLotes({ lotes, hoy }: { lotes: LoteConSaldo[]; hoy: string }) {
  if (lotes.length === 0) {
    return (
      <p className="rounded-lg border border-sutil bg-tarjeta px-4 py-12 text-center text-secundario">
        Este producto no tiene lotes con unidades.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-sutil bg-tarjeta shadow-elev-1">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-sutil">
          <tr className="text-secundario">
            <th className="aq-micro px-4 py-3 font-semibold">Lote</th>
            <th className="aq-micro px-4 py-3 font-semibold">Empacado</th>
            <th className="aq-micro px-4 py-3 font-semibold">Vence</th>
            <th className="aq-micro px-4 py-3 text-right font-semibold">Unidades</th>
          </tr>
        </thead>
        <tbody>
          {lotes.map((lote, indice) => {
            const vencido = lote.fechaVencimiento < hoy

            return (
              <tr key={lote.id} className="border-t border-sutil">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Boxes aria-hidden className="size-5 shrink-0 text-secundario" />
                    <Cifra>{lote.codigo}</Cifra>
                    {/* El primero vigente es el que sale en la próxima venta. */}
                    {indice === 0 && !vencido ? (
                      <span className="aq-micro rounded-sm bg-accion/10 px-1.5 py-0.5 text-accion">
                        sale primero
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Cifra tono="secundario">{lote.fechaEmpaque}</Cifra>
                </td>
                <td className="px-4 py-3">
                  {vencido ? (
                    <span className="inline-flex items-center gap-2">
                      <Cifra tono="alerta">{lote.fechaVencimiento}</Cifra>
                      <span className="aq-micro rounded-sm border border-alerta-borde bg-alerta-fondo px-1.5 py-0.5 text-alerta-texto">
                        vencido
                      </span>
                    </span>
                  ) : (
                    <Cifra tono="secundario">{lote.fechaVencimiento}</Cifra>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Cifra tamano="grande" tono={vencido ? 'alerta' : 'principal'}>
                    {lote.saldo}
                  </Cifra>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
