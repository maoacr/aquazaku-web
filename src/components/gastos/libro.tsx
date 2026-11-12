'use client'

import { Wallet } from 'lucide-react'
import { useActionState, useId, useState } from 'react'
import {
  anularMovimientoAction,
  type EstadoDeFormulario,
} from '@/app/(app)/modulos/gastos/actions'
import { FormError } from '@/components/auth/form-error'
import { Modal } from '@/components/ui/modal'
import { Encabezados, Etiqueta, SinResultados, Tabla, Td, Th } from '@/components/ui/tabla'
import { Vacio } from '@/components/ui/vacio'
import type { MovimientoDeDinero } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'
import { ETIQUETA_DE_EGRESO, ETIQUETA_DE_INGRESO } from '@/lib/gastos'
import { LARGO_MINIMO_MOTIVO } from '@/lib/motivos'
import { pesos } from '@/lib/plata'

const INICIAL: EstadoDeFormulario = {}

/**
 * El libro de dinero — M17.
 *
 * ── Una tabla y no tarjetas ─────────────────────────────────────────────────
 *
 * El libro se recorre comparando filas: «¿cuánto fue el de la luz el mes
 * pasado?», «¿ya cargué este recibo?». Para eso una planilla es mejor
 * herramienta que veinte tarjetas, y es la misma conclusión a la que llegó
 * Seguimientos.
 *
 * ── Qué dice cada fila sola ─────────────────────────────────────────────────
 *
 * Lleva el efecto con signo y la cuenta. Sin el signo habría que deducirlo del
 * tipo, y el tipo está en otra columna: la fila dejaría de leerse de un vistazo,
 * que es para lo único que sirve una tabla densa.
 */
export function Libro({ movimientos }: { movimientos: MovimientoDeDinero[] }) {
  if (movimientos.length === 0) {
    return (
      <Vacio variante="primera-vez" icono={Wallet} titulo="Todavía no hay movimientos">
        Acá van a aparecer los gastos y los ingresos, con la cuenta de la que salió o entró la
        plata. El saldo de cada cuenta es la suma de estas filas.
      </Vacio>
    )
  }

  return (
    <Tabla alto="max-h-[32rem]">
      <Encabezados>
        <Th fija>Cuándo</Th>
        <Th>Concepto</Th>
        <Th>Qué fue</Th>
        <Th>Cuenta</Th>
        <Th>A quién</Th>
        <Th>Monto</Th>
        {/*
          La columna de acciones no lleva rótulo VISIBLE —el botón se nombra
          solo— pero sí uno para lectores de pantalla: una celda de encabezado
          vacía deja la columna sin nombre al navegar la tabla por teclado.
        */}
        <Th>
          <span className="sr-only">Acciones</span>
        </Th>
      </Encabezados>

      <tbody>
        {movimientos.length === 0 ? (
          <SinResultados columnas={7}>Nada en este período.</SinResultados>
        ) : null}

        {movimientos.map((m) => (
          <Fila key={m.id} movimiento={m} />
        ))}
      </tbody>
    </Tabla>
  )
}

