'use client'

import { Box } from 'lucide-react'
import { useActionState, useId } from 'react'
import {
  darDeAltaBaseAction,
  type EstadoDeFormulario,
  prestarBaseAction,
  retornarBaseAction,
} from '@/app/(app)/modulos/retornables/actions'
import { FormError } from '@/components/auth/form-error'
import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import { Vacio } from '@/components/ui/vacio'
import type { Base, Cliente, Direccion } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

/**
 * Las bases — el activo que SÍ tiene identidad.
 *
 * Cada una se muestra con su sticker en mono, porque es un código que alguien va
 * a comparar contra el que está pegado en la base física.
 */
export function ListaDeBases({
  bases,
  direcciones,
}: {
  bases: Base[]
  direcciones: (Direccion & { cliente?: Cliente })[]
}) {
  if (bases.length === 0) {
    return (
      <Vacio variante="primera-vez" icono={Box} titulo="Todavía no hay bases">
        Cada base lleva un sticker con su ID. Es lo único que permite saber a cuál
        dirección ir a buscarla.
      </Vacio>
    )
  }

  const dondeEsta = (base: Base) =>
    direcciones.find((d) => d.id === base.direccionId)

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {bases.map((base) => {
        const direccion = dondeEsta(base)

        return (
          <li key={base.id}>
            <article className="aq-tarjeta grid h-full gap-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="aq-cifra text-[17px] font-semibold text-principal">
                  {base.idSticker}
                </p>
                {base.estado === 'danada' ? (
                  <Estado tono="expuesto">Dañada</Estado>
                ) : direccion ? (
                  <Estado tono="justo">Prestada</Estado>
                ) : (
                  <Estado tono="cubierto">En bodega</Estado>
                )}
              </div>

              {/*
                Dónde está, y no de quién es. La base se asigna a una DIRECCIÓN
                (RN-BAS-03) porque hay que ir a buscarla a un lugar concreto.
              */}
              <p className="text-[14px] text-secundario">
                {direccion
                  ? `${direccion.etiqueta} — ${direccion.direccion}`
                  : 'En la bodega, lista para prestar'}
              </p>

              {direccion ? <RetornarBase base={base} /> : null}
            </article>
          </li>
        )
      })}
    </ul>
  )
}

function RetornarBase({ base }: { base: Base }) {
  const [estado, accion, enviando] = useActionState(retornarBaseAction, INICIAL)

  useAvisoDeExito(estado)

  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="baseId" value={base.id} />
      <FormError id={`retorno-${base.id}`}>{estado.error}</FormError>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Volvió a la bodega'}
      </button>
    </form>
  )
}

/**
 * Alta de una base — RN-BAS-10.
 *
 * ── El número viene puesto, y se puede pisar ────────────────────────────────
 *
 * `proximo` llega del servidor, no se calcula acá. La regla —máximo + 1, sin
 * reciclar descartados— vive en un solo lugar; una copia en este componente
 * empezaría a proponer números ya tomados el día que la regla cambie, y el alta
 * fallaría con un duplicado que el operario no pidió.
 *
 * Va como `defaultValue` y no como `placeholder` porque los dos caminos son
 * reales y el más común hoy es **pisarlo**: Aquazaku tiene 40 bases con el
 * rótulo pegado. Un placeholder obligaría a tipear siempre; un valor por
 * defecto deja rotular una base nueva sin tocar el campo, y registrar una vieja
 * escribiendo encima.
 */
export function DarDeAltaBase({ proximo }: { proximo: string | null }) {
  const [estado, accion, enviando] = useActionState(darDeAltaBaseAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Dar de alta una base</h2>
        <p className="mt-1 text-[13px] text-tenue">
          {proximo
            ? `Son cuatro dígitos. Si la base ya viene con el sticker pegado, escriba ese número encima del ${proximo}.`
            : 'Son cuatro dígitos, con los ceros adelante: 0001, 0040, 0913.'}
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo">
          <span>ID del sticker</span>
          <input
            name="idSticker"
            required
            autoComplete="off"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            defaultValue={proximo ?? ''}
            placeholder="0913"
            className="aq-campo aq-cifra"
          />
        </label>

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario">
          {enviando ? 'Dando de alta…' : 'Dar de alta'}
        </button>
      </div>
    </form>
  )
}

/**
 * Prestar — RN-BAS-07.
 *
 * Solo aparecen las bases que están en la bodega: una base está en exactamente
 * un lugar, y ofrecer una ya prestada prometería algo que el servidor rechaza.
 */
export function PrestarBase({
  bases,
  direcciones,
}: {
  bases: Base[]
  direcciones: (Direccion & { cliente?: Cliente })[]
}) {
  const [estado, accion, enviando] = useActionState(prestarBaseAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  const enBodega = bases.filter((b) => b.direccionId === null && b.estado === 'sana')

  if (enBodega.length === 0 || direcciones.length === 0) return null

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Prestar una base</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Va a una dirección, no a un cliente: es a donde hay que ir a buscarla. El cliente
          tiene que estar verificado.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Base</span>
          <select name="baseId" required defaultValue="" className="aq-campo">
            <option value="">Elija una</option>
            {enBodega.map((b) => (
              <option key={b.id} value={b.id}>
                {b.idSticker}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>A qué dirección</span>
          <select name="direccionId" required defaultValue="" className="aq-campo">
            <option value="">Elija una</option>
            {direcciones.map((d) => (
              <option key={d.id} value={d.id}>
                {d.cliente?.nombre ? `${d.cliente.nombre} — ` : ''}
                {d.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Prestando…' : 'Prestar'}
      </button>
    </form>
  )
}
