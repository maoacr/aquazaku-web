'use client'

import { useActionState } from 'react'
import {
  cambiarEstadoAction,
  editarPreciosAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/productos/actions'
import { FormError } from '@/components/auth/form-error'
import { CamposDePrecio } from '@/components/productos/alta-producto'
import { Etiqueta } from '@/components/ui/tabla'
import type { Producto } from '@/lib/api-types'

const INICIAL: EstadoDeFormulario = {}

/**
 * Una tarjeta por producto, con sus precios editables y el botón de estado.
 *
 * Cada producto tiene su propio `useActionState`: con uno compartido, el error
 * de editar una paca aparecería debajo del botellón.
 */
export function GestionDeProducto({ producto }: { producto: Producto }) {
  const [precios, guardarPrecios, guardando] = useActionState(editarPreciosAction, INICIAL)
  const [estado, cambiarEstado, cambiando] = useActionState(cambiarEstadoAction, INICIAL)

  // Dos motivos distintos por los que un producto no se vende, y cada uno pide
  // una acción distinta. Mostrar solo el primero deja al admin creyendo que
  // terminó cuando todavía le falta un click.
  const sinPrecio = Number(producto.precioResidencial) === 0
  const listoPeroApagado = !producto.activo && !sinPrecio

  return (
    <article className="grid gap-4 rounded-lg border border-neutral-800 p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-medium">{producto.nombre}</h3>
          <p className="font-mono text-xs text-neutral-500">{producto.codigo}</p>
        </div>
        {producto.activo ? (
          <Etiqueta tono="ok">activo</Etiqueta>
        ) : (
          <Etiqueta tono="neutro">desactivado</Etiqueta>
        )}
      </header>

      {sinPrecio ? (
        <p className="rounded border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          Este producto está esperando su precio real. No se puede vender hasta que lo cargues{' '}
          <strong>y lo actives</strong>: son dos pasos.
        </p>
      ) : null}

      {listoPeroApagado ? (
        <p className="rounded border border-amber-900 bg-amber-950/40 px-3 py-2 text-sm text-amber-300">
          Ya tiene precio, pero sigue desactivado: <strong>todavía no se puede vender</strong>.
          Activalo con el botón de abajo.
        </p>
      ) : null}

      <form action={guardarPrecios} className="grid gap-3">
        <input type="hidden" name="id" value={producto.id} />

        <FormError id={`precios-${producto.id}`}>{precios.error}</FormError>
        {precios.ok ? (
          <p role="status" className="text-sm text-emerald-400">
            {precios.ok}
          </p>
        ) : null}

        <CamposDePrecio producto={producto} />

        <div>
          <button
            type="submit"
            disabled={guardando}
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar precios'}
          </button>
        </div>
      </form>

      {/*
        Desactivar es un form y no un link: cambia estado del servidor. Un GET
        que muta es la clase de cosa que un prefetch del browser dispara solo.
      */}
      <form action={cambiarEstado} className="border-t border-neutral-800 pt-3">
        <input type="hidden" name="id" value={producto.id} />
        <input type="hidden" name="activar" value={producto.activo ? 'no' : 'si'} />

        <FormError id={`estado-${producto.id}`}>{estado.error}</FormError>
        {estado.ok ? (
          <p role="status" className="mb-2 text-sm text-emerald-400">
            {estado.ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={cambiando}
          className="text-sm text-neutral-400 underline underline-offset-4 hover:text-neutral-200 disabled:opacity-50"
        >
          {producto.activo ? 'Desactivar producto' : 'Reactivar producto'}
        </button>
      </form>
    </article>
  )
}
