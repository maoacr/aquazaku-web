'use client'

import { useActionState, useId, useState } from 'react'
import {
  ajustarInsumoAction,
  cargarEquivalenciaAction,
  descartarInsumoAction,
  type EstadoDeFormulario,
  registrarEntradaAction,
} from '@/app/(app)/modulos/insumos/actions'
import { FormError } from '@/components/auth/form-error'
import type { InsumoListado } from '@/lib/api-types'
import { limpiezaKey, useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeFormulario = {}

/**
 * El aviso de resultado, igual en los cuatro formularios.
 *
 * El ERROR se queda en pantalla, junto al formulario: un error que desaparece
 * obliga a recordar qué decía mientras se corrige.
 *
 * El ÉXITO se va como toast. No hace falta volver a leerlo, y dejarlo fijo
 * ensuciaba el formulario con la confirmación del movimiento anterior mientras
 * se cargaba el siguiente.
 */
function Resultado({ estado }: { estado: EstadoDeFormulario }) {
  useAvisoDeExito(estado)

  return <FormError id="insumo-error">{estado.error}</FormError>
}

/** El desplegable de insumos, compartido por los tres formularios de movimiento. */
function SelectorDeInsumo({ insumos, valor, alCambiar }: {
  insumos: InsumoListado[]
  valor: string
  alCambiar: (id: string) => void
}) {
  return (
    <label className="aq-etiqueta-campo">
      <span>Insumo</span>
      <select
        name="insumoId"
        required
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="aq-campo"
      >
        <option value="">Elija uno</option>
        {insumos.map((i) => (
          <option key={i.id} value={i.id}>
            {i.codigo} — {i.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

/**
 * Registrar una compra — en unidades o en kilos.
 *
 * ── Por qué la conversión se muestra ANTES de confirmar ─────────────────────
 *
 * Convertir en silencio es lo que hace que un descuadre sea imposible de
 * explicar después. Quien carga 12 kg tiene que ver «≈ 1.200 unidades» y poder
 * decir «ese número no puede ser» ANTES de escribirlo en el libro.
 *
 * Y el selector de kilos **solo aparece si el insumo tiene equivalencia**. No
 * es un permiso: es que sin la medición no hay con qué convertir, y ofrecer el
 * campo sería prometer algo que va a fallar al enviar.
 */
export function EntradaDeInsumo({ insumos }: { insumos: InsumoListado[] }) {
  const [estado, accion, enviando] = useActionState(registrarEntradaAction, INICIAL)
  const [insumoId, setInsumoId] = useState('')
  const [medida, setMedida] = useState<'unidad' | 'kilo'>('unidad')
  const [valor, setValor] = useState('')

  useLimpiezaAlRegistrar(estado.token, () => {
    setInsumoId('')
    setMedida('unidad')
    setValor('')
  })

  const insumo = insumos.find((i) => i.id === insumoId)
  const equivalencia = insumo?.equivalenciaPorKilo ? Number(insumo.equivalenciaPorKilo) : null
  const porKilo = medida === 'kilo' && equivalencia !== null
  const unidadesResultantes = porKilo && valor ? Math.round(Number(valor) * equivalencia) : null

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Registrar entrada</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Una compra que llegó. El saldo se cuenta siempre en unidades.
        </p>
      </div>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectorDeInsumo
          insumos={insumos}
          valor={insumoId}
          alCambiar={(id) => {
            setInsumoId(id)
            // Volver a unidades al cambiar de insumo: el nuevo puede no tener
            // equivalencia, y dejar «kilos» seleccionado prometería convertir.
            setMedida('unidad')
          }}
        />

        <label className="aq-etiqueta-campo">
          <span>Se compró por</span>
          <select
            value={medida}
            onChange={(e) => setMedida(e.target.value as 'unidad' | 'kilo')}
            disabled={equivalencia === null}
            className="aq-campo"
          >
            <option value="unidad">Unidades</option>
            <option value="kilo">Kilos</option>
          </select>
          <input type="hidden" name="medida" value={medida} />
        </label>

        <label className="aq-etiqueta-campo">
          <span>{porKilo ? 'Kilos' : 'Unidades'}</span>
          <input
            name="valor"
            type="number"
            required
            min={porKilo ? '0.001' : '1'}
            step={porKilo ? '0.001' : '1'}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="aq-campo"
          />
        </label>
      </div>

      {equivalencia === null && insumoId ? (
        <p className="text-[13px] text-tenue">
          Este insumo no tiene medida cuántas unidades trae un kilo, así que la compra se
          carga en unidades. Cargue la equivalencia abajo para poder registrarla por peso.
        </p>
      ) : null}

      {unidadesResultantes !== null ? (
        // Se muestra el cálculo completo, no solo el resultado: así se puede
        // detectar que la equivalencia está vieja sin abrir el movimiento.
        <p className="rounded-lg border border-sutil px-3 py-2 text-[14px] text-principal">
          Van a entrar{' '}
          <span className="aq-cifra font-semibold">{unidadesResultantes.toLocaleString('es-CO')}</span>{' '}
          unidades — <span className="aq-cifra">{valor}</span> kg ×{' '}
          <span className="aq-cifra">{equivalencia}</span> por kilo.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando || !insumoId}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar entrada'}
      </button>
    </form>
  )
}

/** Ajustar contra un conteo físico. La diferencia va con signo. */
export function AjusteDeInsumo({ insumos }: { insumos: InsumoListado[] }) {
  const [estado, accion, enviando] = useActionState(ajustarInsumoAction, INICIAL)
  const [insumoId, setInsumoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const ayudaId = useId()

  useLimpiezaAlRegistrar(estado.token, () => {
    setInsumoId('')
    setMotivo('')
  })

  const faltan = Math.max(0, 10 - motivo.trim().length)

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Ajustar un insumo</h2>
        <p className="mt-1 text-[13px] text-tenue">
          El conteo físico siempre difiere. Positivo si sobran unidades, negativo si faltan.
        </p>
      </div>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectorDeInsumo insumos={insumos} valor={insumoId} alCambiar={setInsumoId} />

        <label className="aq-etiqueta-campo">
          <span>Diferencia</span>
          <input
            key={limpiezaKey(estado, 'diferencia')}
            name="diferencia"
            type="number"
            required
            step="1"
            placeholder="-8"
            className="aq-campo"
          />
        </label>
      </div>

      <label className="aq-etiqueta-campo">
        <span>Motivo</span>
        <textarea
          name="motivo"
          required
          rows={2}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-describedby={ayudaId}
          placeholder="Por ejemplo: conteo físico del lunes, faltaban 8 tapas"
          className="aq-campo"
        />
      </label>

      <p id={ayudaId} className="text-[13px] text-tenue">
        {faltan > 0
          ? `Faltan ${faltan} caracteres. Tiene que servir para entender el registro dentro de tres meses.`
          : 'Queda en la auditoría, con quién lo registró.'}
      </p>

      <button
        type="submit"
        disabled={enviando || !insumoId}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar ajuste'}
      </button>
    </form>
  )
}

/** Descartar unidades. La causa es obligatoria: sin clasificar, no se descarta. */
export function DescarteDeInsumo({ insumos }: { insumos: InsumoListado[] }) {
  const [estado, accion, enviando] = useActionState(descartarInsumoAction, INICIAL)
  const [insumoId, setInsumoId] = useState('')
  const [causa, setCausa] = useState('')

  useLimpiezaAlRegistrar(estado.token, () => {
    setInsumoId('')
    setCausa('')
  })

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Descartar unidades</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Se rompieron o se mojaron. Sale del saldo y queda registrado con su causa.
        </p>
      </div>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectorDeInsumo insumos={insumos} valor={insumoId} alCambiar={setInsumoId} />

        <label className="aq-etiqueta-campo">
          <span>Unidades</span>
          <input
            key={limpiezaKey(estado, 'cantidad')}
            name="cantidad"
            type="number"
            required
            min="1"
            step="1"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Causa</span>
          <select
            name="causa"
            required
            value={causa}
            onChange={(e) => setCausa(e.target.value)}
            className="aq-campo"
          >
            <option value="">Elija una</option>
            <option value="falla_produccion">Falla de producción</option>
            <option value="mal_manejo_cliente">Mal manejo</option>
            <option value="vencido">Vencido</option>
            <option value="otro">Otro</option>
          </select>
        </label>
      </div>

      {causa === 'otro' ? (
        // `otro` no dice nada por sí solo: sin explicación, esa fila de la
        // auditoría es ruido dentro de tres meses.
        <label className="aq-etiqueta-campo">
          <span>Qué pasó</span>
          <textarea
            name="observaciones"
            required
            rows={2}
            minLength={10}
            className="aq-campo"
          />
        </label>
      ) : null}

      <button
        type="submit"
        disabled={enviando || !insumoId}
        className="aq-boton aq-boton-destructivo justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar descarte'}
      </button>
    </form>
  )
}

/**
 * Cargar la equivalencia medida en planta — cierra la pregunta 37 por insumo.
 *
 * Solo se ofrece para los insumos que NO la tienen. Es una medición que se hace
 * una vez, y ponerla junto a los que ya están medidos invitaría a «corregirla»
 * sin haber vuelto a pesar nada.
 */
export function CargarEquivalencia({ insumos }: { insumos: InsumoListado[] }) {
  const [estado, accion, enviando] = useActionState(cargarEquivalenciaAction, INICIAL)
  const sinMedir = insumos.filter((i) => i.equivalenciaPorKilo === null)

  if (sinMedir.length === 0) return null

  return (
    <form action={accion} className="aq-tarjeta grid gap-4 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Cargar unidades por kilo</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Pese un paquete, cuente cuántas unidades trae y divida. Con ese número el sistema
          puede convertir una compra en kilos; sin él, la rechaza en vez de estimar.
        </p>
      </div>

      <Resultado estado={estado} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Insumo</span>
          <select
            key={limpiezaKey(estado, 'insumo-equivalencia')}
            name="insumoId"
            required
            defaultValue=""
            className="aq-campo"
          >
            <option value="">Elija uno</option>
            {sinMedir.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} — {i.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Unidades por kilo</span>
          <input
            key={limpiezaKey(estado, 'equivalencia')}
            name="equivalenciaPorKilo"
            type="number"
            required
            min="0.001"
            step="0.001"
            className="aq-campo"
          />
        </label>
      </div>

      <button type="submit" disabled={enviando} className="aq-boton aq-boton-secundario justify-self-start">
        {enviando ? 'Guardando…' : 'Guardar equivalencia'}
      </button>
    </form>
  )
}
