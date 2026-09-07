'use client'

import { useActionState, useId, useState } from 'react'
import { Phone } from 'lucide-react'
import {
  agregarDireccionAction,
  agregarTelefonoAction,
  cambiarEstadoAction,
  configurarCreditoAction,
  desactivarTelefonoAction,
  type EstadoDeFormulario,
  verificarDocumentoAction,
} from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import type { FichaDeCliente, Telefono } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'

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
 * Los tipos de vía que se usan en Colombia.
 *
 * Va como `datalist` y no como `select`: la lista cubre lo común, y quien tenga
 * una vía que no está —«Anillo Vial», «Km 3»— la escribe igual. Un desplegable
 * cerrado bloquearía una dirección REAL, que es exactamente lo que este diseño
 * vino a evitar.
 */
const TIPOS_DE_VIA = ['CL', 'KR', 'TV', 'DG', 'AV', 'AC', 'AK', 'CIRCUNVALAR', 'VDA', 'KM']

/**
 * Una dirección es una entidad, no un campo de texto — RN-CLI-07 y M14.
 *
 * ── Ningún campo de ubicación es obligatorio ────────────────────────────────
 *
 * Aquazaku reparte en Campo de la Cruz y en pueblos vecinos. La nomenclatura
 * `CL 45 A # 12 B - 34` es urbana: hay direcciones que son «Vereda La Peña,
 * casa de tabla azul» y no se dejan descomponer.
 *
 * Exigir la estructura bloquearía el registro de un cliente real, y el operador
 * inventaría `CL 1 # 1-1` para poder guardar. Lo único obligatorio es la
 * etiqueta, porque es lo que se busca en la lista.
 *
 * ── Por qué la nomenclatura va en UNA línea ─────────────────────────────────
 *
 * Son siete campos. Apilados con su etiqueta cada uno, el formulario se ve como
 * un trámite y nadie lo completa. En una sola línea —con el `#` y el `-` entre
 * medio— se lee como la dirección que es.
 */
export function AgregarDireccion({ clienteId }: { clienteId: string }) {
  const [estado, accion, enviando] = useActionState(agregarDireccionAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form action={accion} key={estado.token ?? 'inicial'} className="grid gap-5">
      <input type="hidden" name="clienteId" value={clienteId} />
      <FormError id={idError}>{estado.error}</FormError>

      <label className="aq-etiqueta-campo">
        <span>Cómo la llaman</span>
        <input
          name="etiqueta"
          required
          placeholder="La casa, el negocio, la sucursal norte"
          className="aq-campo"
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="aq-etiqueta-campo mb-1">
          <span>
            Dirección <span className="font-normal normal-case">(si la tiene)</span>
          </span>
        </legend>

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="viaTipo"
            list="tipos-de-via"
            placeholder="CL"
            aria-label="Tipo de vía"
            className="aq-campo w-24 uppercase"
          />
          <datalist id="tipos-de-via">
            {TIPOS_DE_VIA.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>

          <input name="viaNumero" placeholder="45" aria-label="Número de la vía" className="aq-campo w-20" />
          <input name="viaLetra" placeholder="A" aria-label="Letra de la vía" className="aq-campo w-14 uppercase" />

          <span aria-hidden className="px-1 text-tenue">#</span>

          <input name="placaNumero" placeholder="12" aria-label="Número de la placa" className="aq-campo w-20" />
          <input name="placaLetra" placeholder="B" aria-label="Letra de la placa" className="aq-campo w-14 uppercase" />

          <span aria-hidden className="px-1 text-tenue">–</span>

          <input name="placaSegundo" placeholder="34" aria-label="Segundo número" className="aq-campo w-20" />
          <input
            name="placaLetraFinal"
            placeholder="C"
            aria-label="Letra final"
            className="aq-campo w-14 uppercase"
          />
        </div>

        <input
          name="complemento"
          placeholder="Apto 302, torre B, local 4 (opcional)"
          aria-label="Complemento"
          className="aq-campo"
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Municipio, pueblo o vereda</span>
          <input name="municipio" placeholder="Campo de la Cruz" className="aq-campo" />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Departamento</span>
          <input name="departamento" placeholder="Atlántico" className="aq-campo" />
        </label>
      </div>

      {/*
        La salida para lo que no se descompone. No es un campo de respaldo: para
        media Colombia rural ES la dirección.
      */}
      <label className="aq-etiqueta-campo">
        <span>
          Si no se puede escribir así <span className="font-normal normal-case">(escríbala como es)</span>
        </span>
        <input
          name="direccion"
          placeholder="Vereda La Peña, casa de tabla azul"
          className="aq-campo"
        />
      </label>

      <label className="aq-etiqueta-campo">
        <span>
          Cómo llegar <span className="font-normal normal-case">(opcional)</span>
        </span>
        <input
          name="indicaciones"
          placeholder="Al lado de la panadería, portón verde"
          className="aq-campo"
        />
      </label>

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
 * El botón dice «Desactivar», no «Eliminar», porque eso es lo que pasa: el
 * historial queda. `api/` tampoco expone `DELETE` y la base lo tiene revocado.
 */
export function CambiarEstado({ cliente }: { cliente: FichaDeCliente }) {
  const [estado, accion, enviando] = useActionState(cambiarEstadoAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    <form action={accion} className="grid gap-3">
      <input type="hidden" name="clienteId" value={cliente.id} />
      <input type="hidden" name="activo" value={cliente.activo ? 'no' : 'si'} />
      <FormError id={idError}>{estado.error}</FormError>

      <p className="text-[14px] text-secundario">
        {cliente.activo
          ? 'Un cliente desactivado deja de aparecer en operaciones nuevas. Su historial, sus deudas y sus botellones quedan.'
          : 'Este cliente está desactivado y no aparece en operaciones nuevas.'}
      </p>

      <button
        type="submit"
        disabled={enviando}
        className={`aq-boton justify-self-start ${cliente.activo ? 'aq-boton-destructivo' : 'aq-boton-secundario'}`}
      >
        {enviando ? 'Guardando…' : cliente.activo ? 'Desactivar cliente' : 'Reactivar cliente'}
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
