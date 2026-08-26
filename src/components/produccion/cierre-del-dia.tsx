'use client'

import { useActionState, useId, useState } from 'react'
import {
  type EstadoDeFormulario,
  registrarCierreAction,
} from '@/app/(app)/modulos/produccion/actions'
import { FormError } from '@/components/auth/form-error'
import { VistaPrevia } from '@/components/produccion/vista-previa'
import type {
  InsumoListado,
  NivelDeTanque,
  ParametrosDeProduccion,
  Producto,
  SaldoDeAgua,
} from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'
import { preverCierre } from '@/lib/produccion'

const INICIAL: EstadoDeFormulario = {}

/** Los cinco niveles, con el texto que se dice en la planta — RN-PRD-11. */
const NIVELES: { valor: NivelDeTanque; texto: string }[] = [
  { valor: 'vacio', texto: 'Vacío' },
  { valor: 'un_cuarto', texto: 'Un cuarto' },
  { valor: 'medio', texto: 'Medio' },
  { valor: 'tres_cuartos', texto: 'Tres cuartos' },
  { valor: 'lleno', texto: 'Lleno' },
]

/** Hoy en `YYYY-MM-DD`, en la hora local de quien mira. */
function hoy(): string {
  const ahora = new Date()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')

  return `${ahora.getFullYear()}-${mes}-${String(ahora.getDate()).padStart(2, '0')}`
}

/**
 * El cierre del día — RN-PRD-07 y RN-PRD-08.
 *
 * ── Una sola pantalla, y la vista previa antes de confirmar ─────────────────
 *
 * Un cierre mueve tres saldos de una vez —agua, stock e insumos— y **no se
 * puede deshacer**. Por eso todo lo que va a pasar se muestra antes: cuántos
 * litros se descuentan, cuántas tapas y sellos, y qué lote se genera.
 *
 * Confirmar a ciegas es lo que hace que un error se descubra tres días después,
 * cuando ya no se sabe cuál de los tres números era el equivocado.
 *
 * ── El botón NO se bloquea por los avisos ───────────────────────────────────
 *
 * La pantalla anticipa lo que `api/` va a rechazar —falta la medición del
 * lavado, no alcanzan las tapas—, pero deshabilitar el botón por eso sería
 * mover la regla acá. La regla vive en `api/`, que responde con el mensaje que
 * dice qué hacer (RN-ACC-02). Lo que hace la pantalla es avisar antes, no
 * decidir.
 *
 * La única excepción es `required` en los campos: eso es forma, no regla.
 */
