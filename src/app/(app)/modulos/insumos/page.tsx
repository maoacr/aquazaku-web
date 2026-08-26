import { AltaDeInsumo } from '@/components/insumos/alta-insumo'
import {
  AjusteDeInsumo,
  CargarEquivalencia,
  DescarteDeInsumo,
  EntradaDeInsumo,
} from '@/components/insumos/formularios'
import { TarjetasDeInsumos } from '@/components/insumos/tarjetas-de-insumos'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { InsumoListado } from '@/lib/api-types'

/**
 * Insumos de empaque — M3, RN-INS-01 a 04.
 *
 * Tapas, sellos y bolsas: lo que se consume al producir. No se venden.
 *
 * El acceso lo decide `api/`: si un rol sin permiso llega hasta acá,
 * `apiServerFetch` recibe 403 y lanza. Esta página no vuelve a chequear el rol
 * porque hacerlo sugeriría que ESA es la barrera (RN-ACC-02).
 *
 * Los saldos los mueven varias personas, así que el número en pantalla siempre
 * es de hace un rato: `<SelloDeHora>` dice de cuándo en vez de fingir que es de
 * ahora.
 */
export default async function InsumosPage() {
  const insumos = await apiServerFetch<InsumoListado[]>('/insumos')
  const leidoEn = new Date()

  const activos = insumos.filter((i) => i.activo)

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Insumos</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          Lo que se consume al producir. Sin tapas no se envasa, por más agua que haya.
        </p>
      </header>

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Existencias</h2>
        <TarjetasDeInsumos insumos={activos} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>

      {/* Los movimientos solo tienen sentido con algo cargado: sin insumos, el
          desplegable estaría vacío y el formulario sería una promesa falsa. */}
      {activos.length > 0 ? (
        <>
          <EntradaDeInsumo insumos={activos} />
          <CargarEquivalencia insumos={activos} />
          <AjusteDeInsumo insumos={activos} />
          <DescarteDeInsumo insumos={activos} />
        </>
      ) : null}

      <AltaDeInsumo />
    </div>
  )
}
