import { Boxes } from 'lucide-react'
import { Estado, TEXTO_DE_VENCIMIENTO, estadoDeVencimiento } from '@/components/ui/estado'
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
      <p className="aq-tarjeta px-4 py-12 text-center text-secundario">
        Este producto no tiene lotes con unidades.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto aq-tarjeta">
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
            const estado = estadoDeVencimiento(lote.fechaVencimiento, hoy)
            const vencido = estado === 'expuesto'

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
                {/*
                  Los tres estados llevan insignia, no solo el vencido. Antes
                  «sin insignia» significaba vigente, y eso obliga a deducir por
                  ausencia: quien mira rápido no distingue «está bien» de «no
                  se calculó». Decirlo siempre cuesta una línea y se lee de un
                  vistazo.
                */}
                <td className="px-4 py-3">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Cifra tono={vencido ? 'alerta' : 'secundario'}>
                      {lote.fechaVencimiento}
                    </Cifra>
                    <Estado tono={estado}>{TEXTO_DE_VENCIMIENTO[estado]}</Estado>
                  </span>
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
