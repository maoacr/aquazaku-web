'use client'

import { useActionState, useId, useState } from 'react'
import {
  type EstadoDeFormulario,
  registrarCobroAction,
} from '@/app/(app)/modulos/ventas/actions'
import { FormError } from '@/components/auth/form-error'
import { Cifra } from '@/components/stock/cifra'
import { Modal } from '@/components/ui/modal'
import type { Cobro } from '@/lib/api-types'
import {
  useAvisoDeExito,
  useLimpiezaAlRegistrar,
  useSelectResistenteAlReset,
} from '@/lib/formulario-cliente'
import { fechaYHoraEnLaPlanta } from '@/lib/hora-de-la-planta'

/**
 * Abonar y saldar la deuda de un cliente — RN-VEN-07.
 *
 * ── Abonar y saldar son la MISMA operación ──────────────────────────────────
 *
 * `POST /cobros` no distingue un pago parcial de un pago total: lo que cambia es
 * el monto, y `api/` contesta con `deudaRestante` y `quedaSaldada`. Dos botones
 * separados sugerirían dos registros distintos en el libro, y hay uno solo.
 *
 * «Saldar todo» por eso no es otra acción: es este formulario con el monto
 * exacto precargado. Es la diferencia entre ofrecer un atajo y partir el
 * dominio en dos.
 *
 * ── Vive en `components/ventas/` y se dibuja en la ficha del cliente ────────
 *
 * El cobro es del módulo de ventas —su tabla, su permiso `cobros:registrar`, su
 * Server Action—, pero se registra donde alguien está mirando la cuenta. Es la
 * misma repartición que ya tiene `UltimasVentas`: la dueña del dato es ventas,
 * la pantalla que la muestra es la ficha.
 *
 * ── Ahora el módulo sí va al navegador ─────────────────────────────────────
 *
 * `ListaDeAbonos` llegó sin `'use client'` porque solo pinta. El formulario no
 * puede: el monto es un campo controlado —«Saldar todo» lo escribe—, el modal
 * abre y cierra, y el aviso de error vive en el estado de la acción. Las dos
 * cosas comparten archivo porque son la misma pieza del dominio, y el costo de
 * que la lista viaje es el marcado de un `<li>`.
 *
 * ── Esto es cosmética; la barrera está en `api/` ────────────────────────────
 *
 * Los chequeos de abajo existen para decir qué falta ANTES del viaje, no para
 * garantizar nada: `requirePermission('cobros', 'registrar')` decide quién
 * puede, el servicio rechaza cobrar de más y la base tiene los `CHECK`. Si esta
 * validación y la de `api/` alguna vez discrepan, la que vale es la de allá.
 */

const INICIAL: EstadoDeFormulario = {}

const pesos = (monto: string | number) => `$${Number(monto).toLocaleString('es-CO')}`

/**
 * El monto en centavos enteros.
 *
 * La misma aritmética que `api/src/modules/ventas/precio.ts`: comparar
 * `80000.00` con `80000` como floats es donde aparece el abono que la pantalla
 * da por válido y el servidor rebota por un centavo que nadie escribió.
 */
const centavos = (monto: string) => Math.round(Number(monto || 0) * 100)

