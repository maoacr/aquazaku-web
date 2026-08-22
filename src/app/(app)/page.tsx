import { AlertTriangle, Boxes, PackageX, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type { Producto, ResumenDeStock } from '@/lib/api-types'

/**
 * Qué hay para hacer hoy.
 *
 * No es un panel de métricas. La pregunta que contesta no es «cómo venimos»
 * sino **«qué está esperando que alguien haga algo»** — y cada respuesta lleva
 * al lugar donde se resuelve.
 *
 * Un número sin acción al lado es decoración: quien lo lee tiene que salir a
 * buscar dónde arreglarlo, y en el camino se olvida.
 *
 * Si no hay nada pendiente, no se inventa contenido. El sistema no felicita.
 */
export default async function DashboardPage() {
  const [usuario, stock, productos] = await Promise.all([
    getServerUser(),
    apiServerFetch<ResumenDeStock[]>('/stock'),
    apiServerFetch<Producto[]>('/productos?estado=todos'),
  ])

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
  ]

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-principal sm:text-[32px] sm:leading-10">
          Hola, {primerNombre(usuario?.name)}
        </h1>
        <p className="mt-1 text-secundario">
          {pendientes.length === 0
            ? 'No hay nada esperando. El stock está al día.'
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

      <section className="grid gap-3">
        <h2 className="aq-micro text-secundario">Inventario</h2>

        {/*
          En un teléfono, una tabla de cuatro columnas obliga a scrollear en
          horizontal para leer una fila. Estas son tarjetas apiladas que pasan a
          grilla cuando hay ancho.
        */}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stock.map((p) => (
            <li key={p.productoId}>
              {/*
                La tarjeta es un ENLACE, y eso vino junto con la animación.
                Levantarla al pasar el mouse enseña que se puede tocar; si no
                llevara a ningún lado, esa promesa sería falsa. Y llevar sí
                tiene sentido: desde el tablero, lo siguiente que se quiere ver
                de un producto son sus lotes.
              */}
              <Link href={`/modulos/stock/${p.productoId}`} className="aq-tarjeta block p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-principal">{p.nombre}</p>
                  <p className="aq-cifra text-[13px] text-secundario">{p.codigo}</p>
                </div>
                <Boxes aria-hidden className="size-5 shrink-0 text-secundario" />
              </div>

              <p className="mt-3 flex items-baseline gap-2">
                <span className="aq-cifra text-2xl font-semibold text-principal">{p.vendible}</span>
                <span className="text-[13px] text-secundario">para vender</span>
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
      </section>
    </div>
  )
}

/** «3 productos» / «1 producto» — sin el «(s)» que nadie escribe hablando. */
function contar(cantidad: number, sustantivo: string): string {
  return `${cantidad} ${sustantivo}${cantidad === 1 ? '' : 's'}`
}

function primerNombre(nombre: string | undefined): string {
  return nombre?.trim().split(' ')[0] ?? 'de nuevo'
}
