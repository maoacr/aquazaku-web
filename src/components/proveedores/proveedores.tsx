'use client'

import { Truck } from 'lucide-react'
import { useActionState, useId, useState } from 'react'
import {
  cambiarEstadoAction,
  crearProveedorAction,
  type EstadoDeFormulario,
  marcarPagadaAction,
  registrarCompraAction,
} from '@/app/(app)/modulos/proveedores/actions'
import { FormError } from '@/components/auth/form-error'
import { Estado } from '@/components/ui/estado'
import { Vacio } from '@/components/ui/vacio'
import type { InsumoListado, Proveedor } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

export function ListaDeProveedores({
  proveedores,
  puedeEditar,
}: {
  proveedores: Proveedor[]
  puedeEditar: boolean
}) {
  if (proveedores.length === 0) {
    return (
      <Vacio variante="primera-vez" icono={Truck} titulo="Todavía no hay proveedores">
        Un proveedor es a quién se le compran tapas, sellos, bolsas, botellones o bases. El agua
        no: esa se produce en planta.
      </Vacio>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {proveedores.map((p) => (
        <li key={p.id}>
          <article className="aq-tarjeta grid h-full gap-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[15px] font-semibold text-principal">{p.nombre}</p>
              {p.activo ? null : <Estado tono="expuesto">Desactivado</Estado>}
            </div>

            {p.nit ? <p className="aq-cifra text-[13px] text-tenue">NIT {p.nit}</p> : null}
            {p.contacto ? <p className="text-[14px] text-secundario">{p.contacto}</p> : null}

            {puedeEditar ? <CambiarEstado proveedor={p} /> : null}
          </article>
        </li>
      ))}
    </ul>
  )
}

/**
 * Activar o desactivar — RN-PRO-01.
 *
 * Un proveedor no se borra: su historial de compras le sigue apuntando, y
 * borrarlo dejaría compras sin decir a quién se le pagaron.
 *
 * Reactivar está a un clic porque el caso real es «le volvimos a comprar»: la
 * compra a un inactivo se rechaza, y el camino correcto es reactivarlo, no
 * crear un duplicado con el mismo NIT.
 */
function CambiarEstado({ proveedor }: { proveedor: Proveedor }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoAction, INICIAL)

  useAvisoDeExito(estado)

  return (
    <form action={accion} className="grid gap-2">
      <input type="hidden" name="proveedorId" value={proveedor.id} />
      <input type="hidden" name="activo" value={proveedor.activo ? 'no' : 'si'} />
      <FormError id={`estado-${proveedor.id}`}>{estado.error}</FormError>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        {enviando ? 'Guardando…' : proveedor.activo ? 'Desactivar' : 'Volver a activar'}
      </button>
    </form>
  )
}

export function CrearProveedor() {
  const [estado, accion, enviando] = useActionState(crearProveedorAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Cargar un proveedor</h2>
        {/*
          El NIT es opcional a propósito: un proveedor puede ser el señor que
          trae las tapas en su camioneta. Exigirlo llevaría a inventar uno.
        */}
        <p className="mt-1 text-[13px] text-tenue">
          Solo hace falta el nombre. El NIT y el contacto se cargan si se tienen.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[14rem] flex-1">
          <span>Nombre</span>
          <input name="nombre" required placeholder="Plásticos del Caribe" className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>
            NIT <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input name="nit" inputMode="numeric" className="aq-campo aq-cifra w-36" />
        </label>

        <label className="aq-etiqueta-campo min-w-[12rem] flex-1">
          <span>
            Contacto <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input name="contacto" placeholder="300 555 1234" className="aq-campo" />
        </label>

        <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario">
          {enviando ? 'Cargando…' : 'Cargar'}
        </button>
      </div>
    </form>
  )
}

/** Lo que se puede comprar. El agua NO: esa se produce en planta. */
type Renglon =
  | { que: 'insumo'; insumoId: string; cantidad: number; kilos?: number; costoUnitario: string }
  | { que: 'botellones'; cantidad: number; costoUnitario: string }
  | { que: 'bases'; cantidad: number; costoUnitario: string }

/**
 * Registrar una compra — RN-PRO-05.
 *
 * ── Una línea compra exactamente UNA cosa ──────────────────────────────────
 *
 * Por eso el formulario arranca eligiendo QUÉ, y recién ahí muestra los campos
 * que corresponden. Una línea que sea insumo y botellón a la vez no se puede
 * convertir en movimiento de inventario sin adivinar cuál, y el servidor la
 * rechaza — ofrecerla sería prometer algo que no se puede hacer.
 */
