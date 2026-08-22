import Link from 'next/link'
import { TablaDeProductos } from '@/components/productos/tabla-productos'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type { Producto } from '@/lib/api-types'
import { analizarVendibilidad, avisoDeNoVendibles, necesitaDesglose } from '@/lib/productos'

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

  const vendibilidad = analizarVendibilidad(productos)
  const { noVendibles, esperandoPrecio, soloFaltaActivar } = vendibilidad

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aq-titulo-pantalla text-principal">Productos</h1>
          <p className="mt-1 text-sm text-tenue">
            Qué se vende, con su equivalencia en litros y sus precios por tipo de cliente.
          </p>
        </div>

        {puedeGestionar ? (
          <Link
            href="/modulos/productos/gestion"
            className="aq-boton aq-boton-primario aq-boton-compacto"
          >
            Gestionar catálogo
          </Link>
        ) : null}
      </header>

      {noVendibles.length > 0 ? (
        <div className="grid gap-1 rounded border border-alerta-borde bg-alerta-fondo px-3 py-2 text-sm text-alerta-texto">
          <p className="font-medium">{avisoDeNoVendibles(noVendibles.length, esperandoPrecio.length)}</p>

          {/*
            El desglose aparece SOLO cuando conviven los dos motivos. Con un
            motivo único, el resumen ya lo dijo todo y repetirlo es ruido: el
            lector busca la diferencia entre las dos líneas y no la encuentra.
          */}
          {necesitaDesglose(vendibilidad) ? (
            <p className="text-alerta-texto/80">
              Esperando precio: {esperandoPrecio.map((p) => p.codigo).join(', ')}. Los otros{' '}
              {soloFaltaActivar === 1 ? 'ya tiene precio' : 'ya tienen precio'} y solo falta
              activar{soloFaltaActivar === 1 ? 'lo' : 'los'}.
            </p>
          ) : null}
        </div>
      ) : null}

      <TablaDeProductos productos={productos} />
    </div>
  )
}
