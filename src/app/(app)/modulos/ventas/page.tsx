import Link from 'next/link'
import { BotonDeNuevaVenta } from '@/components/ventas/boton-de-nueva-venta'
import { UltimasVentas } from '@/components/ventas/ultimas-ventas'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'

/**
 * Los dos tabs de la lista — viven en la URL, no en estado local.
 *
 * `vigentes` muestra las confirmadas (incluidas las modificadas, con su
 * label). `anuladas` muestra las que RN-VEN-08 dejó sin efecto. La URL
 * permite refrescar y compartir el link sin perder el tab.
 */
type TabDeVentas = 'vigentes' | 'anuladas'

const TAB_POR_DEFECTO: TabDeVentas = 'vigentes'

function tabDesde(searchParams: { tab?: string } | undefined): TabDeVentas {
  return searchParams?.tab === 'anuladas' ? 'anuladas' : TAB_POR_DEFECTO
}

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
  const tab = tabDesde(sp)

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

        {/*
          Las tabs son links: la URL es la fuente de verdad, no el estado de
          un componente. Refrescar la página no pierde el tab, y compartir
          el link lleva a la misma vista. Es la única forma de que dos
          personas que atienden puedan hablar del «listado de anuladas»
          sin tener que describir dónde está el botón.
        */}
        <nav
          role="tablist"
          aria-label="Filtrar últimas ventas por estado"
          className="flex flex-wrap gap-1 border-b border-sutil"
        >
          <PestanaDeVentas
            tab="vigentes"
            activa={tab === 'vigentes'}
            conteo={vigentes.length}
          />
          <PestanaDeVentas
            tab="anuladas"
            activa={tab === 'anuladas'}
            conteo={anuladas.length}
          />
        </nav>

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

/**
 * Una tab de la lista — un link con el conteo al lado.
 *
 * El conteo se lee del lado del servidor y se pasa como prop: hacer un
 * `fetch` en el cliente para saber cuántas hay hoy sería un round-trip
 * extra solo para mostrar un número que ya se conoce.
 */
function PestanaDeVentas({
  tab,
  activa,
  conteo,
}: {
  tab: TabDeVentas
  activa: boolean
  conteo: number
}) {
  const etiqueta = tab === 'anuladas' ? 'Anuladas' : 'Vigentes'

  return (
    <Link
      href={tab === TAB_POR_DEFECTO ? '/modulos/ventas' : `/modulos/ventas?tab=${tab}`}
      role="tab"
      aria-selected={activa}
      className={`-mb-px border-b-2 px-3 py-2 text-[14px] ${
        activa
          ? 'border-principal text-principal'
          : 'border-transparent text-tenue hover:text-principal'
      }`}
    >
      {etiqueta}{' '}
      <span className="ml-1 rounded-full bg-elevada px-2 py-0.5 text-[12px] text-tenue">
        {conteo}
      </span>
    </Link>
  )
}
