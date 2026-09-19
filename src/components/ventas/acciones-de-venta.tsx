'use client'

import { Pencil, Ban } from 'lucide-react'
import { useActionState, useId, useState } from 'react'
import { anularVentaAction } from '@/app/(app)/modulos/ventas/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import type { Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'
import type { EstadoDeFormulario } from '@/lib/formulario'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'
import { Mostrador, correccionDesde } from './mostrador'

const INICIAL: EstadoDeFormulario = {}

/**
 * Corregir o anular una venta — RN-VEN-16 y RN-VEN-08.
 *
 * ── Las dos juntas, porque la pregunta es una sola ──────────────────────────
 *
 * Quien mira una venta que está mal se hace una pregunta: «¿esto no debió
 * existir, o quedó mal escrito?». Son las dos únicas salidas que la venta
 * tiene, y ponerlas en dos lugares distintos de la pantalla obligaría a saber
 * la respuesta antes de encontrar el botón.
 *
 * ── Por qué «Corregir» va primero y en secundario ───────────────────────────
 *
 * Corregir es lo que se necesita casi siempre —un tipeo, el cliente equivocado—
 * y anular es lo excepcional. Pero ninguna de las dos es una acción de todos los
 * días sobre esta lista, así que las dos van en peso secundario: un botón
 * primario acá competiría con «Cobrar», que sí es lo que la pantalla viene a
 * hacer.
 */
export function AccionesDeVenta({
  venta,
  productos,
  stock,
}: {
  venta: VentaDelListado
  productos: Producto[]
  stock: ResumenDeStock[]
}) {
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [anulando, setAnulando] = useState(false)

  /*
   * Una venta que ya no está confirmada no se toca más: ni se corrige ni se
   * anula. `api/` lo rechaza igual —y el trigger de la base también— pero
   * mostrar botones que siempre fallan enseña a ignorar los errores.
   *
   * Un recargo por daño tampoco se corrige: no tiene productos que rehacer.
   */
  if (venta.estado !== 'confirmada') return null

  return (
    <div className="flex flex-wrap gap-2">
      {venta.tipo === 'producto' ? (
        <button
          type="button"
          onClick={() => setCorrigiendo(true)}
          className="aq-boton aq-boton-secundario aq-boton-compacto"
        >
          <Pencil aria-hidden className="size-4" />
          Corregir
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => setAnulando(true)}
        className="aq-boton aq-boton-secundario aq-boton-compacto"
      >
        <Ban aria-hidden className="size-4" />
        Anular
      </button>

      <Modal
        abierto={corrigiendo}
        cerrar={() => setCorrigiendo(false)}
        titulo="Corregir la venta"
      >
        {/*
          El MISMO mostrador, precargado. No es ahorro de código: es que quien
          corrige necesita exactamente las mismas decisiones que quien cobró —el
          piso, el precio a mano, el aviso de stock— y un formulario paralelo se
          separaría del real en el primer cambio.
        */}
        <Mostrador
          productos={productos}
          stock={stock}
          correccion={correccionDesde(venta)}
          alCorregir={() => setCorrigiendo(false)}
        />
      </Modal>

      <Modal abierto={anulando} cerrar={() => setAnulando(false)} titulo="Anular la venta">
        <FormularioDeAnulacion venta={venta} alAnular={() => setAnulando(false)} />
      </Modal>
    </div>
  )
}

/**
 * Anular — RN-VEN-03 y RN-VEN-08.
 *
 * El motivo NO es opcional, y aplica igual al admin: una anulación sin
 * explicación es un agujero en la caja que dentro de tres meses nadie puede
 * cerrar. El largo mínimo lo decide `api/`; acá se exige el mismo para poder
 * decir qué falta antes del viaje.
 */
function FormularioDeAnulacion({
  venta,
  alAnular,
}: {
  venta: VentaDelListado
  alAnular: () => void
}) {
  const [estado, accion, enviando] = useActionState(anularVentaAction, INICIAL)
  const [motivo, setMotivo] = useState('')
  const idError = useId()

  useAvisoDeExito(estado)

  /*
   * Cerrar va acá y no en un `if` suelto del render: `alAnular` pone estado en
   * el componente padre, y hacerlo durante el render de este dispara el aviso
   * de React sobre actualizar otro componente mientras se renderiza —y a veces
   * un bucle—. Este hook ya resuelve el «pasó una vez y solo una».
   */
  useLimpiezaAlRegistrar(estado.token, alAnular)

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="ventaId" value={venta.id} />

      <p className="text-[13px] text-tenue">
        La venta no desaparece: cambia de estado y muestra por qué. El producto vuelve a su
        lote
        {venta.medioDePago === 'credito' ? ' y la deuda del cliente baja sola' : ''}.
      </p>

      <FormError id={idError}>{estado.error}</FormError>

      <label className="aq-etiqueta-campo">
        <span>Por qué se anula</span>
        <textarea
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="El cliente devolvió el botellón sin abrir"
          aria-describedby={idError}
          className="aq-campo"
        />
        <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
          Queda en la venta y en la bitácora, con su nombre y la hora.
        </span>
      </label>

      <button
        type="submit"
        disabled={enviando || motivo.trim().length < 10}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Anulando…' : 'Anular la venta'}
      </button>
    </form>
  )
}
