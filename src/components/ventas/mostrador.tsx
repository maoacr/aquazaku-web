'use client'

import { Minus, Plus, Trash2 } from 'lucide-react'
import { useActionState, useId, useState } from 'react'
import { type EstadoDeVenta, registrarVentaAction } from '@/app/(app)/modulos/ventas/actions'
import { FormError } from '@/components/auth/form-error'
import { Cifra } from '@/components/stock/cifra'
import type { Cliente, Producto, ResumenDeStock } from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeVenta = {}

/**
 * El mostrador — RN-VEN-09, RN-VEN-12 y RN-VEN-13.
 *
 * ── Muestra el total ANTES de cobrar ────────────────────────────────────────
 *
 * Es la misma decisión que la vista previa del cierre de producción: quien está
 * del otro lado va a pagar ese número, y descubrirlo después de confirmar es
 * tarde. Acá además cambia con el tipo de cliente, así que elegirlo tiene que
 * verse reflejado en el momento.
 *
 * ── El total de la pantalla es una ESTIMACIÓN, y se dice ────────────────────
 *
 * El total real lo calcula `api/` con los precios y el piso de cada producto en
 * el momento de la venta. Este de acá usa el catálogo que se trajo al cargar la
 * página, que puede tener minutos. Coinciden casi siempre — y cuando no, manda
 * el del servidor.
 *
 * Prometerlo como exacto sería el mismo error que un saldo de stock en pantalla
 * presentado como verdad: se lee de hace un rato.
 *
 * ── No hay reserva de stock ─────────────────────────────────────────────────
 *
 * El aviso de «no alcanza» de acá es informativo. Quien decide es el descuento
 * atómico del servidor, y si dos personas van por la última unidad una recibe
 * el rechazo con el número real. Ver la spec de M6.
 */