export function RegistrarAbono({
  cliente,
  deuda,
}: {
  cliente: { id: string; nombre: string }
  /** Como `'80000.00'`. Sale de `GET /clientes/:id/deuda`, no de esta pantalla. */
  deuda: string
}) {
  const [abriendo, setAbriendo] = useState(false)

  /*
   * ── Sin deuda no hay botón, y dice por qué ───────────────────────────────
   *
   * Con la deuda en cero, CUALQUIER monto vuelve con
   * `COBRO_MAYOR_QUE_LA_DEUDA`: `api/` rechaza el saldo a favor porque ningún
   * módulo sabría gastarlo. Un botón que siempre falla enseña a ignorar los
   * errores, y un botón deshabilitado sin motivo se intenta tres veces antes
   * de preguntar. Queda la razón escrita.
   */
  if (centavos(deuda) <= 0) {
    return (
      <p className="text-[14px] text-secundario">
        {cliente.nombre} no debe nada: no hay sobre qué abonar. Un pago por encima de la
        deuda no se puede registrar — dejaría un saldo a favor que ningún módulo del
        sistema sabe aplicar a una compra futura.
      </p>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        <p className="text-[14px] text-secundario">
          Un abono baja la deuda desde el momento en que se registra. No se puede editar
          ni borrar después: un monto equivocado se corrige con otro documento, igual que
          una venta.
        </p>

        <button
          type="button"
          onClick={() => setAbriendo(true)}
          className="aq-boton aq-boton-primario justify-self-start"
        >
          Registrar un abono
        </button>
      </div>

      <Modal
        abierto={abriendo}
        cerrar={() => setAbriendo(false)}
        titulo={`Abono de ${cliente.nombre}`}
      >
        <FormularioDeAbono
          cliente={cliente}
          deuda={deuda}
          alTerminar={() => setAbriendo(false)}
        />
      </Modal>
    </>
  )
}

/**
 * El formulario del abono.
 *
 * ── El techo sale del servidor ──────────────────────────────────────────────
 *
 * `max` se deriva de la deuda que viajó con la página. Un número escrito acá
 * quedaría obsoleto en el primer abono, y la pantalla aceptaría un monto que
 * `api/` iba a rebotar.
 *
 * ── Lo que queda se adelanta antes de registrar ─────────────────────────────
 *
 * Un cobro es inmutable. La cuenta que la persona hace de cabeza —«¿con esto
 * queda al día?»— es la que decide si el monto es el correcto, así que se
 * muestra mientras todavía se puede cambiar. El número definitivo lo dice
 * `api/` en el aviso de éxito; este es una vista previa y no manda nada.
 */
function FormularioDeAbono({
  cliente,
  deuda,
  alTerminar,
}: {
  cliente: { id: string; nombre: string }
  deuda: string
  /** Cierra el modal cuando el abono quedó registrado. */
  alTerminar: () => void
}) {
  const [estado, accion, enviando] = useActionState(registrarCobroAction, INICIAL)
  const [monto, setMonto] = useState('')
  /*
   * Controlado, y no por gusto: con `defaultValue` el reset que React dispara al
   * terminar la acción devolvía el medio a «Efectivo». Un cobro rechazado por el
   * monto se reintenta corrigiendo el monto —nadie vuelve a mirar el medio— y la
   * transferencia quedaba registrada como efectivo. La caja no cuadra y el cobro
   * no se puede editar.
   */
  const [medioDePago, setMedioDePago] = useState('efectivo')
  const refMedio = useSelectResistenteAlReset(medioDePago)
  const idError = useId()

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, alTerminar)

  const deudaEnCentavos = centavos(deuda)
  const montoEnCentavos = centavos(monto)

  const sePasa = montoEnCentavos > deudaEnCentavos
  const vacio = montoEnCentavos <= 0
  const restante = (deudaEnCentavos - montoEnCentavos) / 100

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="clienteId" value={cliente.id} />

      <div className="rounded-lg border border-sutil p-3">
        <p className="aq-micro text-tenue">Debe hoy</p>
        <Cifra tamano="grande" tono="alerta">
          {pesos(deuda)}
        </Cifra>
        <p className="mt-1 text-[13px] text-tenue">
          de ventas a crédito menos los abonos y las devoluciones ya registradas
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      {/*
        El ancho va en el CONTENEDOR, no en el campo: `.aq-campo` gana la
        cascada y un `w-*` de Tailwind sobre el `<input>` queda inerte.
      */}
      <label className="aq-etiqueta-campo max-w-xs">
        <span>Monto del abono</span>
        {/*
          Controlado, porque «Saldar todo» lo escribe. Un campo no controlado
          obligaría a tocar el DOM a mano para precargarlo.

          `step` en centavos y no en pesos: la columna es `numeric(12,2)`, y con
          `step="1"` una deuda con centavos no se podría saldar exacta — el
          atajo dejaría un resto que el campo declara inválido.
        */}
        <input
          name="monto"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          max={String(Number(deuda))}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          aria-describedby={idError}
          className="aq-campo aq-cifra"
        />
      </label>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => setMonto(String(Number(deuda)))}
          className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
        >
          Saldar todo · {pesos(deuda)}
        </button>

        {/*
          El motivo del botón apagado, junto al campo que lo apaga. Sin esto, un
          submit gris es un acertijo.
        */}
        {sePasa ? (
          <p role="alert" className="text-[13px] text-error-texto">
            El abono no puede ser mayor que la deuda. {cliente.nombre} debe {pesos(deuda)},
            y acá hay {pesos(monto)}. No existe saldo a favor: registre lo que debe, o
            revise si falta cargar una venta.
          </p>
        ) : vacio ? null : restante === 0 ? (
          <p className="text-[13px] text-tenue">Con este abono queda al día.</p>
        ) : (
          <p className="text-[13px] text-tenue">
            Después de este abono quedarían {pesos(restante)}.
          </p>
        )}
      </div>

      <label className="aq-etiqueta-campo max-w-xs">
        <span>Medio de pago</span>
        {/*
          `credito` no está, y no es un olvido: la base tiene
          `cobros_no_se_pagan_a_credito`. Pagar un crédito con crédito no es una
          operación — ofrecerla sería ofrecer un error.
        */}
        <select
          ref={refMedio}
          name="medioDePago"
          value={medioDePago}
          onChange={(e) => setMedioDePago(e.target.value)}
          className="aq-campo"
        >
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
        </select>
      </label>

      <label className="aq-etiqueta-campo">
        <span>
          Observaciones <span className="font-normal normal-case text-tenue">(opcional)</span>
        </span>
        <textarea
          name="observaciones"
          rows={2}
          placeholder="Pagó en la tienda, recibió Marta"
          className="aq-campo"
        />
        <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
          Es lo único que dentro de tres meses explica un abono que no cuadra con la fecha
          de la entrega.
        </span>
      </label>

      <button
        type="submit"
        disabled={enviando || vacio || sePasa}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar el abono'}
      </button>
    </form>
  )
}

