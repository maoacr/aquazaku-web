import { BotonDeNuevaVenta } from '@/components/ventas/boton-de-nueva-venta'
import { PestanasDeVentas, pestanaDesde } from '@/components/ventas/pestanas-de-ventas'
import { UltimasVentas } from '@/components/ventas/ultimas-ventas'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'

/**
 * Ventas — M6.
 *
 * ── Lo que se ve depende del rol, y lo decide `api/` ────────────────────────
 *
 * Un `pos` ve **sus** ventas; el `admin`, todas. Eso lo recorta `scopedCondition`
 * con la matriz (RN-ACC-03): esta página pide y muestra lo que llega. No hay una
 * copia de la regla acá.
 */
export default async function VentasPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  /*
   * Los clientes NO se cargan acá.
   *
   * Antes venía la tabla entera para llenar un `<select>`: con quinientos, esta
   * página descargaba quinientos registros para que alguien usara uno. Ahora el
   * mostrador los busca por documento, y pide solo los que coinciden.
   */
  const sp = searchParams ? await searchParams : undefined
  const tab = pestanaDesde(sp?.tab)

  const [productos, stock, ventas] = await Promise.all([
    apiServerFetch<Producto[]>('/productos'),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    /*
     * El endpoint ya filtra las `estado='corregida'` — la vieja corregida
     * no aparece, la nueva hereda el `createdAt` y queda en su lugar. Lo
     * que llega son `confirmada` (vigentes, con label «Modificada» si
     * reemplazaron a otra) y `anulada` (RN-VEN-08). El filtro por tab se
     * hace del lado del web — la lista ya está recortada a cien y la
     * división es una sola comparación por fila.
     */
    apiServerFetch<VentaDelListado[]>('/ventas'),
  ])
  const leidoEn = new Date()

  const vigentes = ventas.filter((v) => v.estado === 'confirmada')
  const anuladas = ventas.filter((v) => v.estado === 'anulada')

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Ventas</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Qué salió, a quién y cómo se pagó.
        </p>
      </header>

      {/*
        El alta de venta vive dentro de un modal — el mismo `<Modal>` que ya
        reusa la corrección y la anulación. El botón lo abre; el formulario
        (productos, stock, cliente, base, botellones, código, factura) es
        exactamente el mismo `<Mostrador>` de siempre, sin cambios.
      */}
      <BotonDeNuevaVenta productos={productos.filter((p) => p.activo)} stock={stock} />

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Últimas ventas</h2>

        <PestanasDeVentas
          tab={tab}
          conteos={{ vigentes: vigentes.length, anuladas: anuladas.length }}
          basePath="/modulos/ventas"
        />

        <UltimasVentas
          ventas={tab === 'anuladas' ? anuladas : vigentes}
          desde="la-pantalla-de-ventas"
          productos={productos.filter((p) => p.activo)}
          stock={stock}
        />
        <SelloDeHora leidoEn={leidoEn} />
      </section>
    </div>
  )
}
