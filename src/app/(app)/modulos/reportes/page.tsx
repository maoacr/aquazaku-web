import { TablaDeCartera } from '@/components/reportes/cartera'
import { TablaDeExtracto, Totales } from '@/components/reportes/extracto'
import { TablaMensual } from '@/components/reportes/mensual'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { CarteraDeCliente, Extracto, Mes } from '@/lib/api-types'
import { Filtros } from './filtros'

/**
 * Reportes — M11.
 *
 * ── Todo vive en la URL, no en el estado del componente ────────────────────
 *
 * Rango, tipos y columnas. Así una consulta se comparte, se guarda en favoritos
 * y se vuelve a abrir dentro de un mes dando exactamente lo mismo — que es
 * RN-CON-02 llevado hasta la pantalla.
 *
 * Y hace que el «volver» del navegador funcione: quien compara dos meses va y
 * vuelve, y perder el rango en cada vuelta es lo que hace que la gente termine
 * pidiendo los datos por WhatsApp.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string
    hasta?: string
    tipos?: string
    columnas?: string
    anio?: string
  }>
}) {
  const { desde, hasta, tipos, columnas, anio } = await searchParams

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

  const anioElegido = Number(anio) || hoy.getFullYear()
  const mesActual = hoy.toISOString().slice(0, 7)

  /*
   * ── El año en curso se corta en el mes actual ─────────────────────────────
   *
   * Diciembre en cero, mirado en septiembre, no dice «no pasó nada»: dice «no
   * pasó TODAVÍA». Y como el resumen marca los meses vacíos como alarma, pedir
   * el año entero llenaría el reporte de alarmas falsas — que es la forma más
   * rápida de que se dejen de mirar todas.
   */
  const hastaMes = `${anioElegido}-12`
  const rangoMensual = new URLSearchParams({
    desde: `${anioElegido}-01`,
    hasta: hastaMes > mesActual ? mesActual : hastaMes,
  })

  const [extracto, cartera, meses] = await Promise.all([
    apiServerFetch<Extracto>(`/reportes/extracto?${consulta}`),
    apiServerFetch<CarteraDeCliente[]>('/reportes/cartera'),
    apiServerFetch<Mes[]>(`/reportes/mensual?${rangoMensual}`),
  ])

  const leidoEn = new Date()

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="aq-titulo-pantalla text-principal">Reportes</h1>
        <p className="text-[15px] text-secundario print:hidden">
          Lo que pasó en la operación, con su fecha y su monto. Un reporte de agosto da lo mismo
          hoy que en diciembre: nada de esto se edita.
        </p>
        {/*
          Impreso, el rango tiene que ir en el papel. Una hoja sin fechas sobre
          un escritorio no se puede volver a ubicar, y lo primero que pasa es
          que alguien la lee como si fuera del mes en curso.
        */}
        <p className="hidden text-[13px] text-secundario print:block">
          Extracto del {rango.desde} al {rango.hasta} · Aquazaku
        </p>
      </header>

      <Filtros
        desde={rango.desde}
        hasta={rango.hasta}
        tipos={tipos ?? ''}
        columnas={columnas ?? ''}
      />

      <Totales extracto={extracto} />

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">
          {extracto.movimientos.length === 1
            ? '1 movimiento'
            : `${extracto.movimientos.length} movimientos`}
        </h2>
        <TablaDeExtracto extracto={extracto} columnas={columnas} />
      </section>

      <section className="grid gap-3 break-before-page">
        <div>
          <h2 className="aq-micro text-tenue">Resumen mensual de {anioElegido}</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Cada mes lleva a su propio extracto. Lo vendido y lo cobrado van separados: son dos
            hechos distintos, y sumarlos daría el doble.
          </p>
        </div>
        <TablaMensual meses={meses} />
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
