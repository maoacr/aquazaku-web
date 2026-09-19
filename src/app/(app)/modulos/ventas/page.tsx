import { Mostrador } from '@/components/ventas/mostrador'
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
export default async function VentasPage() {
  /*
   * Los clientes NO se cargan acá.
   *
   * Antes venía la tabla entera para llenar un `<select>`: con quinientos, esta
   * página descargaba quinientos registros para que alguien usara uno. Ahora el
   * mostrador los busca por documento, y pide solo los que coinciden.
   */
  const [productos, stock, ventas] = await Promise.all([
    apiServerFetch<Producto[]>('/productos'),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    apiServerFetch<VentaDelListado[]>('/ventas'),
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

      <Mostrador productos={productos.filter((p) => p.activo)} stock={stock} />

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Últimas ventas</h2>
        {/*
          El catálogo y el stock bajan a la lista para poder CORREGIR una venta
          desde ahí — RN-VEN-16. Son los mismos que ya consume el mostrador: no
          hay una consulta más, se comparten los dos `fetch` que esta página ya
          hacía.
        */}
        <UltimasVentas
          ventas={ventas}
          productos={productos.filter((p) => p.activo)}
          stock={stock}
        />
        <SelloDeHora leidoEn={leidoEn} />
      </section>
    </div>
  )
}
