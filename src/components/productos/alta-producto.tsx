'use client'

import { useActionState } from 'react'
import { crearProductoAction, type EstadoDeFormulario } from '@/app/(app)/modulos/productos/actions'
import { FormError } from '@/components/auth/form-error'

const INICIAL: EstadoDeFormulario = {}

const campo = 'rounded border border-fuerte bg-transparent px-2 py-1.5'

/**
 * Alta de producto.
 *
 * Client Component porque necesita `useActionState`: sin él, lo que devuelve la
 * Server Action se descarta y el admin no ve ni el error ni el código generado.
 *
 * No hay campo de código: lo genera `api/` a partir de la presentación, el
 * contenido y las unidades (RN-CAT-11). Un código escrito a mano termina con
 * variantes —`P20U600ML`, `p20u_600ml`— y después nadie puede buscar.
 */
export function AltaDeProducto() {
  const [estado, accion, enviando] = useActionState(crearProductoAction, INICIAL)

  return (
    <form action={accion} className="grid gap-4 rounded-lg border border-sutil p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-secundario">
        Nuevo producto
      </h2>

      <FormError id="alta-producto-error">{estado.error}</FormError>
      {estado.ok ? (
        <p role="status" className="text-sm text-exito-texto">
          {estado.ok}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Nombre</span>
          <input name="nombre" required autoComplete="off" className={campo} />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Presentación</span>
          <select name="presentacion" required defaultValue="paca" className={campo}>
            <option value="paca">Paca</option>
            <option value="botellon">Botellón</option>
          </select>
        </label>

        <label className="grid gap-1 text-sm">
          <span>Contenido unitario (ml)</span>
          <input
            name="contenidoMl"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            className={campo}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span>Unidades</span>
          {/* El botellón lleva 1: siempre es uno y no distingue nada. */}
          <input
            name="unidades"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={1}
            required
            className={campo}
          />
        </label>
      </div>

      <CamposDePrecio />

      <div>
        <button
          type="submit"
          disabled={enviando}
          className="rounded bg-accion px-3 py-1.5 text-sm font-medium text-invertido disabled:opacity-50"
        >
          {enviando ? 'Creando…' : 'Crear producto'}
        </button>
      </div>
    </form>
  )
}

/**
 * Los tres precios, siempre juntos.
 *
 * `api/` los exige así: cambiar uno solo obligaría a leer los otros dos para
 * verificar el piso, abriendo una ventana entre esa lectura y la escritura.
 */
export function CamposDePrecio({ producto }: { producto?: {
  precioResidencial: string
  precioComercial: string
  precioMinimo: string
} }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">
        <span>Precio residencial</span>
        <input
          name="precioResidencial"
          inputMode="decimal"
          pattern="\d+(\.\d{1,2})?"
          required
          defaultValue={producto?.precioResidencial}
          className={campo}
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span>Precio comercial</span>
        <input
          name="precioComercial"
          inputMode="decimal"
          pattern="\d+(\.\d{1,2})?"
          required
          defaultValue={producto?.precioComercial}
          className={campo}
        />
      </label>

      <label className="grid gap-1 text-sm">
        <span>
          Precio mínimo
          <span className="ml-1 text-sm text-tenue">(piso absoluto)</span>
        </span>
        <input
          name="precioMinimo"
          inputMode="decimal"
          pattern="\d+(\.\d{1,2})?"
          required
          defaultValue={producto?.precioMinimo}
          className={campo}
        />
      </label>
    </div>
  )
}
