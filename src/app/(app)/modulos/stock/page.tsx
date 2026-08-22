import { AvisoDeStock } from '@/components/stock/aviso-de-stock'
import { EntradaDeInventario } from '@/components/stock/formularios'
import { TablaDeStock } from '@/components/stock/tabla-stock'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type { ResumenDeStock } from '@/lib/api-types'

/**
 * Stock de producto terminado — lo ven los cuatro roles.
 *
 * El `contador` necesita el inventario para cerrar los números y quien vende
 * necesita saber qué hay. Mover el stock es otro permiso, y quien no lo tenga
 * recibe 403 de `api/` — ocultar el formulario es cosmética (RN-ACC-02).
 */
export default async function StockPage() {
  const [productos, usuario] = await Promise.all([
    apiServerFetch<ResumenDeStock[]>('/stock'),
    getServerUser(),
  ])

  // Después del `await`, no antes: la hora que interesa es cuándo se leyó la
  // base, no cuándo empezó a renderizarse la pantalla.
  const leidoEn = new Date()

  const puedeAjustar = usuario?.permisos.includes('stock:ajustar') ?? false

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Stock</h1>
        <p className="mt-1 text-secundario">
          Cuánto hay de cada producto, cuánto se puede vender y cuánto está esperando descarte.
        </p>
      </header>

      <AvisoDeStock productos={productos} />

      <TablaDeStock productos={productos} />

      <SelloDeHora leidoEn={leidoEn} />

      {puedeAjustar ? <EntradaDeInventario productos={productos} /> : null}
    </div>
  )
}
