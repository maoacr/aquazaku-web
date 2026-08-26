'use client'

import { useAvisoDeExito } from '@/lib/formulario-cliente'
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
  useAvisoDeExito(precios)
  const [estado, cambiarEstado, cambiando] = useActionState(cambiarEstadoAction, INICIAL)
  useAvisoDeExito(estado)

  // Dos motivos distintos por los que un producto no se vende, y cada uno pide
  // una acción distinta. Mostrar solo el primero deja al admin creyendo que
  // terminó cuando todavía le falta un click.
  const sinPrecio = Number(producto.precioResidencial) === 0
  const listoPeroApagado = !producto.activo && !sinPrecio

  return (
    <article className="grid gap-4 rounded-lg border border-sutil p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-medium">{producto.nombre}</h3>
          <p className="aq-cifra text-sm text-tenue">{producto.codigo}</p>
        </div>
        {producto.activo ? (
          <Etiqueta tono="ok">activo</Etiqueta>
        ) : (
          <Etiqueta tono="neutro">desactivado</Etiqueta>
        )}
      </header>

      {sinPrecio ? (
        <p className="rounded border border-alerta-borde bg-alerta-fondo px-3 py-2 text-sm text-alerta-texto">
          Este producto está esperando su precio real. No se puede vender hasta que lo cargues{' '}
          <strong>y lo actives</strong>: son dos pasos.
        </p>
      ) : null}

      {listoPeroApagado ? (
        <p className="rounded border border-alerta-borde bg-alerta-fondo px-3 py-2 text-sm text-alerta-texto">
          Ya tiene precio, pero sigue desactivado: <strong>todavía no se puede vender</strong>.
          Activalo con el botón de abajo.
        </p>
      ) : null}

      <form action={guardarPrecios} className="grid gap-3">
        <input type="hidden" name="id" value={producto.id} />

        <FormError id={`precios-${producto.id}`}>{precios.error}</FormError>
        <CamposDePrecio producto={producto} />

        <div>
          <button
            type="submit"
            disabled={guardando}
            className="aq-boton aq-boton-primario aq-boton-compacto"
          >
            {guardando ? 'Guardando…' : 'Guardar precios'}
          </button>
        </div>
      </form>

      {/*
        Desactivar es un form y no un link: cambia estado del servidor. Un GET
        que muta es la clase de cosa que un prefetch del browser dispara solo.
      */}
      <form action={cambiarEstado} className="border-t border-sutil pt-3">
        <input type="hidden" name="id" value={producto.id} />
        <input type="hidden" name="activar" value={producto.activo ? 'no' : 'si'} />

        <FormError id={`estado-${producto.id}`}>{estado.error}</FormError>
        <button
          type="submit"
          disabled={cambiando}
          className="text-sm text-secundario underline underline-offset-4 hover:text-principal disabled:opacity-50"
        >
          {producto.activo ? 'Desactivar producto' : 'Reactivar producto'}
        </button>
      </form>
    </article>
  )
}
