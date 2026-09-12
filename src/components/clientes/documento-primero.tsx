'use client'

import { AlertTriangle, Check, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { buscarClientesAction } from '@/app/(app)/modulos/clientes/actions'
import type { Cliente } from '@/lib/api-types'

/**
 * El documento va PRIMERO — M16.
 *
 * ── Por qué se movió ────────────────────────────────────────────────────────
 *
 * Es el único dato que puede decir «este cliente ya existe», y se pedía quinto:
 * después de cuatro campos de nombre. Quien registra escribía todo, daba
 * «Registrar», y **recién ahí** la base lo rechazaba por documento repetido.
 *
 * El índice único `clientes_documento_idx` ya impide el duplicado — la
 * integridad nunca estuvo en juego. Lo que estaba en juego es no hacer trabajar
 * al vicio.
 *
 * ── Dos casos que se parecen y no son lo mismo ──────────────────────────────
 *
 * · **Mismo tipo y mismo número**: ese cliente ya existe. No hay nada que
 *   registrar, y el aviso lleva a su ficha.
 * · **Mismo número, otro tipo**: puede ser legítimo. El NIT de una persona
 *   natural se basa en su cédula (RN-CLI-08). Se avisa y se sigue.
 *
 * Confundirlos sería caro en las dos direcciones: bloquear el cruce impide
 * registrar a alguien real, y dejar pasar el duplicado parte su deuda y sus
 * botellones en dos fichas, y ninguna de las dos es verdad.
 */

/** Lo mismo que exige `api`: con uno o dos, la respuesta sería casi todos. */
const MINIMO = 3

/** Sin esto, una cédula de ocho dígitos son ocho consultas a la base. */
const ESPERA_MS = 250

export type EstadoDelDocumento = 'vacio' | 'libre' | 'tomado' | 'cruce'

/**
 * El tipo de documento se CONTROLA desde afuera, y es a propósito.
 *
 * Elegir «Un negocio» propone NIT y «Una persona» propone cédula — esa regla
 * vive en el formulario padre, junto a la pregunta que la dispara. Si este
 * componente tuviera el tipo en su propio estado, habría que sincronizarlo con
 * un efecto, y esa es la clase de acoplamiento que después nadie recuerda.
 *
 * Sigue pudiendo cambiarse acá: hay negocios chicos que operan con la cédula
 * del dueño.
 */
export function DocumentoPrimero({
  tipoDocumento = 'CC',
  onTipoDocumento,
  numero: numeroControlado,
  onNumero,
  onEstado,
}: {
  tipoDocumento?: 'CC' | 'NIT'
  onTipoDocumento?: (tipo: 'CC' | 'NIT') => void
  /**
   * El número también se puede controlar desde afuera.
   *
   * El alta en pasos lo necesita: arranca con lo que ya se tecleó en el buscador
   * de la venta, y lo manda al final junto con el resto. Sin esto habría que
   * espejarlo con un efecto, que es la clase de sincronización que se desfasa.
   *
   * Sin `numero`, el componente lo maneja solo — que es como lo usa el
   * formulario completo de Clientes.
   */
  numero?: string
  onNumero?: (numero: string) => void
  onEstado?: (estado: EstadoDelDocumento) => void
}) {
  const idNumero = useId()
  const [numeroPropio, setNumeroPropio] = useState('')

  const numero = numeroControlado ?? numeroPropio
  const setNumero = onNumero ?? setNumeroPropio

  /*
   * La respuesta se guarda CON lo que se preguntó, no sola. Dos consultas en
   * vuelo pueden volver al revés: si la de `7912` llega después de la de
   * `79123456`, el aviso hablaría de un número que ya nadie tiene escrito.
   *
   * Es el mismo mecanismo que `useDireccionesDe` y que la lista de clientes.
   */
  const [respuesta, setRespuesta] = useState<{ clave: string; clientes: Cliente[] } | null>(null)
  const [buscando, empezarBusqueda] = useTransition()
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const limpio = numero.replace(/\D/g, '')
  const clave = `${tipoDocumento}:${limpio}`
  const suficiente = limpio.length >= MINIMO

  useEffect(() => {
    clearTimeout(temporizador.current)
    if (!suficiente) return

    let vigente = true

    temporizador.current = setTimeout(() => {
      empezarBusqueda(async () => {
        const clientes = await buscarClientesAction(limpio)
        if (vigente) setRespuesta({ clave, clientes })
      })
    }, ESPERA_MS)

    return () => {
      vigente = false
      clearTimeout(temporizador.current)
    }
  }, [clave, limpio, suficiente])

  const alDia = respuesta?.clave === clave ? respuesta.clientes : null

  /*
   * ── Un PREFIJO no es una coincidencia ─────────────────────────────────────
   *
   * `?documento=` busca por prefijo: tecleando `79123` vuelven todos los que
   * empiezan así. Tomar eso como «ya existe» bloquearía a quien todavía no
   * terminó de escribir su número.
   */
  const exactos = alDia?.filter((c) => c.numeroDocumento === limpio) ?? []
  const mismoTipo = exactos.find((c) => c.tipoDocumento === tipoDocumento)
  const otroTipo = exactos.find((c) => c.tipoDocumento !== tipoDocumento)

  const estado: EstadoDelDocumento = !suficiente
    ? 'vacio'
    : alDia === null
      ? 'vacio'
      : mismoTipo
        ? 'tomado'
        : otroTipo
          ? 'cruce'
          : 'libre'

  /*
   * El aviso al padre va en un efecto y no en el render: llamarlo mientras se
   * renderiza haría que el padre cambie de estado durante el render del hijo.
   */
  useEffect(() => {
    onEstado?.(estado)
  }, [estado, onEstado])

  return (
    <fieldset className="grid gap-3">
      <legend className="aq-micro text-tenue">El documento, primero</legend>

      <p className="text-[13px] text-tenue">
        Se comprueba mientras lo escribe: si ese cliente ya está, no hace falta cargarlo de
        nuevo.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Tipo de documento</span>
          <select
            name="tipoDocumento"
            value={tipoDocumento}
            onChange={(e) => onTipoDocumento?.(e.target.value as 'CC' | 'NIT')}
            className="aq-campo"
          >
            <option value="CC">Cédula de ciudadanía</option>
            <option value="NIT">NIT</option>
          </select>
        </label>

        {/*
          Sin icono de lupa, y por dos razones.

          La de forma: el `<div className="relative">` que hacía falta para
          posicionarlo rompía la alineación con el select de al lado — medido,
          14 px de desfase vertical en una fila de dos campos.

          La de fondo: una lupa dice «esto es un buscador». Esto no lo es. Es el
          documento del cliente que se está registrando, y que además se
          comprueba. Prometer búsqueda invita a usarlo para buscar, que es lo que
          hace el campo de arriba.
        */}
        <label htmlFor={idNumero} className="aq-etiqueta-campo">
          <span>Número</span>
          <input
            id={idNumero}
            name="numeroDocumento"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="79123456"
            className="aq-campo aq-cifra"
          />
          <span className="mt-1 font-normal normal-case text-[13px] text-tenue">
            Sin el dígito de verificación: lo calcula el sistema.
          </span>
        </label>
      </div>

      {/*
        El resultado se DICE siempre, incluso el bueno. Sin confirmación, quien
        escribe no sabe si el sistema comprobó algo o si se quedó callado porque
        falló — y en la duda, carga el cliente igual.
      */}
      <div aria-live="polite">
        {buscando && estado === 'vacio' ? (
          <p className="text-[13px] text-tenue">Comprobando…</p>
        ) : mismoTipo ? (
          <YaExiste cliente={mismoTipo} />
        ) : otroTipo ? (
          <Cruce cliente={otroTipo} />
        ) : estado === 'libre' ? (
          <p className="flex items-center gap-1.5 text-[13px] text-exito-texto">
            <Check aria-hidden className="size-4 shrink-0" />
            Ese documento está libre. Se puede registrar.
          </p>
        ) : null}
      </div>
    </fieldset>
  )
}

/** El caso que frena: ese cliente ya está cargado con ese mismo documento. */
function YaExiste({ cliente }: { cliente: Cliente }) {
  return (
    <div className="grid gap-2 rounded-lg border border-error-borde bg-error-fondo p-3 text-error-texto">
      <p className="flex items-start gap-2 text-[13px]">
        <UserCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold">{cliente.nombre}</strong> ya está registrado con
          ese documento. No hace falta cargarlo otra vez.
        </span>
      </p>

      {/*
        El enlace es lo que convierte el aviso en algo accionable. Sin él, quien
        registra sabe que no puede seguir y no sabe a dónde ir.
      */}
      <Link
        href={`/modulos/clientes/${cliente.id}`}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        Ver su ficha
      </Link>
    </div>
  )
}

/** El caso que avisa y deja seguir — RN-CLI-08. */
function Cruce({ cliente }: { cliente: Cliente }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-alerta-borde bg-alerta-fondo p-3 text-[13px] text-alerta-texto">
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        Ese número ya existe como <strong className="font-semibold">{cliente.tipoDocumento}</strong>
        , a nombre de {cliente.nombre}. Puede ser la misma persona —el NIT de alguien se basa en
        su cédula— o un duplicado entrando por otra puerta. Si es la misma, use ese registro.
      </span>
    </p>
  )
}