export function RegistrarCompra({
  proveedores,
  insumos,
}: {
  proveedores: Proveedor[]
  insumos: InsumoListado[]
}) {
  const [estado, accion, enviando] = useActionState(registrarCompraAction, INICIAL)
  const idError = useId()

  const [proveedorId, setProveedorId] = useState('')
  const [medioDePago, setMedioDePago] = useState('efectivo')
  const [que, setQue] = useState<Renglon['que']>('insumo')
  const [insumoId, setInsumoId] = useState('')
  const [cantidad, setCantidad] = useState(0)
  const [porKilo, setPorKilo] = useState(false)
  const [costoUnitario, setCostoUnitario] = useState('')

  useAvisoDeExito(estado)

  const activos = proveedores.filter((p) => p.activo)
  const aCredito = medioDePago === 'credito'

  const linea =
    que === 'insumo'
      ? {
          insumoId,
          cantidad,
          ...(porKilo && { kilos: cantidad }),
          costoUnitario,
        }
      : { [que]: cantidad, cantidad, costoUnitario }

  const completa =
    proveedorId !== '' &&
    cantidad > 0 &&
    costoUnitario !== '' &&
    (que !== 'insumo' || insumoId !== '')

  return (
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-5 p-5">
      <input type="hidden" name="lineas" value={JSON.stringify(completa ? [linea] : [])} />
      <input type="hidden" name="proveedorId" value={proveedorId} />
      <input type="hidden" name="medioDePago" value={medioDePago} />

      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Registrar una compra</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Lo que se registra es lo que <strong>llegó</strong>, no lo que se pidió. La mercadería
          entra al inventario en el mismo momento.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo min-w-[14rem] flex-1">
          <span>Proveedor</span>
          <select
            value={proveedorId}
            onChange={(e) => setProveedorId(e.target.value)}
            className="aq-campo"
          >
            <option value="">Elija uno</option>
            {activos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Qué llegó</span>
          <select
            value={que}
            onChange={(e) => {
              setQue(e.target.value as Renglon['que'])
              setPorKilo(false)
            }}
            className="aq-campo"
          >
            <option value="insumo">Un insumo</option>
            <option value="botellones">Botellones</option>
            <option value="bases">Bases</option>
          </select>
        </label>

        {que === 'insumo' ? (
          <label className="aq-etiqueta-campo min-w-[12rem] flex-1">
            <span>Cuál</span>
            <select
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              className="aq-campo"
            >
              <option value="">Elija uno</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="aq-etiqueta-campo">
          <span>{porKilo ? 'Kilos' : 'Cuántos'}</span>
          <input
            type="number"
            min={0}
            step={porKilo ? '0.001' : '1'}
            value={cantidad || ''}
            onChange={(e) => setCantidad(Number(e.target.value))}
            className="aq-campo aq-cifra w-28"
          />
        </label>

        {/*
          Las bolsas se compran al peso y se guardan por unidad (RN-INS-02). La
          conversión la hace el servidor con la equivalencia del insumo, y deja
          los kilos, la equivalencia usada y las unidades en el movimiento — sin
          eso, un descuadre sería imposible de reconstruir.
        */}
        {que === 'insumo' ? (
          <label className="aq-ficha">
            <input
              type="checkbox"
              checked={porKilo}
              onChange={(e) => setPorKilo(e.target.checked)}
              className="sr-only"
            />
            <span className="aq-ficha-caja" aria-hidden />
            Vino por kilo
          </label>
        ) : null}

        <label className="aq-etiqueta-campo">
          <span>Costo por unidad</span>
          <input
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            inputMode="decimal"
            placeholder="18000"
            className="aq-campo aq-cifra w-32"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Cómo se pagó</span>
          <select
            value={medioDePago}
            onChange={(e) => setMedioDePago(e.target.value)}
            className="aq-campo"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="credito">Crédito</option>
          </select>
        </label>

        {/*
          La fecha aparece SOLO a crédito, y es obligatoria ahí — RN-PRO-07. No
          se estima con un plazo por defecto: la dice el proveedor. Y lo que se
          paga de contado no vence, así que el campo no tendría qué significar.
        */}
        {aCredito ? (
          <label className="aq-etiqueta-campo">
            <span>Vence el</span>
            <input type="date" name="venceEl" required className="aq-campo" />
          </label>
        ) : null}
      </div>

      {aCredito ? (
        <p className="text-[13px] text-tenue">
          Hoy Aquazaku paga todo de contado o por transferencia. Si un proveedor fía, esta compra
          va a aparecer en el aviso de vencidas el día que pase la fecha.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando || !completa}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar la compra'}
      </button>
    </form>
  )
}

/** Marcar pagada — una de las dos únicas transiciones que la compra permite. */
export function MarcarPagada({ compraId }: { compraId: string }) {
  const [estado, accion, enviando] = useActionState(marcarPagadaAction, INICIAL)

  useAvisoDeExito(estado)

  return (
    <form action={accion}>
      <input type="hidden" name="compraId" value={compraId} />
      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario aq-boton-compacto"
      >
        {enviando ? 'Registrando…' : 'Ya se pagó'}
      </button>
    </form>
  )
}
