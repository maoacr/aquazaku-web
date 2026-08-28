'use client'

import { Box } from 'lucide-react'
import { useActionState, useId } from 'react'
import {
  comprarBasesAction,
  darDeAltaBaseAction,
  descartarBaseAction,
  marcarBaseDanadaAction,
  type EstadoDeFormulario,
  prestarBaseAction,
  retornarBaseAction,
} from '@/app/(app)/modulos/retornables/actions'
import { FormError } from '@/components/auth/form-error'
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

              {/*
                Las acciones que se ofrecen son las que el servidor va a
                aceptar, y nada más.

                Una base PRESTADA puede volver o romperse — el daño se le cobra
                a quien la tiene, así que en bodega no hay a quién cobrarle
                (`BASE_EN_BODEGA`). Una base EN BODEGA puede descartarse —
                descartar una prestada dejaría un préstamo abierto sobre algo
                que ya no existe (`BASE_PRESTADA`).

                Mostrar el botón igual y dejar que el servidor rechace sería
                prometer algo que no se puede hacer.
              */}
              <div className="flex flex-wrap gap-2">
                {direccion ? (
                  <>
                    <RetornarBase base={base} />
                    {base.estado === 'sana' ? <MarcarDano base={base} /> : null}
                  </>
                ) : (
                  <DescartarBase base={base} />
                )}

                <a
                  href={`/modulos/retornables/bases/${base.id}`}
                  className="aq-boton aq-boton-secundario aq-boton-compacto"
                >
                  Historial
                </a>
              </div>
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
 * Se rompió — RN-BAS-08.
 *
 * ── El monto se pide, no se supone ──────────────────────────────────────────
 *
 * La regla habla de un «valor de reposición configurable por SKU», pero el
 * dominio no dice cuál es. Un default acá lo estaría inventando, y es plata que
 * se le cobra a un cliente real: peor que pedirlo cada vez.
 *
 * ── Va detrás de un `details` ───────────────────────────────────────────────
 *
 * Es la operación menos frecuente de la tarjeta y la única que genera un cobro.
 * Un formulario de tres campos abierto en cada base prestada convertiría la
 * lista en un muro, y tener el botón de cobrar siempre a la vista invita a
 * usarlo sin querer.
 */
function MarcarDano({ base }: { base: Base }) {
  const [estado, accion, enviando] = useActionState(marcarBaseDanadaAction, INICIAL)

  useAvisoDeExito(estado)

  return (
    <details className="w-full">
      <summary className="aq-boton aq-boton-secundario aq-boton-compacto cursor-pointer list-none">
        Se rompió
      </summary>

      <form action={accion} className="mt-3 grid gap-3">
        <input type="hidden" name="baseId" value={base.id} />
        <FormError id={`dano-${base.id}`}>{estado.error}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="aq-etiqueta-campo">
            <span>Cuánto se le cobra</span>
            <input
              name="monto"
              required
              inputMode="decimal"
              placeholder="80000"
              className="aq-campo aq-cifra w-32"
            />
          </label>

          <label className="aq-etiqueta-campo">
            <span>Cómo paga</span>
            <select name="medioDePago" className="aq-campo" defaultValue="efectivo">
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="credito">Crédito</option>
            </select>
          </label>
        </div>

        <label className="aq-etiqueta-campo">
          <span>Qué pasó</span>
          <input
            name="motivo"
            required
            placeholder="Se cayó del mostrador y se partió el soporte del grifo"
            className="aq-campo"
          />
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="aq-boton aq-boton-secundario justify-self-start"
        >
          {enviando ? 'Registrando…' : 'Registrar el daño y el recargo'}
        </button>
      </form>
    </details>
  )
}

/**
 * Descartar — RN-BAS-06.
 *
 * El motivo es obligatorio y no es burocracia: después de esto la base sale del
 * parque y nadie vuelve a preguntar por ella. Este texto es lo único que queda
 * para entender qué pasó dentro de tres meses.
 *
 * No borra la fila: la base desaparece de las listas pero su historial —y su
 * recargo, si lo tuvo— siguen ahí. Borrarla dejaría un cargo en la cartera de
 * un cliente sin nada que lo explique.
 */
function DescartarBase({ base }: { base: Base }) {
  const [estado, accion, enviando] = useActionState(descartarBaseAction, INICIAL)

  useAvisoDeExito(estado)

  return (
    <details className="w-full">
      <summary className="aq-boton aq-boton-secundario aq-boton-compacto cursor-pointer list-none">
        Descartar
      </summary>

      <form action={accion} className="mt-3 grid gap-3">
        <input type="hidden" name="baseId" value={base.id} />
        <FormError id={`descarte-${base.id}`}>{estado.error}</FormError>

        <label className="aq-etiqueta-campo">
          <span>Por qué sale del parque</span>
          <input
            name="motivo"
            required
            placeholder="El soporte partido no tiene arreglo"
            className="aq-campo"
          />
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="aq-boton aq-boton-secundario justify-self-start"
        >
          {enviando ? 'Descartando…' : 'Sacar del parque'}
        </button>
      </form>
    </details>
  )
}

/**
 * Comprar bases — RN-BAS-10.
 *
 * Espeja «Entraron botellones nuevos»: los dos activos entran al parque por una
 * compra con cantidad. Cargar cuarenta de a una son cuarenta operaciones que
 * pueden cortarse por la mitad, y con los stickers ya impresos el hueco queda
 * en la caja, no en la pantalla.
 *
 * No pide sticker: una base comprada llega sin rotular. El sistema la numera y
 * la respuesta dice desde qué número imprimir.
 */
export function ComprarBases({ proximo }: { proximo: string | null }) {
  const [estado, accion, enviando] = useActionState(comprarBasesAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Entraron bases nuevas</h2>
        <p className="mt-1 text-[13px] text-tenue">
          {proximo
            ? `Se numeran solas desde la ${proximo}, en orden. Después se imprimen los stickers con esos números.`
            : 'Se numeran solas, en orden. Después se imprimen los stickers con esos números.'}
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo">
          <span>Cuántas</span>
          <input
            name="cantidad"
            type="number"
            required
            min="1"
            step="1"
            className="aq-campo aq-cifra"
          />
        </label>

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario">
          {enviando ? 'Registrando…' : 'Registrar'}
        </button>
      </div>
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
