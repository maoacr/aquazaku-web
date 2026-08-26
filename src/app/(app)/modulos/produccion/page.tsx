import { CierreDelDia } from '@/components/produccion/cierre-del-dia'
import { HistorialDeCierres } from '@/components/produccion/historial-de-cierres'
import { AjustarAgua, RegistrarReposicion, Tanques } from '@/components/produccion/tanques'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type {
  CierreDeProduccion,
  InsumoListado,
  ParametrosDeProduccion,
  Producto,
  SaldoDeAgua,
} from '@/lib/api-types'

/**
 * Producción y agua — M4.
 *
 * ── Todo en una pantalla, y en el orden en que se usa ───────────────────────
 *
 * Arriba los tanques, porque es lo primero que se mira al llegar. Después el
 * cierre, que es lo que se hace una vez por día. Los ajustes al final: son
 * correcciones, no operación.
 *
 * El acceso lo decide `api/`. Si un rol sin permiso llega hasta acá,
 * `apiServerFetch` recibe 403 y lanza. Esta página no vuelve a chequear el rol
 * porque hacerlo sugeriría que ESA es la barrera (RN-ACC-02).
 *
 * ── Por qué se piden cinco cosas y no una ───────────────────────────────────
 *
 * La vista previa del cierre necesita los parámetros (para no copiar `3.785` ni
 * `0.7`), el catálogo (los litros de cada producto), los insumos (para avisar
 * si no alcanzan las tapas) y el saldo del agua (para avisar si el libro no da).
 * Las cinco van en paralelo: son independientes entre sí y encadenarlas
 * multiplicaría la espera sin ganar nada.
 */
export default async function ProduccionPage() {
  const [parametros, catalogo, insumos, saldos, cierres] = await Promise.all([
    apiServerFetch<ParametrosDeProduccion>('/produccion/parametros'),
    apiServerFetch<Producto[]>('/productos'),
    apiServerFetch<InsumoListado[]>('/insumos'),
    apiServerFetch<SaldoDeAgua[]>('/tanques'),
    apiServerFetch<CierreDeProduccion[]>('/produccion'),
  ])
  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Producción</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          El agua que entra, la que se procesa y la que sale hecha producto.
        </p>
      </header>

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Los tanques</h2>
        <Tanques saldos={saldos} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>

      <CierreDelDia
        parametros={parametros}
        catalogo={catalogo}
        insumos={insumos.filter((i) => i.activo)}
        aguaProcesada={saldos.find((s) => s.tanque === 'procesado')}
      />

      <RegistrarReposicion />
      <AjustarAgua saldos={saldos} />

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Cierres registrados</h2>
        <HistorialDeCierres cierres={cierres} />
      </section>
    </div>
  )
}
