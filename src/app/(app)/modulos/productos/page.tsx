import Link from 'next/link'
import { TablaDeProductos } from '@/components/productos/tabla-productos'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type { Producto } from '@/lib/api-types'

/**
 * Catálogo — lo ven los cuatro roles.
 *
 * Un `pos` que no ve precios no puede vender, y el `contador` los necesita para
 * leer un comprobante (RN-CAT-06). Escribir es otra pantalla y otro permiso.
 *
 * El link a gestión se muestra solo si el usuario tiene el permiso, pero eso es
 * cosmética (RN-ACC-02): quien entre a la URL a mano igual recibe 403 de `api/`.
 */
export default async function ProductosPage() {
  const [productos, usuario] = await Promise.all([
    apiServerFetch<Producto[]>('/productos?estado=todos'),
    getServerUser(),
  ])

  const puedeGestionar = usuario?.permisos.includes('productos:editar_precios') ?? false

  // Lo que importa no es si falta el precio: es si el producto se puede vender.
  // Un producto con precio cargado pero desactivado tampoco se vende, y ese
  // caso es más fácil de pasar por alto — el aviso de "falta precio" ya se
  // apagó y solo queda una etiqueta gris.
  const noVendibles = productos.filter((p) => !p.activo)
  const esperandoPrecio = noVendibles.filter((p) => Number(p.precioResidencial) === 0)
  const soloFaltaActivar = noVendibles.length - esperandoPrecio.length

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Qué se vende, con su equivalencia en litros y sus precios por tipo de cliente.
          </p>
        </div>

        {puedeGestionar ? (
          <Link
            href="/modulos/productos/gestion"
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900"
          >
            Gestionar catálogo
          </Link>
        ) : null}
      </header>

      {noVendibles.length > 0 ? (
        <div className="grid gap-1 rounded border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          <p className="font-medium">
            {noVendibles.length === 1
              ? '1 producto no se puede vender todavía.'
              : `${noVendibles.length} productos no se pueden vender todavía.`}
          </p>
          {esperandoPrecio.length > 0 ? (
            <p className="text-amber-400/80">
              {esperandoPrecio.map((p) => p.codigo).join(', ')} — esperando precio.
            </p>
          ) : null}
          {soloFaltaActivar > 0 ? (
            <p className="text-amber-400/80">
              {soloFaltaActivar === 1
                ? '1 ya tiene precio cargado: solo falta activarlo.'
                : `${soloFaltaActivar} ya tienen precio cargado: solo falta activarlos.`}
            </p>
          ) : null}
        </div>
      ) : null}

      <TablaDeProductos productos={productos} />
    </div>
  )
}