export function CierreDelDia({
  parametros,
  catalogo,
  insumos,
  aguaProcesada,
}: {
  parametros: ParametrosDeProduccion
  catalogo: Producto[]
  insumos: InsumoListado[]
  aguaProcesada: SaldoDeAgua | undefined
}) {
  const [estado, accion, enviando] = useActionState(registrarCierreAction, INICIAL)
  const idError = useId()

  const [minutos, setMinutos] = useState('')
  const [caudal, setCaudal] = useState('')
  const [pacas600, setPacas600] = useState('')
  const [pacas300, setPacas300] = useState('')
  const [llenados, setLlenados] = useState('')
  const [lavados, setLavados] = useState('')
  const [litrosPorLavado, setLitrosPorLavado] = useState('')

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => {
    setMinutos('')
    setCaudal('')
    setPacas600('')
    setPacas300('')
    setLlenados('')
    setLavados('')
    setLitrosPorLavado('')
  })

  const numero = (texto: string) => (texto.trim() === '' ? 0 : Number(texto))
  const opcional = (texto: string) => (texto.trim() === '' ? undefined : Number(texto))

  const previa = preverCierre(
    {
      minutosProcesando: numero(minutos),
      pacas600: numero(pacas600),
      pacas300: numero(pacas300),
      botellonesLlenados: numero(llenados),
      botellonesLavados: numero(lavados),
      caudalGpm: opcional(caudal),
      litrosPorLavado: opcional(litrosPorLavado),
    },
    parametros,
    catalogo,
  )

  const seEnvasoAlgo = previa.lotes.length > 0 || numero(lavados) > 0

  return (
    <form action={accion} className="aq-tarjeta grid gap-5 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Cerrar el día</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Un cierre por día. Mueve el agua, el stock y los insumos de una vez, y no se
          deshace: lo que se corrige después es con un ajuste.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="aq-etiqueta-campo">
          <span>Fecha</span>
          <input
            name="fecha"
            type="date"
            required
            defaultValue={hoy()}
            max={hoy()}
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Minutos procesando</span>
          <input
            name="minutosProcesando"
            type="number"
            required
            min="1"
            step="1"
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>
            Caudal <span className="font-normal normal-case">(GPM, opcional)</span>
          </span>
          <input
            name="caudalGpm"
            type="number"
            min="0.001"
            step="0.001"
            value={caudal}
            onChange={(e) => setCaudal(e.target.value)}
            className="aq-campo"
          />
        </label>
      </div>

      {/*
        El caudal es la pregunta 4 y todavía no se midió. Dejarlo vacío es una
        respuesta válida: el envasado se sabe igual, y lo único que queda sin
        calcular es cuánta agua se procesó. Poner un número inventado sería
        peor — el balance cerraría con una cifra que parece medida.
      */}
      {caudal.trim() === '' ? (
        <p className="text-[13px] text-tenue">
          Sin el caudal no podemos calcular cuánta agua se procesó, y el cierre queda
          igual de válido. Cuando se mida una vez con un balde y un cronómetro, el número
          entra acá y el balance del agua empieza a cuadrar.
        </p>
      ) : null}

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="aq-micro mb-2 text-tenue">Lo que se envasó</legend>

        <Conteo
          nombre="pacas600"
          etiqueta="Pacas de 600 ml"
          valor={pacas600}
          alCambiar={setPacas600}
        />
        <Conteo
          nombre="pacas300"
          etiqueta="Pacas de 300 ml"
          valor={pacas300}
          alCambiar={setPacas300}
        />
        <Conteo
          nombre="botellonesLlenados"
          etiqueta="Botellones llenados"
          valor={llenados}
          alCambiar={setLlenados}
        />
        <Conteo
          nombre="botellonesLavados"
          etiqueta="Botellones lavados"
          valor={lavados}
          alCambiar={setLavados}
        />
      </fieldset>

      {/*
        El campo de litros por lavado aparece SOLO si hubo lavados. Mostrarlo
        siempre invita a completarlo a ojo en un día que no se lavó nada.
      */}
      {numero(lavados) > 0 ? (
        <label className="aq-etiqueta-campo max-w-xs">
          <span>Litros por lavado</span>
          <input
            name="litrosPorLavado"
            type="number"
            min="0.001"
            step="0.001"
            value={litrosPorLavado}
            onChange={(e) => setLitrosPorLavado(e.target.value)}
            className="aq-campo"
          />
          <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
            Cuánta agua lleva enjuagar un botellón. Se mide una vez y sirve para siempre.
          </span>
        </label>
      ) : null}

      <label className="aq-etiqueta-campo max-w-xs">
        <span>
          Nivel del tanque crudo <span className="font-normal normal-case">(opcional)</span>
        </span>
        <select name="nivelObservado" defaultValue="" className="aq-campo">
          <option value="">No se miró</option>
          {NIVELES.map((n) => (
            <option key={n.valor} value={n.valor}>
              {n.texto}
            </option>
          ))}
        </select>
        <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
          Lo que se ve a ojo. Queda anotado en el cierre para poder comparar después
          contra lo que dice el libro.
        </span>
      </label>

      <VistaPrevia
        previa={previa}
        insumos={insumos}
        aguaProcesada={aguaProcesada}
        insumosPorBotellon={parametros.insumosPorBotellon}
        hayAlgoQueMostrar={seEnvasoAlgo || minutos.trim() !== ''}
      />

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar el cierre'}
      </button>
    </form>
  )
}

function Conteo({
  nombre,
  etiqueta,
  valor,
  alCambiar,
}: {
  nombre: string
  etiqueta: string
  valor: string
  alCambiar: (valor: string) => void
}) {
  return (
    <label className="aq-etiqueta-campo">
      <span>{etiqueta}</span>
      <input
        name={nombre}
        type="number"
        min="0"
        step="1"
        placeholder="0"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="aq-campo"
      />
    </label>
  )
}
