import Link from 'next/link'
import { AltaDeProducto } from '@/components/productos/alta-producto'
import { GestionDeProducto } from '@/components/productos/gestion-producto'
import { apiServerFetch } from '@/lib/api-server'
import type { Producto } from '@/lib/api-types'

/**
 * Gestión del catálogo — solo `admin` (RN-CAT-06).
 *
 * El acceso lo decide `api/`: si un rol sin permiso llega hasta acá,
 * `apiServerFetch` recibe 403 y lanza. Esta página no vuelve a chequear el rol
 * porque hacerlo sugeriría que ESA es la barrera, y no lo es.
 *
 * Se listan también los desactivados: son justamente los que hay que poder
 * reactivar, y los que el seed dejó esperando precio.
 */
export default async function GestionDeCatalogoPage() {
  const productos = await apiServerFetch<Producto[]>('/productos?estado=todos')

  return (
    <div className="grid gap-6">
      <header>
        <Link
          href="/modulos/productos"
          className="text-sm text-neutral-400 underline underline-offset-4"
        >
          ← Volver al catálogo
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Gestionar catálogo</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Todo cambio de precio queda registrado en la auditoría, con el valor anterior y el nuevo.
        </p>
      </header>

      <AltaDeProducto />

      <section className="grid gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Productos ({productos.length})
        </h2>

        {productos.map((producto) => (
          <GestionDeProducto key={producto.id} producto={producto} />
        ))}
      </section>
    </div>
  )
}