/**
 * El libro de abonos de un cliente.
 *
 * ── Va al lado de la deuda, no en otra pantalla ─────────────────────────────
 *
 * «¿De dónde salen estos $80.000?» se contesta con las ventas; «¿pero no había
 * pagado?» se contesta con esto. Es la primera pregunta cuando alguien discute
 * su deuda, y la ficha ya recibe los abonos en la misma respuesta que la deuda
 * (`GET /clientes/:id/deuda` devuelve las dos cosas).
 *
 * Del más nuevo al más viejo: lo ordena `api/`, no esta lista.
 */
export function ListaDeAbonos({ cobros }: { cobros: Cobro[] }) {
  if (cobros.length === 0) {
    return (
      <p className="text-[14px] text-tenue">
        Todavía no hay abonos. Si el cliente debe, es la deuda entera de sus compras a
        crédito.
      </p>
    )
  }

  return (
    <ul className="grid gap-2">
      {cobros.map((cobro) => (
        <li
          key={cobro.id}
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-sutil p-3"
        >
          <Cifra tono="exito">{pesos(cobro.monto)}</Cifra>

          <span className="text-[14px] text-secundario">
            en {cobro.medioDePago === 'efectivo' ? 'efectivo' : 'transferencia'}
          </span>

          {/*
            La hora y no solo el día: dos abonos del mismo cliente en una misma
            jornada se distinguen por ahí cuando hay que cuadrar la caja.
          */}
          <span className="ml-auto text-[13px] text-tenue">
            {fechaYHoraEnLaPlanta(cobro.createdAt)}
          </span>

          {cobro.observaciones ? (
            <p className="w-full text-[13px] text-tenue">{cobro.observaciones}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
