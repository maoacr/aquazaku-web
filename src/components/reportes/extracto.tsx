import { AlertTriangle, CalendarSearch } from 'lucide-react'
import { Cifra } from '@/components/stock/cifra'
import { Vacio } from '@/components/ui/vacio'
import type { Extracto, MovimientoDePlata } from '@/lib/api-types'
import { type Columna, columnasVisibles } from './columnas'

/**
 * El extracto de movimientos — RN-CON-03, 04 y 06.
 *
 * Los cinco movimientos de plata en una sola tabla. Quien concilia un mes
 * necesita ver el movimiento completo; cinco listas separadas lo obligan a
 * reconstruirlo a mano, que es lo que hace hoy.
 */

export function TablaDeExtracto({
  extracto,
  columnas,
}: {
  extracto: Extracto
  /** Lo que el contador eligió llevarse. Sin nada elegido, las de siempre. */
  columnas?: string
}) {
  if (extracto.movimientos.length === 0) {
    return (
      <Vacio
        variante="sin-resultados"
        icono={CalendarSearch}
        titulo="No hubo movimientos en ese rango"
        hrefSinFiltros="/modulos/reportes"
      >
        Pruebe con otras fechas, o quite el filtro de tipo.
      </Vacio>
    )
  }

  const visibles = columnasVisibles(columnas)

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-sutil text-left">
            {visibles.map((c) => (
              <th
                key={c.clave}
                className={`aq-micro py-2 pr-4 text-tenue ${c.numerica ? 'text-right' : ''}`}
              >
                {c.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {extracto.movimientos.map((m) => (
            <Fila key={`${m.tipo}-${m.documentoId}`} movimiento={m} columnas={visibles} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Fila({ movimiento: m, columnas }: { movimiento: MovimientoDePlata; columnas: Columna[] }) {
  return (
    <tr className="border-b border-sutil/50">
      {columnas.map((c) => (
        <td
          key={c.clave}
          className={
            c.numerica
              ? `aq-cifra py-2 pr-4 text-right tabular-nums ${
                  m.signo === 1 ? 'text-principal' : 'text-alerta'
                }`
              : 'py-2 pr-4 text-secundario'
          }
        >
          {/* El menos tipográfico solo en pantalla: en el CSV va el guion ASCII,
              que es lo único que una hoja de cálculo lee como número negativo. */}
          {c.numerica ? c.valor(m).replace('-', '\u2212') : c.valor(m)}
        </td>
      ))}
    </tr>
  )
}

/**
 * Los totales — RN-CON-03.
 *
 * ── El cuadre se muestra, no se asume ──────────────────────────────────────
 *
 * Las entradas se descomponen por medio de pago y la suma se verifica. Si no
 * cierra, el reporte **lo dice en la cara** en vez de mostrar un número que
 * parece bien.
 *
 * Es el mismo criterio que la ley de conservación de botellones: un descuadre
 * que nadie ve se descubre meses después, cuando ya no se puede reconstruir.
 */
export function Totales({ extracto }: { extracto: Extracto }) {
  const { totales } = extracto

  return (
    <div className="grid gap-4">
      {totales.cuadra ? null : (
        <div className="flex items-start gap-3 rounded-lg border border-alerta/40 bg-alerta/5 p-4">
          <AlertTriangle aria-hidden className="size-5 shrink-0 text-alerta" />
          <div>
            <p className="text-[15px] font-semibold text-principal">
              Las entradas no cuadran con su descomposición
            </p>
            <p className="mt-1 text-[13px] text-secundario">
              El total no coincide con la suma por medio de pago. Hay un movimiento que entra
              plata sin decir cómo — conviene revisarlo antes de usar este reporte.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta titulo="Entró" monto={totales.entradas} />
        <Tarjeta titulo="Salió" monto={totales.salidas} />
        <Tarjeta titulo="Neto" monto={totales.neto} destacado />
      </div>

      <div className="aq-tarjeta grid gap-2 p-4">
        <p className="aq-micro text-tenue">Las entradas, por medio de pago</p>
        <dl className="grid gap-1 sm:grid-cols-3">
          <Renglon etiqueta="Efectivo" monto={totales.porMedioDePago.efectivo} />
          <Renglon etiqueta="Transferencia" monto={totales.porMedioDePago.transferencia} />
          {/*
            El crédito entra acá porque la VENTA a crédito es un ingreso del día
            que se vendió. El cobro es otro movimiento, otro día — RN-CON-04.
          */}
          <Renglon etiqueta="Crédito" monto={totales.porMedioDePago.credito} />
        </dl>
      </div>
    </div>
  )
}

function Tarjeta({
  titulo,
  monto,
  destacado,
}: {
  titulo: string
  monto: string
  destacado?: boolean
}) {
  return (
    <div className="aq-tarjeta grid gap-1 p-4">
      <p className="aq-micro text-tenue">{titulo}</p>
      <Cifra tamano={destacado ? 'grande' : 'cuerpo'}>${monto}</Cifra>
    </div>
  )
}

function Renglon({ etiqueta, monto }: { etiqueta: string; monto: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <dt className="text-[13px] text-tenue">{etiqueta}</dt>
      <dd className="aq-cifra text-[15px] text-principal tabular-nums">${monto}</dd>
    </div>
  )
}
