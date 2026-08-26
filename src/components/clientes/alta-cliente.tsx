'use client'

import { useActionState, useId } from 'react'
import { crearClienteAction, type EstadoDeAlta } from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { useAvisoDeExito } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeAlta = {}

/**
 * Alta de cliente — RN-CLI-13.
 *
 * ── El documento se pide siempre, y el DV NO ────────────────────────────────
 *
 * No hay campo para el dígito de verificación, y es a propósito: es una función
 * del número base definida por norma, así que pedirlo sería pedir un dato que el
 * sistema ya sabe — y abrir la puerta a que alguien lo escriba mal.
 *
 * El número se acepta como lo dicten: `900.123.456-8`, con espacios o pelado.
 * Normalizar es del servidor, que tiene una sola definición de qué es el número
 * base.
 */
export function AltaDeCliente() {
  const [estado, accion, enviando] = useActionState(crearClienteAction, INICIAL)
  const idError = useId()

  useAvisoDeExito(estado)

  return (
    /*
      El `key` remonta el formulario al crear: son campos no controlados y dejar
      lo anterior escrito invita a registrar el mismo cliente dos veces — que es
      justamente el duplicado que RN-CLI-08 viene a evitar.
    */
    <form key={estado.token ?? 'inicial'} action={accion} className="aq-tarjeta grid gap-5 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Nuevo cliente</h2>
        <p className="mt-1 text-[13px] text-tenue">
          El documento se pide desde el primer momento. Comprobarlo puede esperar; el dato
          no.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      {/*
        ── El cruce CC/NIT no es un error, y por eso no va en `<FormError>` ────

        El cliente SE CREÓ. Esto avisa que el mismo número ya existe con el otro
        tipo de documento, que puede ser la misma persona —el NIT de una persona
        natural se basa en su cédula— o un duplicado entrando por la puerta de
        atrás. El sistema no puede distinguirlos; quien registra sí.

        Se queda en pantalla en vez de irse como toast: hay que decidir algo.
      */}
      {estado.aviso ? (
        <div
          role="status"
          className="grid gap-1 rounded-lg border border-alerta-borde bg-alerta-fondo p-3 text-[14px] text-alerta-texto"
        >
          <p className="font-medium">Ojo: ese número ya está registrado</p>
          <p className="opacity-90">{estado.aviso.mensaje}</p>
          <a
            href={`/modulos/clientes/${estado.aviso.clienteExistente.id}`}
            className="mt-1 font-medium underline underline-offset-4"
          >
            Ver a {estado.aviso.clienteExistente.nombre} →
          </a>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo sm:col-span-2">
          <span>Nombre</span>
          <input
            name="nombre"
            required
            autoComplete="off"
            placeholder="Yeimy Rodríguez"
            className="aq-campo"
          />
        </label>

        <label className="aq-etiqueta-campo">
          <span>Tipo de documento</span>
          <select name="tipoDocumento" defaultValue="CC" className="aq-campo">
            <option value="CC">Cédula de ciudadanía</option>
            <option value="NIT">NIT</option>
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Número</span>
          <input
            name="numeroDocumento"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="79123456"
            className="aq-campo aq-cifra"
          />
          <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
            Sin el dígito de verificación: lo calcula el sistema.
          </span>
        </label>

        <label className="aq-etiqueta-campo">
          <span>Tipo de cliente</span>
          <select name="tipo" defaultValue="residencial" className="aq-campo">
            <option value="residencial">Residencial</option>
            <option value="comercial">Comercial</option>
          </select>
          <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
            Decide qué lista de precios se le aplica. Se puede cambiar después.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando ? 'Registrando…' : 'Registrar cliente'}
      </button>
    </form>
  )
}
