import { AlertTriangle, Boxes, PackageX, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { BarrasConUmbral } from '@/components/graficos/barras-con-umbral'
import { BarrasDiarias, DIAS_VISIBLES, cuantosCierres } from '@/components/graficos/barras-diarias'
import { Tanque } from '@/components/graficos/tanque'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type {
  CierreDeProduccion,
  InsumoListado,
  Producto,
  Reconciliacion,
  ResumenDeStock,
  SaldoDeAgua,
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
export default async function TableroPage() {
  const [usuario, stock, productos, cierres, saldos, insumos] = await Promise.all([
    getServerUser(),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    apiServerFetch<Producto[]>('/productos?estado=todos'),
    siPuedeVerlo(apiServerFetch<CierreDeProduccion[]>('/produccion')),
    siPuedeVerlo(apiServerFetch<SaldoDeAgua[]>('/tanques')),
    siPuedeVerlo(apiServerFetch<InsumoListado[]>('/insumos')),
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
  ]

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="aq-titulo-pantalla text-principal">Hola, {primerNombre(usuario?.name)}</h1>
        <p className="aq-bajada mt-1.5 text-secundario">
          {pendientes.length === 0
            ? 'No hay nada esperando. Acá abajo, cómo viene la planta.'
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
function contar(cantidad: number, sustantivo: string): string {
  return `${cantidad} ${sustantivo}${cantidad === 1 ? '' : 's'}`
}

/** «el último cierre» → «El último cierre». Para arrancar una oración. */
function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function primerNombre(nombre: string | undefined): string {
  return nombre?.trim().split(' ')[0] ?? 'de nuevo'
}
