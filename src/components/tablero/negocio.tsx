import { BarraDeComposicion } from '@/components/graficos/barra-de-composicion'
import { BarrasHorizontales } from '@/components/graficos/barras-horizontales'
import { SerieEnElTiempo } from '@/components/graficos/serie-en-el-tiempo'
import { FilaDeIndicadores, Indicador } from '@/components/ui/indicador'
import { apiServerFetch } from '@/lib/api-server'
import type {
  Base,
  FilaDeCartera,
  Extracto,
  ParqueDeBotellones,
  ProductoVendido,
} from '@/lib/api-types'
import { siPuedeVerlo } from '@/lib/permiso-opcional'
import { pesos } from '@/lib/plata'
import { cubetas, periodoAnterior, totalesDelPeriodo, variacion } from '@/lib/tablero'

/**
 * Cómo viene el negocio, en el rango que pidió la URL.
 *
 * ── Cada panel se pide, no se supone ────────────────────────────────────────
 *
 * `/reportes/*` exige `reportes:financieros`, que el `pos` NO tiene. En vez de
 * copiar la matriz de permisos aquí —una segunda fuente de verdad de lo más
 * delicado del sistema— se pide y el 403 decide. Es el mismo patrón que el
 * tablero ya usa para tanques y producción.
 *
 * ── La cartera llega por prop, no se pide aquí ───────────────────────────────
 *
 * La página la necesita ANTES, para levantar el pendiente de la deuda vieja.
 * Si cada uno la pidiera por su lado serían dos viajes por el mismo dato, y
 * podrían contestar distinto si alguien cobra en el medio.
 *
 * ── El período anterior es un segundo extracto ──────────────────────────────
 *
 * La comparación «contra el período anterior» es lo único que el gráfico no
 * puede mostrar, así que vive en los indicadores. Sale de pedir la ventana
 * previa del mismo largo.
 *
 * Es un Server Component. La única isla cliente de todo esto es el lienzo de
 * `SerieEnElTiempo`, y le llegan los tres cortes ya agregados por props.
 */
