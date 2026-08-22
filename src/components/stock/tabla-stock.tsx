import { Package } from 'lucide-react'
import Link from 'next/link'
import { ICONO_DE_ESTADO } from '@/components/ui/estado'
import type { ResumenDeStock } from '@/lib/api-types'
import { Cifra } from './cifra'

/** El mismo icono que usa la insignia de «vencido». Una sola fuente. */
const IconoVencido = ICONO_DE_ESTADO.expuesto

/**
 * Cuánto hay de cada producto.
 *
 * Tres cifras por fila, y la de vencido **solo aparece cuando hay algo
 * vencido**: una columna con ceros en todas las filas entrena a no mirarla, y
 * el día que tenga un número deja de verse.
 */
export function TablaDeStock({ productos }: { productos: ResumenDeStock[] }) {
  const hayVencido = productos.some((p) => p.vencido > 0)

  return (
    <div className="overflow-x-auto rounded-lg border border-sutil bg-tarjeta">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-sutil">
          <tr className="text-secundario">
            <th className="aq-micro px-4 py-3 font-semibold">Producto</th>
            <th className="aq-micro px-4 py-3 text-right font-semibold">Se puede vender</th>
            {hayVencido ? (
              <th className="aq-micro px-4 py-3 text-right font-semibold">Vencido</th>
            ) : null}
            <th className="aq-micro px-4 py-3 text-right font-semibold">Total</th>
            <th className="aq-micro px-4 py-3 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {productos.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center text-secundario">
                No hay productos en el catálogo todavía.
              </td>
            </tr>
          ) : (
            productos.map((p) => (
              <tr key={p.productoId} className="border-t border-sutil">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Package aria-hidden className="size-5 shrink-0 text-secundario" />
                    <div>
                      <div className="font-medium text-principal">{p.nombre}</div>
                      <Cifra tono="secundario">{p.codigo}</Cifra>
                      {!p.activo ? (
                        <span className="ml-2 text-[13px] text-tenue">desactivado</span>
                      ) : null}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-right">
                  <Cifra tamano="grande" tono={p.vendible === 0 ? 'secundario' : 'principal'}>
                    {p.vendible}
                  </Cifra>
                </td>

                {hayVencido ? (
                  <td className="px-4 py-3 text-right">
                    {p.vencido > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        {/*
                          El icono sale de `ICONO_DE_ESTADO`, no escrito acá.
                          Antes esta celda usaba un triángulo de alerta mientras
                          la insignia de la pantalla de lotes usaba una equis
                          para lo mismo — dos iconos para «vencido».
                        */}
                        <IconoVencido aria-hidden className="size-4 text-error" />
                        <Cifra tono="alerta">{p.vencido}</Cifra>
                      </span>
                    ) : (
                      <span className="text-tenue">—</span>
                    )}
                  </td>
                ) : null}

                <td className="px-4 py-3 text-right">
                  <Cifra tono="secundario">{p.total}</Cifra>
                </td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/modulos/stock/${p.productoId}`}
                    // `inline-flex` + `min-h-11`: es una acción suelta en la
                    // fila, no un enlace dentro de una oración, así que lleva el
                    // objetivo táctil mínimo del sistema (R54). Medía 19 px.
                    className="inline-flex min-h-11 items-center rounded-sm text-[14px] font-medium text-accion underline-offset-4 hover:underline"
                  >
                    Ver lotes
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
