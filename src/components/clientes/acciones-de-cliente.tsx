'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Phone } from 'lucide-react'
import {
  agregarDireccionAction,
  agregarTelefonoAction,
  cambiarEstadoAction,
  configurarCreditoAction,
  desactivarClienteAction,
  desactivarTelefonoAction,
  type EstadoDeFormulario,
  verificarDocumentoAction,
} from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import { CamposDeDireccion } from './campos-de-direccion'
import type { Departamento, FichaDeCliente, Municipio, Telefono } from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

/**
 * Verificar el documento — RN-CLI-14.
 *
 * ── No es un checkbox de trámite ────────────────────────────────────────────
 *
 * Al marcarlo, quien lo hace queda registrado afirmando que tuvo el documento
 * en la mano. Si después aparece uno equivocado, se sabe quién lo dio por bueno.
 * El texto del botón lo dice, porque un «Verificar» pelado se marca sin pensar.
 *
 * El método NO se elige: lo deriva `api/` del rol de quien envía. Un selector
 * acá dejaría que un `seller` marque «ratificación oficial».
 */
export function VerificarDocumento({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(verificarDocumentoAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  if (cliente.verificacionEstado === 'verificado') return null

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <FormError id={idError}>{estado.error}</FormError>

      <p className="text-[14px] text-secundario">
        Marcarlo significa que usted tuvo el documento a la vista. Queda registrado su
        nombre y la fecha.
      </p>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Coteje el documento y verifíquelo'}
      </button>
    </form>
  )
}

/**
 * El crédito — RN-CLI-12 y RN-CLI-15.
 *
 * ── Bloqueado hasta verificar, y dice por qué ───────────────────────────────
 *
 * Con el cliente en `pendiente` el formulario no aparece: aparece la razón. Un
 * botón deshabilitado sin explicación hace que alguien lo intente tres veces y
 * después pregunte.
 *
 * Esto es cosmética, no la barrera: `api/` rechaza igual y la base tiene un
 * `CHECK` que lo hace imposible aunque alguien esquive las dos capas de arriba.
 */
export function ConfigurarCredito({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(configurarCreditoAction, INICIAL)
  const idError = useId()
  const [habilitado, setHabilitado] = useState(cliente.creditoHabilitado)

  useAvisoDeExito(estado)

  if (cliente.verificacionEstado !== 'verificado') {
    return (
      <p className="text-[14px] text-secundario">
        El crédito exige verificación. Extender crédito a una identidad sin comprobar es
        justamente el riesgo que el crédito viene a acotar, así que primero hay que cotejar
        el documento.
      </p>
    )
  }

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="habilitado" value={habilitado ? 'si' : 'no'} />
      <FormError id={idError}>{estado.error}</FormError>

      {/*
        `.aq-ficha` y no una casilla suelta: la regla de los 44 px exime a los
        checkbox porque agrandar la caja los deforma, y esa exención dejaba el
        control más chico de la app justo donde se decide quién compra a
        crédito. El objetivo táctil es la ficha entera; la casilla real queda
        en `sr-only` para el lector de pantalla.
      */}
      <label className="aq-ficha">
        <input
          type="checkbox"
          checked={habilitado}
          onChange={(e) => setHabilitado(e.target.checked)}
          className="sr-only"
        />
        <span className="aq-ficha-caja" aria-hidden />
        Puede comprar a crédito, con plazos de 30, 60 o 90 días
      </label>

      {habilitado ? (
        <label className="aq-etiqueta-campo max-w-xs">
          <span>
            Tope <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            name="limite"
            type="number"
            min="1"
            step="1"
            defaultValue={cliente.creditoLimite ?? ''}
            className="aq-campo aq-cifra"
          />
          <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
            Vacío es sin tope, y es lo normal. Poner un número hoy sería inventarlo — se
            carga cuando el negocio decida cuál.
          </span>
        </label>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Guardando…' : 'Guardar el crédito'}
      </button>
    </form>
  )
}

/**
 * Agregar una dirección — RN-CLI-07 y M14.
 *
 * Los campos viven en `CamposDeDireccion`, compartidos con la edición.
 * Duplicados, en un mes tendrían campos distintos: se agrega uno al alta, nadie
 * se acuerda de la edición, y editar una dirección le borra el dato nuevo.
 */
export function AgregarDireccion({
  clienteId,
  departamentos,
  municipios,
  alAgregar,
}: {
  clienteId: string
  departamentos: Departamento[]
  municipios: Municipio[]
  /** Para que quien lo abrió en un modal pueda cerrarlo al terminar. */
  alAgregar?: () => void
}) {
  const [estado, accion, enviando] = useActionState(agregarDireccionAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  /*
   * El aviso de «listo» se dispara UNA vez por token y no en cada render.
   *
   * `alAgregar` suele llegar como una arrow inline, así que su identidad cambia
   * siempre: con ella en las dependencias, el efecto correría en cada render y
   * el modal se cerraría solo antes de que nadie escriba nada. El token del
   * estado es lo que de verdad marca «esta vez sí se guardó».
   */
  const ultimoAvisado = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!estado.token || estado.error) return
    if (ultimoAvisado.current === estado.token) return

    ultimoAvisado.current = estado.token
    alAgregar?.()
  })

  return (
    <form action={accion} key={estado.token ?? 'inicial'} className="grid gap-5">
      <input type="hidden" name="clienteId" value={clienteId} />
      <FormError id={idError}>{estado.error}</FormError>

      <CamposDeDireccion departamentos={departamentos} municipios={municipios} />

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-secundario justify-self-start"
      >
        {enviando ? 'Agregando…' : 'Agregar dirección'}
      </button>
    </form>
  )
}

/**
 * Baja y alta — RN-CLI-02.
 *
 * ── Dos direcciones, dos botones ────────────────────────────────────────────
 *
 * Reactivar es un toggle inocuo: cambia una columna y nada más. Desactivar
 * es OTRA cosa: devuelve al stock físico las bases y botellones a nombre
 * del cliente. Mezclar las dos en un solo form ocultaba lo que pasaba, y
 * «Desactivar» sin modal era apretar un botón que movía stock sin pedir
 * confirmación.
 *
 * Por eso la desactivación se hace dentro de un `<Modal>` con los conteos
 * y motivo obligatorio, mientras la reactivación sigue siendo un botón
 * directo: es lo que cabe en un toggle de una columna.
 */
export function CambiarEstado({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoAction, INICIAL)
  const [desactivando, setDesactivando] = useState(false)
  const idError = useId()

  useAvisoDeExito(estado)

  if (!cliente.activo) {
    /*
     * Ya está inactivo: solo queda reactivar. La pantalla no muestra un
     * botón de desactivar que rebotaría con `CLIENTE_YA_INACTIVO`: un
     * botón que siempre falla enseña a ignorar los errores.
     */
    return (
      <form action={accion} className="grid gap-3">
        <input type="hidden" name="clienteId" value={cliente.id} />
        <input type="hidden" name="activo" value="si" />
        <FormError id={idError}>{estado.error}</FormError>

        <p className="text-[14px] text-secundario">
          Este cliente está desactivado y no aparece en operaciones nuevas. Su historial,
          deudas y botellones quedan registrados.
        </p>

        <button
          type="submit"
          disabled={enviando}
          className="aq-boton aq-boton-secundario justify-self-start"
        >
          {enviando ? 'Guardando…' : 'Reactivar cliente'}
        </button>
      </form>
    )
  }

  return (
    <>
      <div className="grid gap-3">
        <p className="text-[14px] text-secundario">
          Un cliente desactivado deja de aparecer en operaciones nuevas. Su historial y sus
          deudas quedan registrados.
        </p>

        <button
          type="button"
          onClick={() => setDesactivando(true)}
          className="aq-boton aq-boton-destructivo justify-self-start"
        >
          Desactivar cliente
        </button>
      </div>

      <Modal
        abierto={desactivando}
        cerrar={() => setDesactivando(false)}
        titulo={`Desactivar a ${cliente.nombre}`}
      >
        <FormularioDeDesactivacion cliente={cliente} alTerminar={() => setDesactivando(false)} />
      </Modal>
    </>
  )
}

/**
 * La confirmación de desactivar — pide motivo y muestra qué se va a mover.
 *
 * El motivo NO es opcional: es lo único que tres meses después explica
 * por qué este cliente quedó inactivo y qué stock volvió al parque. El
 * piso lo pone `api/`; acá se exige el mismo para poder decir qué falta
 * antes del viaje, sin devolver un 422 que nadie iba a leer.
 */
function FormularioDeDesactivacion({
  cliente,
  alTerminar,
}: {
  cliente: FichaDeCliente
  /** Cierra el modal cuando la operación quedó registrada. */
  alTerminar: () => void
}) {
  const [estado, accion, enviando] = useActionState(desactivarClienteAction, INICIAL)
  const [motivo, setMotivo] = useState('')
  const idError = useId()

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, alTerminar)

  /*
   * Los conteos vienen en la ficha — RN-CLI-06.
   *
   * No se piden al abrir el modal: `FichaDeCliente.saldos.bases` y
   * `saldos.botellones` ya viajan con la página (se piden en
   * `clientes/[id]/page.tsx`), y traerlos de nuevo sería un viaje extra
   * solo para mostrar dos números.
   *
   * Cuando los módulos que los calculan no están conectados, llegan en
   * `null`. Mostrar `null` con un guion al lado sería mentir — «0
   * bases» dice «este cliente no tiene nada», «sin registrar todavía»
   * dice «todavía no sabemos». La distinción importa porque la
   * consecuencia es distinta.
   */
  const bases = cliente.saldos.bases
  const botellones = cliente.saldos.botellones
  const hayAlgoQueVolver =
    (bases !== null && bases > 0) || (botellones !== null && botellones > 0)

  return (
    <form action={accion} className="grid gap-4">
      <input type="hidden" name="clienteId" value={cliente.id} />

      <p className="text-[14px] text-principal">
        {hayAlgoQueVolver
          ? 'Esta desactivación mueve stock:'
          : 'Este cliente no tiene bases ni botellones a su nombre.'}
      </p>

      {hayAlgoQueVolver ? (
        <ul className="grid gap-1 rounded-lg border border-sutil p-3 text-[14px] text-secundario">
          {bases !== null && bases > 0 ? (
            <li>
              <strong className="text-principal">{bases}</strong> base{bases === 1 ? '' : 's'}
              {' '}prestad{bases === 1 ? 'a' : 'as'} vuelven al parque y quedan disponibles.
            </li>
          ) : null}
          {botellones !== null && botellones > 0 ? (
            <li>
              <strong className="text-principal">{botellones}</strong> botellón
              {botellones === 1 ? '' : 'es'} en poder del cliente vuelven a la bodega.
            </li>
          ) : null}
        </ul>
      ) : null}

      <p className="text-[13px] text-tenue">
        El historial del cliente —ventas, cobros, devoluciones— queda registrado. Esta
        operación no se puede deshacer desde acá; reactivarlo después sí, pero el stock
        ya devuelto no vuelve solo a su nombre.
      </p>

      <FormError id={idError}>{estado.error}</FormError>

      <label className="aq-etiqueta-campo">
        <span>
          Por qué se desactiva <span className="text-alerta">·</span>{' '}
          <span className="font-normal normal-case text-tenue">obligatorio</span>
        </span>
        <textarea
          name="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Se mudó de pueblo y no quiere seguir registrado"
          aria-describedby={idError}
          className="aq-campo"
        />
        <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
          Queda en la bitácora con su nombre y la hora, y se usa para reconstruir el cambio
          si alguien lo pregunta dentro de tres meses.
        </span>
      </label>

      <button
        type="submit"
        disabled={enviando || motivo.trim().length < 10}
        className="aq-boton aq-boton-destructivo justify-self-start"
      >
        {enviando ? 'Desactivando…' : 'Desactivar cliente'}
      </button>
    </form>
  )
}