export async function Negocio({
  desde,
  hasta,
  cartera,
}: {
  desde: string
  hasta: string
  cartera: FilaDeCartera[] | null
}) {
  const previo = periodoAnterior({ desde, hasta })

  const [extracto, anterior, productos, botellones, bases] = await Promise.all([
    siPuedeVerlo(apiServerFetch<Extracto>(`/reportes/extracto?desde=${desde}&hasta=${hasta}`)),
    siPuedeVerlo(
      apiServerFetch<Extracto>(`/reportes/extracto?desde=${previo.desde}&hasta=${previo.hasta}`),
    ),
    siPuedeVerlo(
      apiServerFetch<ProductoVendido[]>(
        `/reportes/ventas-por-producto?desde=${desde}&hasta=${hasta}`,
      ),
    ),
    siPuedeVerlo(apiServerFetch<ParqueDeBotellones>('/botellones')),
    siPuedeVerlo(apiServerFetch<Base[]>('/bases')),
  ])

  // Sin extracto no hay sección: quien no puede ver la plata del negocio no ve
  // un tablero a medias, ve el tablero operativo que ya estaba.
  if (!extracto) return null

  const hoy = totalesDelPeriodo(extracto.movimientos)
  const antes = anterior ? totalesDelPeriodo(anterior.movimientos) : null

  const rango = { desde, hasta }
  const porDia = cubetas(extracto.movimientos, { ...rango, granularidad: 'dia' })
  const porSemana = cubetas(extracto.movimientos, { ...rango, granularidad: 'semana' })
  const porMes = cubetas(extracto.movimientos, { ...rango, granularidad: 'mes' })

  const deudaTotal = cartera?.reduce((a, c) => a + Number(c.total), 0) ?? 0
  const medios = extracto.totales.porMedioDePago

  return (
    <div className="grid gap-5">
      <FilaDeIndicadores>
        <Indicador
          etiqueta="Vendido en el período"
          valor={pesos(hoy.vendido)}
          {...(antes ? { comparacion: variacion(hoy.vendido, antes.vendido) } : {})}
          nota="contra el período anterior"
        />
        <Indicador
          etiqueta="Cobrado en el período"
          valor={pesos(hoy.cobrado)}
          {...(antes ? { comparacion: variacion(hoy.cobrado, antes.cobrado) } : {})}
          nota="contra el período anterior"
        />
        {cartera ? (
          <Indicador
            etiqueta="Por recaudar"
            valor={pesos(deudaTotal)}
            /*
              La cartera es una foto de HOY: `/reportes/cartera` no acepta
              fechas, y es correcto que no las acepte porque los cobros
              posteriores ya están imputados. Al lado de tres números que sí
              siguen al rango, uno quieto se lee como un bug — así que se dice.
            */
            anclado="al día de hoy, no sigue el rango"
          />
        ) : null}
        <Indicador
          etiqueta="Neto del período"
          valor={pesos(extracto.totales.neto)}
          nota="entradas menos salidas"
        />
      </FilaDeIndicadores>

      <section className="aq-tarjeta grid gap-1 p-5">
        <h2 className="aq-titulo-tarjeta text-principal">Vendido contra cobrado</h2>
        <p className="mt-1 max-w-[62ch] text-[13px] text-tenue">
          La distancia entre las dos líneas es la plata facturada que todavía no entró.
        </p>
        <SerieEnElTiempo porDia={porDia} porSemana={porSemana} porMes={porMes} />
      </section>

      {/*
        ── Una sola grilla para todos los paneles secundarios ──────────────────

        Antes eran dos grillas de dos columnas con hijos condicionales, y cuando
        la cartera venía vacía quedaba medio ancho en blanco al lado de un panel
        solo. Con una grilla única los paneles FLUYEN: si falta uno, el que
        sigue ocupa su lugar en vez de dejar el hueco.
      */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="aq-tarjeta grid gap-1 p-5">
          {/*
            ── El título dice «se pagó», no «entró» ────────────────────────────

            Decía «Cómo entró la plata» y mostraba una barra de Crédito, que es
            justo la plata que NO entró: se vendió a cuenta. El título mentía
            para una de las tres barras.
          */}
          <h2 className="aq-titulo-tarjeta text-principal">Con qué se pagó</h2>
          <p className="mt-1 text-[13px] text-tenue">
            El efectivo y la transferencia ya entraron. El crédito todavía no.
          </p>
          <BarrasHorizontales
            filas={[
              { etiqueta: 'Efectivo', valor: Number(medios.efectivo), texto: pesos(medios.efectivo) },
              {
                etiqueta: 'Transferencia',
                valor: Number(medios.transferencia),
                texto: pesos(medios.transferencia),
              },
              { etiqueta: 'Crédito', valor: Number(medios.credito), texto: pesos(medios.credito) },
            ]}
          />
          {Number(medios.credito) > 0 ? (
            <p className="mt-2 text-[12.5px] text-tenue">
              Lo vendido a crédito aparece arriba, en «Por recaudar».
            </p>
          ) : null}
          {/*
            `cuadra` viene en la respuesta a propósito: si la descomposición no
            suma al total de entradas, el panel lo dice en vez de mostrar tres
            barras que no cierran.
          */}
          {!extracto.totales.cuadra ? (
            <p className="mt-2 text-[13px] text-alerta-texto">
              La suma no cuadra con el total: hay un movimiento sin medio de pago registrado.
            </p>
          ) : null}
        </section>

        {/*
          ── Las UNIDADES, que el extracto no sabe contar ────────────────────

          El extracto dice cuánta plata entró; esto dice cuántos botellones
          salieron. Un mes que creció 14 % creció por volumen o por precio, y
          con el monto solo las dos conclusiones se ven idénticas.
        */}
        {productos && productos.length > 0 ? (
          <section className="aq-tarjeta grid gap-1 p-5">
            <h2 className="aq-titulo-tarjeta text-principal">Qué se vendió, en unidades</h2>
            <p className="mt-1 text-[13px] text-tenue">
              Cuántas salieron, sin importar a qué precio.
            </p>
            <BarrasHorizontales
              filas={productos.map((p) => ({
                etiqueta: p.nombre,
                valor: p.unidades,
                texto: `${p.unidades.toLocaleString('es-CO')} u`,
                chip: { texto: pesos(p.monto), tono: 'neutro' as const },
              }))}
            />
          </section>
        ) : null}

        {/*
          ── Sin deuda el panel SIGUE, en cero ───────────────────────────────

          Antes se escondía. Esconderlo es la misma falta que saltearse un mes
          vacío: la ausencia se lee como «no lo consulté». «Nadie debe nada» es
          una respuesta — y además es buena noticia.
        */}
        {cartera ? (
          <section className="aq-tarjeta grid gap-1 p-5">
            <h2 className="aq-titulo-tarjeta text-principal">Por recaudar, por antigüedad</h2>
            <p className="mt-1 text-[13px] text-tenue">
              Entre más vieja la deuda, menos probable que entre.
            </p>
            {cartera.length > 0 ? (
              <BarraDeComposicion total={pesos(deudaTotal)} partes={tramosDeCartera(cartera)} />
            ) : (
              <p className="mt-3 text-[15px] text-secundario">
                Nadie debe nada: todo lo vendido a crédito ya se cobró.
              </p>
            )}
          </section>
        ) : null}

        {cartera && cartera.length > 0 ? (
          <section className="aq-tarjeta grid gap-1 p-5">
            <h2 className="aq-titulo-tarjeta text-principal">A quién llamar primero</h2>
            <p className="mt-1 text-[13px] text-tenue">
              Los cinco que más deben.
            </p>
            <BarrasHorizontales
              filas={cartera.slice(0, 5).map((c) => ({
                etiqueta: c.cliente,
                valor: Number(c.total),
                texto: pesos(c.total),
              }))}
            />
          </section>
        ) : null}

        {botellones || bases ? (
          <section className="aq-tarjeta grid gap-4 p-5">
            <div>
              <h2 className="aq-titulo-tarjeta text-principal">Dónde está el parque</h2>
              <p className="mt-1 text-[13px] text-tenue">
                Botellones y bases no se venden: se prestan y tienen que volver.
              </p>
            </div>

            {botellones ? (
              <div className="grid gap-1">
                <p className="aq-micro text-tenue">Botellones</p>
                {/*
                  `categoria` y no la rampa: «en bodega» y «en poder de
                  clientes» son dos LUGARES, no dos grados de nada. La rampa
                  inventaría una jerarquía que no existe — y encima dejaría dos
                  azules vecinos que a contraluz no se separan.
                */}
                <BarraDeComposicion
                  escala="categoria"
                  partes={[
                    {
                      etiqueta: 'En poder de clientes',
                      valor: Math.max(botellones.enPoderDeAlguien - botellones.enBodega, 0),
                      texto: String(Math.max(botellones.enPoderDeAlguien - botellones.enBodega, 0)),
                    },
                    {
                      etiqueta: 'En bodega',
                      valor: botellones.enBodega,
                      texto: String(botellones.enBodega),
                    },
                  ]}
                />
                {/*
                  La ley de conservación viaja en la respuesta porque el dominio
                  pidió que fallara ruidosamente. Un endpoint que la calcula y
                  no la dice la deja tan silenciosa como no calcularla.
                */}
                {!botellones.cuadra ? (
                  <p className="text-[13px] text-alerta-texto">
                    El parque no cuadra: faltan o sobran{' '}
                    <span className="aq-cifra">{Math.abs(botellones.diferencia)}</span> botellones
                    contra lo registrado.
                  </p>
                ) : null}
              </div>
            ) : null}

            {bases ? (
              <div className="grid gap-1">
                <p className="aq-micro text-tenue">Bases</p>
                {/*
                  Las dañadas van aparte y no como tercera porción: la escala
                  categórica tiene DOS cupos, y una tercera porción quedaría a
                  ΔE 7,8 de la segunda. Además no es del mismo eje — prestada y
                  en bodega es DÓNDE está; dañada es CÓMO está.
                */}
                <BarraDeComposicion
                  escala="categoria"
                  partes={[
                    {
                      etiqueta: 'Prestadas',
                      valor: bases.filter((b) => b.ubicacion !== null).length,
                      texto: String(bases.filter((b) => b.ubicacion !== null).length),
                    },
                    {
                      etiqueta: 'En bodega',
                      valor: bases.filter((b) => b.ubicacion === null).length,
                      texto: String(bases.filter((b) => b.ubicacion === null).length),
                    },
                  ]}
                />
                {bases.some((b) => b.estado === 'danada') ? (
                  <p className="text-[12.5px] text-tenue">
                    <span className="aq-cifra">
                      {bases.filter((b) => b.estado === 'danada').length}
                    </span>{' '}
                    están dañadas. Arriba se cuentan según dónde estén.
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Los tramos de la cartera, sumados entre todos los clientes.
 *
 * `api/` devuelve una fila por cliente con su reparto por edad; el tablero
 * muestra el reparto del NEGOCIO. Las etiquetas salen de las llaves que manda
 * el servidor —`TRAMOS` vive en una sola constante allá— así que el día que el
 * contador pida otros tramos, esta pantalla los sigue sin tocarse.
 */
function tramosDeCartera(cartera: FilaDeCartera[]) {
  const suma = new Map<string, number>()

  for (const cliente of cartera) {
    for (const [etiqueta, monto] of Object.entries(cliente.tramos)) {
      suma.set(etiqueta, (suma.get(etiqueta) ?? 0) + Number(monto))
    }
  }

  return [...suma].map(([etiqueta, valor]) => ({
    etiqueta: `${etiqueta} días`,
    valor,
    texto: pesos(valor),
  }))
}
