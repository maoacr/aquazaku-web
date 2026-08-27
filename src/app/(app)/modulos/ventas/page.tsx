import { Receipt } from 'lucide-react'
import { Mostrador } from '@/components/ventas/mostrador'
import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { Vacio } from '@/components/ui/vacio'
import { apiServerFetch } from '@/lib/api-server'
import type { Cliente, Producto, ResumenDeStock, Venta } from '@/lib/api-types'

/**
 * Ventas — M6.
 *
 * ── Lo que se ve depende del rol, y lo decide `api/` ────────────────────────
 *
 * Un `pos` ve **sus** ventas; el `admin`, todas. Eso lo recorta `scopedCondition`
 * con la matriz (RN-ACC-03): esta página pide y muestra lo que llega. No hay una
 * copia de la regla acá.
 */
export default async function VentasPage() {
  const [productos, stock, clientes, ventas] = await Promise.all([
    apiServerFetch<Producto[]>('/productos'),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    apiServerFetch<Cliente[]>('/clientes'),
    apiServerFetch<Venta[]>('/ventas'),
  ])
  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Ventas</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Qué salió, a quién y cómo se pagó.
        </p>
      </header>

      <Mostrador
        productos={productos.filter((p) => p.activo)}
        stock={stock}
        clientes={clientes}
      />

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Últimas ventas</h2>
        <ListaDeVentas ventas={ventas} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>
    </div>
  )
}

const MEDIO: Record<Venta['medioDePago'], string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  credito: 'Crédito',
}

function ListaDeVentas({ ventas }: { ventas: Venta[] }) {
  if (ventas.length === 0) {
    return (
      <Vacio variante="primera-vez" icono={Receipt} titulo="Todavía no hay ventas">
        Cada venta descuenta el stock y —si es a crédito— suma a la deuda del cliente.
      </Vacio>
    )
  }

  return (
    <ul className="grid gap-3">
      {ventas.map((venta) => (
        <li key={venta.id}>
          <article className="aq-tarjeta grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-2">
                <Cifra tamano="grande" tono={venta.estado === 'anulada' ? 'secundario' : 'principal'}>
                  ${Number(venta.total).toLocaleString('es-CO')}
                </Cifra>
                <span className="text-[13px] text-tenue">{MEDIO[venta.medioDePago]}</span>
              </p>

              <p className="mt-0.5 text-[13px] text-tenue">
                {new Date(venta.createdAt).toLocaleString('es-CO')}
                {venta.requiereFacturaElectronica ? ' · pidió factura' : ''}
              </p>

              {/*
                Una venta anulada NO desaparece: cambia de estado y muestra por
                qué. Esconderla sería reescribir el día.
              */}
              {venta.estado === 'anulada' && venta.motivoAnulacion ? (
                <p className="mt-1 text-[13px] text-alerta-texto">{venta.motivoAnulacion}</p>
              ) : null}
            </div>

            {venta.estado === 'anulada' ? (
              <Estado tono="expuesto">Anulada</Estado>
            ) : (
              <Estado tono="cubierto">Confirmada</Estado>
            )}
          </article>
        </li>
      ))}
    </ul>
  )
}