function Fila({ movimiento: m }: { movimiento: MovimientoDeDinero }) {
  const sale = m.efecto.startsWith('-')

  return (
    <tr className={m.anulado ? 'opacity-60' : undefined}>
      <Td fija className="aq-cifra whitespace-nowrap">
        {m.ocurridoEl}
      </Td>

      <Td>
        <span className="text-principal">{m.concepto}</span>
        {m.numeroDeFactura ? (
          <span className="aq-cifra ml-2 text-[12px] text-tenue">{m.numeroDeFactura}</span>
        ) : null}
        {/*
          El motivo de la anulación va EN la fila, no en un tooltip: es la
          explicación del descuadre, y es lo que alguien va a venir a leer
          dentro de tres meses (RN-GAS-05).
        */}
        {m.anulado ? (
          <span className="block text-[12px] text-tenue">Anulado: {m.motivoAnulacion}</span>
        ) : null}
      </Td>

      <Td className="whitespace-nowrap">{comoSeLlama(m)}</Td>

      <Td className="whitespace-nowrap text-secundario">{m.cuenta}</Td>

      <Td className="text-secundario">{m.proveedor ?? m.beneficiario ?? '—'}</Td>

      {/*
        El monto con su signo. `−` es el menos tipográfico (U+2212) y no un
        guion: alineado con las cifras, un guion se lee como separador.
      */}
      <Td className="aq-cifra whitespace-nowrap font-medium">
        {m.anulado ? (
          <span className="line-through">{pesos(m.monto)}</span>
        ) : (
          <span className={sale ? 'text-principal' : 'text-acento'}>
            {sale ? '−' : '+'}
            {pesos(m.monto)}
          </span>
        )}
      </Td>

      <Td>
        {m.anulado ? (
          <Etiqueta tono="neutro">Anulado</Etiqueta>
        ) : (
          <Anular movimiento={m} />
        )}
      </Td>
    </tr>
  )
}

/** Cómo se lee el tipo. El saldo inicial no tiene subtipo: es su propio hecho. */
function comoSeLlama(m: MovimientoDeDinero): string {
  if (m.tipoDeEgreso) return ETIQUETA_DE_EGRESO[m.tipoDeEgreso]
  if (m.tipoDeIngreso) return ETIQUETA_DE_INGRESO[m.tipoDeIngreso]
  if (m.tipo === 'saldo_inicial') return 'Saldo inicial'

  return m.tipo
}

/**
 * Anular — con motivo, y en un modal.
 *
 * El modal y no un `confirm()`: hay que escribir un motivo de al menos diez
 * caracteres, y un diálogo nativo no tiene dónde. Además deja decir qué va a
 * pasar con el saldo antes de confirmar, que es lo que hace la acción
 * entendible: anular un gasto devuelve la plata, anular un ingreso la quita.
 */
function Anular({ movimiento: m }: { movimiento: MovimientoDeDinero }) {
  const [abierto, setAbierto] = useState(false)
  const [estado, accion, enviando] = useActionState(anularMovimientoAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  const sale = m.efecto.startsWith('-')

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="aq-boton aq-boton-secundario aq-boton-compacto"
      >
        Anular
      </button>

      <Modal abierto={abierto} cerrar={() => setAbierto(false)} titulo="Anular el movimiento">
        <form action={accion} className="grid gap-4">
          <input type="hidden" name="movimientoId" value={m.id} />

          <div className="grid gap-1">
            <p className="text-[15px] text-principal">
              {m.concepto} — <span className="aq-cifra">{pesos(m.monto)}</span>
            </p>
            {/*
              Qué le va a pasar al saldo, dicho antes de confirmar. Es una
              acción que mueve plata y no se puede deshacer: un movimiento
              anulado no se vuelve a anular ni se reactiva.
            */}
            <p className="text-[13px] text-secundario">
              {sale
                ? `Anularlo devuelve ${pesos(m.monto)} a ${m.cuenta}.`
                : `Anularlo quita ${pesos(m.monto)} de ${m.cuenta}. Si esa plata ya se gastó, el sistema lo va a rechazar.`}
            </p>
          </div>

          <FormError id={idError}>{estado.error}</FormError>

          <label className="aq-etiqueta-campo">
            <span>Por qué se anula</span>
            <textarea
              name="motivo"
              required
              minLength={LARGO_MINIMO_MOTIVO}
              rows={3}
              placeholder="Quedó registrado en la caja equivocada"
              className="aq-campo"
            />
            <span className="text-[12px] font-normal normal-case text-tenue">
              Al menos {LARGO_MINIMO_MOTIVO} caracteres. Es lo que va a explicar el descuadre
              dentro de tres meses.
            </span>
          </label>

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={enviando} className="aq-boton aq-boton-primario">
              {enviando ? 'Anulando…' : 'Anular'}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="aq-boton aq-boton-secundario"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