/**
 * Los teléfonos de un cliente — M14.
 *
 * Salió de la primera demo con el cliente: se había construido la cartera por
 * edad para saber a quién llamar primero, y no había a qué número llamar.
 *
 * ── El número se muestra como enlace ────────────────────────────────────────
 *
 * `tel:` abre el marcador en el teléfono de quien lo toca. Los ocho de la
 * planta van a mirar esta pantalla desde un celular parados al lado de una
 * llenadora — copiar diez dígitos a mano ahí es donde se pierde la llamada.
 */
export function TelefonosDelCliente({
  clienteId,
  telefonos,
}: {
  clienteId: string
  telefonos: Telefono[]
}) {
  const [estado, accion, enviando] = useActionState(agregarTelefonoAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <div className="grid gap-4">
      {telefonos.length > 0 ? (
        <ul className="grid gap-2">
          {telefonos.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2.5 rounded-lg border border-sutil p-3"
            >
              <Phone aria-hidden className="size-4 shrink-0 text-icono" />
              <div className="min-w-0 flex-1">
                <a
                  href={`tel:${t.numero.replace(/[^0-9+]/g, '')}`}
                  className="text-[14px] font-medium text-principal underline-offset-4 hover:underline"
                >
                  {t.numero}
                </a>
                {t.etiqueta ? <p className="text-[13px] text-tenue">{t.etiqueta}</p> : null}
              </div>
              <QuitarTelefono clienteId={clienteId} id={t.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-tenue">
          Sin teléfonos. Sin un número, la cartera dice a quién cobrarle pero no cómo.
        </p>
      )}

      <form action={accion} key={estado.token ?? 'inicial'} className="grid gap-3">
        <input type="hidden" name="clienteId" value={clienteId} />
        <FormError id={idError}>{estado.error}</FormError>

        <div className="flex flex-wrap items-end gap-3">
          <label className="aq-etiqueta-campo">
            <span>Número</span>
            <input
              name="numero"
              type="tel"
              inputMode="tel"
              required
              placeholder="300 123 4567"
              className="aq-campo w-44"
            />
          </label>

          <label className="aq-etiqueta-campo flex-1">
            <span>
              De quién <span className="font-normal normal-case">(opcional)</span>
            </span>
            <input
              name="etiqueta"
              placeholder="El dueño, el local, la vecina"
              className="aq-campo"
            />
          </label>

          <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario">
            {enviando ? 'Agregando…' : 'Agregar'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** Quitar un teléfono lo DESACTIVA: el historial de llamadas lo necesita. */
function QuitarTelefono({ clienteId, id }: { clienteId: string; id: string }) {
  const [estado, accion, enviando] = useActionState(desactivarTelefonoAction, INICIAL)

  useAvisoDeExito(estado)

  return (
    <form action={accion}>
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={enviando}
        aria-label="Quitar este teléfono"
        className="aq-boton aq-boton-compacto aq-boton-secundario"
      >
        Quitar
      </button>
    </form>
  )
}
