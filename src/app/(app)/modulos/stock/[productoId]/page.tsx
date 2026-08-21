import Link from 'next/link'
import { AjusteDeLote, DescarteDeLote } from '@/components/stock/formularios'
import { TablaDeLotes } from '@/components/stock/tabla-lotes'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type { LoteConSaldo, ResumenDeStock } from '@/lib/api-types'

/**
 * Los lotes de un producto, en orden FIFO.
 *
 * `hoy` se calcula acá y se pasa hacia abajo. Los componentes no llaman a
 * `new Date()`: si cada uno resolviera su propia fecha, una pantalla abierta a
 * la medianoche podría mostrar un lote como vigente en la tabla y como vencido
 * en el aviso.
 */
export default async function LotesDeProductoPage({
  params,
}: PageProps<'/modulos/stock/[productoId]'>) {
  const { productoId } = await params

  const [lotes, productos, usuario] = await Promise.all([
    apiServerFetch<LoteConSaldo[]>(`/stock/${productoId}/lotes`),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    getServerUser(),
  ])

  const producto = productos.find((p) => p.productoId === productoId)
  const hoy = new Date().toISOString().slice(0, 10)

  const puedeAjustar = usuario?.permisos.includes('stock:ajustar') ?? false
  const puedeDescartar = usuario?.permisos.includes('stock:descartar') ?? false

  return (
    <div className="grid gap-6">
      <header>
        <Link
          href="/modulos/stock"
          className="rounded-sm text-[14px] text-secundario underline-offset-4 hover:underline"
        >
          ← Volver al stock
        </Link>
        <h1 className="mt-2 text-[32px] font-semibold leading-10 tracking-tight text-principal">
          {producto?.nombre ?? 'Lotes'}
        </h1>
        <p className="mt-1 text-secundario">
          Del más próximo a vencer. El primero es el que sale en la próxima venta.
        </p>
      </header>

      <TablaDeLotes lotes={lotes} hoy={hoy} />

      {puedeAjustar ? <AjusteDeLote lotes={lotes} /> : null}
      {puedeDescartar ? <DescarteDeLote lotes={lotes} /> : null}
    </div>
  )
}
