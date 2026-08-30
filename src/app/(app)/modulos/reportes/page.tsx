import { TablaDeCartera } from '@/components/reportes/cartera'
import { TablaDeExtracto, Totales } from '@/components/reportes/extracto'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { CarteraDeCliente, Extracto } from '@/lib/api-types'
import { Filtros } from './filtros'

/**
 * Reportes — M11.
 *
 * ── El rango vive en la URL, no en el estado del componente ────────────────
 *
 * Así una consulta se puede compartir, guardar en favoritos y volver a abrir
 * dentro de un mes dando exactamente lo mismo — que es la propiedad de
 * RN-CON-02 llevada hasta la pantalla.
 *
 * Y hace que el «volver» del navegador funcione: quien compara dos meses va y
 * vuelve, y perder el rango en cada vuelta es lo que hace que la gente termine
 * pidiendo los datos por WhatsApp.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; tipos?: string }>
}) {
  const { desde, hasta, tipos } = await searchParams

  /*
   * Por defecto, el mes en curso: es el rango que alguien pide nueve de cada
   * diez veces, y arrancar en blanco obliga a tipear dos fechas antes de ver
   * nada.
   */
  const hoy = new Date()
  const rango = {
    desde: desde ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10),
    hasta: hasta ?? hoy.toISOString().slice(0, 10),
  }

  const consulta = new URLSearchParams(rango)
  if (tipos) consulta.set('tipos', tipos)

  const [extracto, cartera] = await Promise.all([
    apiServerFetch<Extracto>(`/reportes/extracto?${consulta}`),
    apiServerFetch<CarteraDeCliente[]>('/reportes/cartera'),
  ])

  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="aq-titulo-pantalla text-principal">Reportes</h1>
        <p className="text-[15px] text-secundario">
          Lo que pasó en la operación, con su fecha y su monto. Un reporte de agosto da lo mismo
          hoy que en diciembre: nada de esto se edita.
        </p>
      </header>

      <Filtros desde={rango.desde} hasta={rango.hasta} tipos={tipos ?? ''} />

      <Totales extracto={extracto} />

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">
          {extracto.movimientos.length === 1
            ? '1 movimiento'
            : `${extracto.movimientos.length} movimientos`}
        </h2>
        <TablaDeExtracto extracto={extracto} />
      </section>

      <section className="grid gap-3">
        <div>
          <h2 className="aq-micro text-tenue">Cartera por edad</h2>
          {/*
            La cartera es a HOY, no al rango: el rango filtra movimientos, y una
            deuda no es un movimiento — es lo que quedó sin cobrar hasta ahora.
          */}
          <p className="mt-1 text-[13px] text-tenue">
            A hoy, sin importar el rango de arriba. Ordenada por cuánto debe cada uno.
          </p>
        </div>
        <TablaDeCartera cartera={cartera} />
        <SelloDeHora leidoEn={leidoEn} />
      </section>
    </div>
  )
}
