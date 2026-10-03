import { Cifra } from '@/components/stock/cifra'
import type { Cobro } from '@/lib/api-types'
import { fechaYHoraEnLaPlanta } from '@/lib/hora-de-la-planta'

/**
 * Los abonos a la deuda de un cliente — RN-VEN-07.
 *
 * ── Vive en `components/ventas/` y se dibuja en la ficha del cliente ────────
 *
 * El cobro es del módulo de ventas —su tabla, su permiso `cobros:ver`— pero se
 * consulta donde alguien está mirando la cuenta. Es la misma repartición que ya
 * tiene `UltimasVentas`: la dueña del dato es ventas, la pantalla que la
 * muestra es la ficha.
 *
 * Sin `'use client'` a propósito: acá no hay interacción, y un componente que
 * solo pinta no tiene por qué viajar al navegador.
 */

const pesos = (monto: string | number) => `$${Number(monto).toLocaleString('es-CO')}`

/**
 * El libro de abonos de un cliente.
 *
 * ── Va al lado de la deuda, no en otra pantalla ─────────────────────────────
 *
 * «¿De dónde salen estos $80.000?» se contesta con las ventas; «¿pero no había
 * pagado?» se contesta con esto. Es la primera pregunta cuando alguien discute
 * su deuda, y la ficha ya recibe los abonos en la misma respuesta que la deuda
 * (`GET /clientes/:id/deuda` devuelve las dos cosas) — hasta ahora los recibía
 * y los descartaba sin dibujarlos.
 *
 * Del más nuevo al más viejo: lo ordena `api/`, no esta lista.
 */
export function ListaDeAbonos({ cobros }: { cobros: Cobro[] }) {
  if (cobros.length === 0) {
    return (
      <p className="text-[14px] text-tenue">
        Todavía no hay abonos. Si el cliente debe, es la deuda entera de sus compras a
        crédito.
      </p>
    )
  }

  return (
    <ul className="grid gap-2">
      {cobros.map((cobro) => (
        <li
          key={cobro.id}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-sutil p-3"
        >
          <Cifra tono="exito">{pesos(cobro.monto)}</Cifra>

          <span className="text-[14px] text-secundario">
            en {cobro.medioDePago === 'efectivo' ? 'efectivo' : 'transferencia'}
          </span>

          {/*
            La hora y no solo el día: dos abonos del mismo cliente en una misma
            jornada se distinguen por ahí cuando hay que cuadrar la caja.
          */}
          <span className="ml-auto text-[13px] text-tenue">
            {fechaYHoraEnLaPlanta(cobro.createdAt)}
          </span>

          {cobro.observaciones ? (
            <p className="w-full text-[13px] text-tenue">{cobro.observaciones}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
