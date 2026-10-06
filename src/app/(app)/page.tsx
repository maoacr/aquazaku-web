import { AlertTriangle, Boxes, PackageX, PhoneCall, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { BarrasConUmbral } from '@/components/graficos/barras-con-umbral'
import { BarrasDiarias, DIAS_VISIBLES, cuantosCierres } from '@/components/graficos/barras-diarias'
import { Tanque } from '@/components/graficos/tanque'
import { Negocio } from '@/components/tablero/negocio'
import { RangoDeFechas } from '@/components/ui/rango-de-fechas'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { hoyEnLaPlanta } from '@/lib/hora-de-la-planta'
import { pesos } from '@/lib/plata'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type {
  CarteraDeCliente,
  CierreDeProduccion,
  InsumoListado,
  Producto,
  Reconciliacion,
  ResumenDeStock,
  SaldoDeAgua,
  SeguimientosALlamar,
} from '@/lib/api-types'
import { siPuedeVerlo } from '@/lib/permiso-opcional'

/**
 * El tablero.
 *
 * ── Sigue empezando por lo que espera una decisión ──────────────────────────
 *
 * Antes de los gráficos va lo que está trabado, con la acción al lado. Esa
 * parte no cambió y no debía: un número sin acción al lado es decoración, y
 * quien lo lee tiene que salir a buscar dónde arreglarlo.
 *
 * Lo que se sumó es la capa que faltaba —cómo viene la cosa— y va DESPUÉS, que
 * es el orden en que se necesita: primero qué hacer, después cómo venimos.
 *
 * ── Cada panel se pide, no se supone ────────────────────────────────────────
 *
 * Los roles no ven lo mismo: el `contador` ve la producción pero no los
 * tanques, y el `seller` no ve ninguno de los dos. En vez de copiar la matriz
 * de permisos acá —una segunda fuente de verdad de lo más delicado del
 * sistema—, se pide y el 403 decide. Ver `siPuedeVerlo`.
 *
 * ── Todo son Server Components ──────────────────────────────────────────────
 *
 * Los tres gráficos son SVG plano, sin estado ni efectos: se pintan en el
 * servidor y llegan como HTML. No hay `'use client'` en esta pantalla.
 */
export default async function TableroPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; granularidad?: string }>
}) {
  const { desde, hasta } = await searchParams

  /*
   * ── El rango por defecto: los últimos 30 días ─────────────────────────────
   *
   * Es el que se pide nueve de cada diez veces, y arrancar en blanco obliga a
   * tipear dos fechas antes de ver nada.
   *
   * Sale de `hoyEnLaPlanta()` y NO de `new Date().toISOString()`: Colombia es
   * UTC−5, así que después de las 19:00 el proceso en UTC ya pasó de
   * medianoche y el rango pediría un día que todavía no empezó.
   */
  const hoy = hoyEnLaPlanta()
  const rango = { desde: desde ?? restarDias(hoy, 29), hasta: hasta ?? hoy }

  const [usuario, stock, productos, cierres, saldos, insumos, aLlamar, cartera] =
    await Promise.all([
    getServerUser(),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    apiServerFetch<Producto[]>('/productos?estado=todos'),
    siPuedeVerlo(apiServerFetch<CierreDeProduccion[]>('/produccion')),
    siPuedeVerlo(apiServerFetch<SaldoDeAgua[]>('/tanques')),
    siPuedeVerlo(apiServerFetch<InsumoListado[]>('/insumos')),
    siPuedeVerlo(apiServerFetch<SeguimientosALlamar>('/clientes/a-llamar')),
    /*
     * La cartera se pide UNA vez, aquí, y baja a `Negocio` por prop. La necesitan
     * los dos: el pendiente de la deuda vieja que va arriba de todo, y los dos
     * paneles de abajo. Pedirla en cada lugar serían dos viajes por el mismo
     * dato, y podrían contestar distinto si alguien cobra en el medio.
     */
    siPuedeVerlo(apiServerFetch<CarteraDeCliente[]>('/reportes/cartera')),
  ])
  const leidoEn = new Date()

  /*
   * La banda del último nivel observado. Depende del cierre, así que va en una
   * segunda vuelta y solo cuando hay algo que comparar — pedirla siempre sería
   * un viaje de más para dibujar nada.
   *
   * `nivelObservado` se anota sobre el tanque CRUDO: es el que se mira al
   * cerrar el día. El procesado no tiene con qué compararse todavía.
   */
  const nivelObservado = cierres?.find((c) => c.nivelObservado !== null)?.nivelObservado ?? null
  const reconciliacion =
    nivelObservado && saldos
      ? await siPuedeVerlo(
          apiServerFetch<Reconciliacion>(
            `/tanques/reconciliacion?tanque=crudo&nivel=${nivelObservado}`,
          ),
        )
      : null

  /*
   * Las direcciones con algo que hacer: aviso o urgente. Las verdes están en la
   * lista pero no son un pendiente.
   */
  const atrasadas = aLlamar
    ? [...aLlamar.botellones, ...aLlamar.otros].filter((f) => f.urgencia !== 'al-dia').length
    : 0

  /*
   * El tramo sin techo —el más viejo— es el ÚLTIMO que manda `api/`. Se lee de
   * las llaves en vez de escribirlo: `TRAMOS` vive en una sola constante allá.
   */
  const llavesDeTramos = cartera?.[0] ? Object.keys(cartera[0].tramos) : []
  const tramoMasViejo = llavesDeTramos.at(-1) ?? ''
  /*
   * La llave del último tramo viene como `90+`, así que escribirla tal cual
   * daba «lleva más de 90+ sin cobrarse». El `+` ya lo dice el «más de».
   */
  const diasDelTramoViejo = tramoMasViejo.replace('+', '')
  const deudaVieja = tramoMasViejo
    ? (cartera ?? []).reduce((a, c) => a + Number(c.tramos[tramoMasViejo] ?? 0), 0)
    : 0

  const pendientes = [
    ...(stock.some((p) => p.vencido > 0)
      ? [
          {
            id: 'vencido',
            Icono: AlertTriangle,
            titulo: `Producto vencido en ${contar(stock.filter((p) => p.vencido > 0).length, 'producto')}`,
            detalle:
              'Vencido no es descartado: las unidades siguen ocupando lugar hasta que alguien las descarte.',
            href: '/modulos/stock',
            accion: 'Ir a descartarlo',
          },
        ]
      : []),

    ...(stock.some((p) => p.activo && p.vendible === 0)
      ? [
          {
            id: 'agotado',
            Icono: PackageX,
            titulo: `${contar(stock.filter((p) => p.activo && p.vendible === 0).length, 'producto')} sin unidades para vender`,
            detalle: 'Están en el catálogo pero no se pueden despachar.',
            href: '/modulos/stock',
            accion: 'Ver el stock',
          },
        ]
      : []),

    ...(productos.some((p) => !p.activo && Number(p.precioResidencial) === 0)
      ? [
          {
            id: 'sin-precio',
            Icono: TriangleAlert,
            titulo: `${contar(productos.filter((p) => !p.activo && Number(p.precioResidencial) === 0).length, 'producto')} esperando precio`,
            detalle: 'El seed los dejó desactivados. No se venden hasta que tengan precio y se activen.',
            href: '/modulos/productos/gestion',
            accion: 'Cargar los precios',
          },
        ]
      : []),

    // El agua no se descuenta sola: si el libro quedó corto, falta registrar.
    ...(saldos?.some((s) => s.litros < 0)
      ? [
          {
            id: 'agua-corta',
            Icono: TriangleAlert,
            titulo: 'El libro del agua quedó corto',
            detalle:
              'Se consumió agua que nunca se registró entrando. Mire el nivel real y ajuste el saldo con motivo.',
            href: '/modulos/produccion',
            accion: 'Ir a ajustarlo',
          },
        ]
      : []),

    ...(reconciliacion && !reconciliacion.cuadra
      ? [
          {
            id: 'no-cuadra',
            Icono: TriangleAlert,
            titulo: 'El tanque crudo no cuadra con lo que se vio',
            detalle: `El libro dice ${reconciliacion.litrosCalculados.toLocaleString('es-CO')} L y en el último cierre se vio otra cosa.`,
            href: '/modulos/produccion',
            accion: 'Ver la reconciliación',
          },
        ]
      : []),

    /*
     * La lista completa de "para llamar" vive en `/modulos/seguimientos`.
     * Aquí solo se avisa — con la cantidad exacta y el link a la lista
     * completa — para que el tablero siga cumpliendo su rol de «vistazo
     * general del negocio».
     *
     * ── Cuenta solo lo ATRASADO, no la lista entera ──────────────────────
     *
     * Seguimientos muestra ahora TODAS las direcciones que alguna vez
     * compraron, incluidas las que están al día. El tablero no puede seguirlas
     * a todas: «182 direcciones para llamar» sería falso y, peor, dejaría de
     * significar nada el día que de verdad haya doscientas atrasadas.
     *
     * Aquí se cuentan las amarillas y las rojas — las que tienen algo que hacer.
     *
     * ── El aviso suma los DOS canales ────────────────────────────────────
     *
     * Y cuenta DIRECCIONES, no clientes: la unidad de la lista es la puerta,
     * así que un cliente con casa y local atrasados son dos llamadas. Decir
     * «1 cliente» mandaría a la pantalla esperando una fila y habría dos.
     *
     * Los dos canales se suman en vez de mostrarse aparte porque el tablero
     * avisa, no detalla: el corte entre botellones y otros productos es una
     * decisión de la pantalla de Seguimientos, y acá sería una pestaña de más
     * en un lugar donde no se trabaja.
     *
     * El `null` de `aLlamar` ya está descartado por la condición: si el
     * 403 lo negara, no habría con qué contar.
     */
    /*
     * ── La plata vieja es un pendiente, no una estadística ──────────────────
     *
     * Los tramos los decide `api/` en una sola constante (`TRAMOS` en
     * `cartera.ts`), así que aquí se busca el ÚLTIMO —el que no tiene techo— en
     * vez de escribir «90+» a mano. El día que el contador pida otros tramos,
     * este aviso los sigue sin tocarse.
     *
     * Cuanto más vieja, menos probable que entre: por eso espera una decisión
     * y no solo una mirada.
     */
    ...(deudaVieja > 0
      ? [
          {
            id: 'deuda-vieja',
            Icono: TriangleAlert,
            titulo: `${pesos(deudaVieja)} lleva más de ${diasDelTramoViejo} días sin cobrarse`,
            detalle:
              'Cuanto más vieja, menos probable que entre. Conviene llamar antes de que se enfríe.',
            href: '/modulos/reportes',
            accion: 'Ver la cartera',
          },
        ]
      : []),

    ...(atrasadas > 0
      ? [
          {
            id: 'a-llamar',
            Icono: PhoneCall,
            titulo: `${contar(atrasadas, 'dirección', 'direcciones')} para llamar`,
            detalle:
              'Llevan una semana o más sin recibir. Una llamada a tiempo evita que se pasen a otra planta.',
            href: '/modulos/seguimientos',
            accion: 'Ir a Seguimientos',
          },
        ]
      : []),
  ]

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Hola, {primerNombre(usuario?.name)}</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          {pendientes.length === 0
            ? 'No hay nada esperando. Aquí abajo, cómo viene la planta.'
            : 'Esto es lo que está esperando que alguien haga algo.'}
        </p>
      </header>

      {pendientes.length > 0 ? (
        <ul className="grid gap-3">
          {pendientes.map(({ id, Icono, titulo, detalle, href, accion }) => (
            <li key={id}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-lg border border-alerta-borde bg-alerta-fondo p-4 text-alerta-texto hover:border-alerta"
              >
                <Icono aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span className="grid gap-0.5">
                  <span className="font-semibold">{titulo}</span>
                  <span className="text-[14px] opacity-90">{detalle}</span>
                  <span className="mt-1 text-[14px] font-medium underline underline-offset-4">
                    {accion} →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        La lista completa de "para llamar" se mudó a `/modulos/seguimientos` —
        acá arriba queda solo el AVISO, con la acción al lado. Es la misma
        regla que cualquier pendiente: número sin acción es decoración.

        `aLlamar` puede ser `null` si el rol no puede verla — el 403 decide, no
        una copia de la matriz de permisos.
      */}

      {/*
        ── Cómo viene el negocio ───────────────────────────────────────────────

        Va DESPUÉS de los pendientes y ANTES de la operación. El orden no es
        casual: primero lo que espera una decisión, después la plata, y al final
        el agua y la producción, que ya funcionaban y no cambian.

        El rango manda sobre todo lo de `Negocio` y vive en la URL, así que un
        tablero de un rango se comparte y se vuelve a abrir igual.

        `Negocio` devuelve `null` si el rol no puede ver `/reportes/*` — el
        `pos` no tiene `reportes:financieros`—, y entonces esta pantalla queda
        exactamente como estaba antes.
      */}
      <RangoDeFechas desde={rango.desde} hasta={rango.hasta} />
      <Negocio desde={rango.desde} hasta={rango.hasta} cartera={cartera} />

      {saldos ? (
        <section className="aq-tarjeta grid gap-4 p-5">
          <div>
            <h2 className="aq-titulo-tarjeta text-principal">El agua</h2>
            <p className="mt-1 text-[13px] text-tenue">
              Las marcas son cuartos porque así se lee un tanque mirándolo. Los litros de
              arriba son los del libro, que es el que manda.
            </p>
          </div>

          <ul className="grid gap-6 sm:grid-cols-2">
            {saldos.map((saldo) => (
              <li key={saldo.tanque} className="grid justify-items-center gap-2">
                <p className="text-[14px] text-secundario">
                  {saldo.tanque === 'crudo' ? 'Agua cruda' : 'Agua procesada'}
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span
                    className={`aq-cifra text-2xl font-semibold ${saldo.litros < 0 ? 'text-alerta-texto' : 'text-agua'}`}
                  >
                    {saldo.litros.toLocaleString('es-CO')}
                  </span>
                  <span className="text-[13px] text-tenue">L</span>
                </p>
                <Tanque
                  saldo={saldo}
                  id={saldo.tanque}
                  banda={
                    saldo.tanque === 'crudo' && reconciliacion
                      ? { ...reconciliacion.banda, nivel: reconciliacion.nivelObservado }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>

          {reconciliacion ? (
            <p className="text-[13px] text-tenue">
              La franja del tanque crudo es el rango que representa el último nivel que
              alguien vio.{' '}
              {reconciliacion.cuadra
                ? 'El libro cae adentro: el ojo y el registro dicen lo mismo.'
                : 'El libro cae afuera, así que hay algo sin registrar.'}
            </p>
          ) : null}
        </section>
      ) : null}

      {cierres && cierres.length > 0 ? (
        <section className="aq-tarjeta grid gap-4 p-5">
          <div>
            <h2 className="aq-titulo-tarjeta text-principal">Producción</h2>
            <p className="mt-1 text-[13px] text-tenue">
              Litros, que es la unidad que comparten las pacas y los botellones.{' '}
              {mayuscula(cuantosCierres(Math.min(cierres.length, DIAS_VISIBLES)))}.
            </p>
          </div>
          <BarrasDiarias cierres={cierres} />
        </section>
      ) : null}

      {insumos && insumos.filter((i) => i.activo).length > 0 ? (
        <section className="aq-tarjeta grid gap-4 p-5">
          <div>
            <h2 className="aq-titulo-tarjeta text-principal">Insumos</h2>
            <p className="mt-1 text-[13px] text-tenue">
              La línea vertical es el mínimo. La pregunta no es cuánto hay: es si alcanza.
            </p>
          </div>
          <BarrasConUmbral insumos={insumos.filter((i) => i.activo)} />
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="aq-micro text-tenue">Inventario</h2>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((p) => (
            <li key={p.productoId}>
              <Link href={`/modulos/stock/${p.productoId}`} className="aq-tarjeta block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="aq-titulo-tarjeta truncate text-principal">{p.nombre}</p>
                    <p className="aq-cifra mt-0.5 text-[13px] text-tenue">{p.codigo}</p>
                  </div>
                  <Boxes aria-hidden className="size-5 shrink-0 text-icono" />
                </div>

                <p className="mt-3 flex items-baseline gap-2">
                  <span className="aq-cifra text-[32px] font-semibold leading-none text-principal">
                    {p.vendible}
                  </span>
                  <span className="text-[13px] text-tenue">para vender</span>
                </p>

                {p.vencido > 0 ? (
                  <p className="mt-1 text-[13px] text-alerta-texto">
                    <span className="aq-cifra">{p.vencido}</span> vencidas sin descartar
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <SelloDeHora leidoEn={leidoEn} />
      </section>
    </div>
  )
}

/** «3 productos» / «1 producto» — sin el «(s)» que nadie escribe hablando. */
/**
 * «1 producto» / «3 productos».
 *
 * `plural` es opcional porque el 90 % de los sustantivos del tablero pluralizan
 * con una `s`. Pero no todos: «dirección» → «direcciones» mueve el acento, y
 * pegarle una `s` daba «direccións». Por eso el parámetro existe — no por
 * flexibilidad de más, sino porque el default es incorrecto en castellano para
 * todo lo que termina en consonante.
 */
function contar(cantidad: number, sustantivo: string, plural?: string): string {
  if (cantidad === 1) return `${cantidad} ${sustantivo}`

  return `${cantidad} ${plural ?? `${sustantivo}s`}`
}

/** «el último cierre» → «El último cierre». Para arrancar una oración. */
function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function primerNombre(nombre: string | undefined): string {
  return nombre?.trim().split(' ')[0] ?? 'de nuevo'
}

/**
 * Resta días a un `AAAA-MM-DD`, en calendario puro.
 *
 * `Date.UTC` para construir y `toISOString` para leer: los dos en UTC, así que
 * la zona del proceso no entra en la cuenta. La fecha ya viene cortada en la
 * zona de la planta por `hoyEnLaPlanta()`; a partir de ahí es calendario.
 */
function restarDias(iso: string, dias: number): string {
  const [anio, mes, dia] = iso.split('-').map(Number) as [number, number, number]

  return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10)
}