export function Mostrador({
  productos,
  stock,
  clientes,
}: {
  productos: Producto[]
  stock: ResumenDeStock[]
  clientes: Cliente[]
}) {
  const [estado, accion, enviando] = useActionState(registrarVentaAction, INICIAL)
  const idError = useId()

  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [clienteId, setClienteId] = useState('')
  const [medioDePago, setMedioDePago] = useState('efectivo')
  const [codigo, setCodigo] = useState('')
  const [requiereFactura, setRequiereFactura] = useState(false)
  const [sinVacio, setSinVacio] = useState(0)

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => {
    setCarrito({})
    setClienteId('')
    setMedioDePago('efectivo')
    setCodigo('')
    setRequiereFactura(false)
  })

  const cliente = clientes.find((c) => c.id === clienteId)
  const vendibleDe = (id: string) => stock.find((s) => s.productoId === id)?.vendible ?? 0

  const cambiar = (id: string, delta: number) =>
    setCarrito((previo) => {
      const cantidad = (previo[id] ?? 0) + delta

      if (cantidad > 0) return { ...previo, [id]: cantidad }

      // Llegar a cero SACA el producto del carrito en vez de dejarlo en cero:
      // una línea de cero unidades no es una línea, y viajaría al servidor.
      const resto = { ...previo }
      delete resto[id]
      return resto
    })

  const items = Object.entries(carrito).map(([productoId, cantidad]) => ({ productoId, cantidad }))

  /*
   * El precio que se muestra es el que le toca al cliente elegido — RN-VEN-12.
   * Sin cliente se cobra la lista residencial: es la de quien compra un
   * botellón y se va, que es la venta de mostrador normal.
   */
  const precioDe = (producto: Producto) =>
    cliente?.tipo === 'comercial' ? producto.precioComercial : producto.precioResidencial

  const total = items.reduce((suma, item) => {
    const producto = productos.find((p) => p.id === item.productoId)
    return suma + (producto ? Number(precioDe(producto)) * item.cantidad : 0)
  }, 0)

  /*
   * ── Los envases que salen del parque — RN-ENV-03 ──────────────────────────
   *
   * Solo cuentan los productos de presentación `botellon`: una paca de bolsas
   * no lleva ningún activo retornable, y preguntar por vacíos ahí sería ruido.
   */
  const botellonesEnCarrito = items.reduce((suma, item) => {
    const producto = productos.find((p) => p.id === item.productoId)
    return suma + (producto?.presentacion === 'botellon' ? item.cantidad : 0)
  }, 0)

  /*
   * Se recorta solo cuando el carrito baja: dejar un `sinVacio` mayor que los
   * botellones vendidos haría que el servidor rechace con un número que la
   * pantalla ya sabía que estaba mal.
   */
  const salenSinVacio = Math.min(sinVacio, botellonesEnCarrito)
  const botellonSinCliente = salenSinVacio > 0 && !clienteId

  const excedidos = items.filter((i) => i.cantidad > vendibleDe(i.productoId))
  const creditoSinCliente = medioDePago === 'credito' && !clienteId

  return (
    <form action={accion} className="aq-tarjeta grid gap-5 p-5">
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="medioDePago" value={medioDePago} />
      <input type="hidden" name="requiereFactura" value={requiereFactura ? 'si' : 'no'} />
      <input type="hidden" name="botellonesSinVacio" value={salenSinVacio} />

      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Registrar una venta</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Una venta confirmada no se edita. Si sale mal, se anula y se hace de nuevo.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      {/*
        El recorte contra el piso NO es un error: la venta se hizo. Va con otro
        peso para que quien cobró sepa que el código no entró entero, sin que
        parezca que algo falló.
      */}
      {estado.avisoDePiso ? (
        <p
          role="status"
          className="rounded-lg border border-alerta-borde bg-alerta-fondo p-3 text-[14px] text-alerta-texto"
        >
          {estado.avisoDePiso}
        </p>
      ) : null}

      <section className="grid gap-2">
        <h3 className="aq-micro text-tenue">Qué se lleva</h3>

        <ul className="grid gap-2">
          {productos.map((producto) => {
            const cantidad = carrito[producto.id] ?? 0
            const vendible = vendibleDe(producto.id)

            return (
              <li
                key={producto.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sutil p-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-principal">{producto.nombre}</p>
                  <p className="mt-0.5 text-[13px] text-tenue">
                    <Cifra tono="secundario">
                      ${Number(precioDe(producto)).toLocaleString('es-CO')}
                    </Cifra>{' '}
                    · quedan <Cifra tono={vendible === 0 ? 'alerta' : 'secundario'}>{vendible}</Cifra>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cambiar(producto.id, -1)}
                    disabled={cantidad === 0}
                    aria-label={`Quitar uno de ${producto.nombre}`}
                    className="aq-boton aq-boton-secundario aq-boton-compacto"
                  >
                    <Minus aria-hidden className="size-4" />
                  </button>

                  <span className="aq-cifra w-10 text-center text-[16px] text-principal">
                    {cantidad}
                  </span>

                  <button
                    type="button"
                    onClick={() => cambiar(producto.id, 1)}
                    aria-label={`Agregar uno de ${producto.nombre}`}
                    className="aq-boton aq-boton-secundario aq-boton-compacto"
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="aq-etiqueta-campo">
          <span>
            Cliente <span className="font-normal normal-case">(opcional)</span>
          </span>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="aq-campo"
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} — {c.documento}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Cómo paga</span>
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

        <label className="aq-etiqueta-campo">
          <span>
            Código <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            name="codigoDescuento"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="VERANO2026"
            className="aq-campo uppercase"
          />
        </label>
      </div>

      {botellonesEnCarrito > 0 ? (
        <div className="rounded-lg border border-sutil p-4">
          <p className="text-[13px] text-principal">
            {botellonesEnCarrito === 1
              ? '¿Trajo el botellón vacío?'
              : `¿Trajo los ${botellonesEnCarrito} botellones vacíos?`}
          </p>
          {/*
            La recarga normal es un intercambio y no mueve nada, así que el
            default es «sí»: el caso común no cuesta ningún clic.

            Lo que se pregunta es CUÁNTOS no trajo, y no un sí/no, porque en el
            mostrador se dice «vendí tres, trajo dos» — y eso es UN envase que
            sale, no tres ni ninguno.
          */}
          <p className="mt-1 text-[13px] text-tenue">
            Si se lleva alguno sin devolver el vacío, queda anotado a su nombre. No se le cobra:
            el envase sigue siendo de la planta.
          </p>

          <label className="aq-etiqueta-campo mt-3">
            <span>Se lleva sin devolver</span>
            <input
              type="number"
              min={0}
              max={botellonesEnCarrito}
              value={salenSinVacio}
              onChange={(e) => setSinVacio(Number(e.target.value))}
              className="aq-campo aq-cifra w-24"
            />
          </label>

          {botellonSinCliente ? (
            <p className="mt-3 text-[13px] text-alerta">
              Un botellón que sale sin vacío queda a cargo de alguien. Elija el cliente arriba: sin
              nombre no hay a quién reclamárselo.
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="aq-ficha">
        <input
          type="checkbox"
          checked={requiereFactura}
          onChange={(e) => setRequiereFactura(e.target.checked)}
          className="sr-only"
        />
        <span className="aq-ficha-caja" aria-hidden />
        El cliente pide factura electrónica
      </label>

      {/* ── Lo que va a pasar al cobrar ───────────────────────────────────── */}
      {items.length > 0 ? (
        <section
          aria-live="polite"
          className="grid gap-2 rounded-xl border border-sutil bg-elevada p-4"
        >
          <p className="flex items-baseline justify-between gap-3">
            <span className="aq-micro text-tenue">Total estimado</span>
            <span>
              <Cifra tamano="grande">${total.toLocaleString('es-CO')}</Cifra>
            </span>
          </p>

          <p className="text-[13px] text-tenue">
            {cliente
              ? `Lista ${cliente.tipo}. `
              : 'Lista residencial, que es la de una venta de mostrador. '}
            El total definitivo lo calcula el servidor con los precios del momento
            {codigo ? ' y el código, que puede recortarse contra el precio mínimo' : ''}.
          </p>

          {excedidos.length > 0 ? (
            <p className="text-[13px] text-alerta-texto">
              Hay más unidades pedidas que disponibles. Lo que se lee acá es de hace un
              rato: quien decide es el servidor al confirmar.
            </p>
          ) : null}

          {creditoSinCliente ? (
            <p className="text-[13px] text-alerta-texto">
              Una venta a crédito necesita cliente: no hay a quién cobrarle una deuda sin
              dueño.
            </p>
          ) : null}
        </section>
      ) : null}

      <button
        type="submit"
        disabled={enviando || items.length === 0 || botellonSinCliente}
        className="aq-boton aq-boton-primario aq-boton-grande justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Cobrar'}
      </button>
    </form>
  )
}
