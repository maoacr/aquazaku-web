'use client'

import { useId, useState, useTransition } from 'react'
import { crearClienteRapidoAction } from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import {
  CamposDeNombre,
  faltaElNombre,
  NOMBRE_VACIO,
  type Nombre,
  soloLoEscrito,
} from '@/components/clientes/campos-de-nombre'
import { Modal } from '@/components/ui/modal'
import type { Cliente } from '@/lib/api-types'

/**
 * Registrar un cliente sin abandonar lo que se estaba haciendo — RN-ENV-09.
 *
 * ── El caso que la pide ─────────────────────────────────────────────────────
 *
 * Una venta sin cliente es válida y va a seguir siéndolo: quien llega con su
 * botellón, recarga y se va no tiene por qué dar sus datos. Es un intercambio y
 * el parque no se mueve.
 *
 * Pero si se lleva un envase sin devolver otro, ese envase es de la planta y
 * queda a cargo de alguien. Ahí el registro deja de ser opcional, y hoy eso
 * significaba salir de la venta, ir a Clientes, llenar el formulario largo y
 * volver — con el carrito vacío, porque el mostrador vive en memoria.
 *
 * ── Por qué NO hay un `<form>` acá adentro ──────────────────────────────────
 *
 * Este diálogo se monta dentro del `<form>` de la venta, y hay dos trampas:
 *
 * 1. Un `<form>` anidado es HTML inválido; el parser del servidor lo descarta.
 * 2. Peor: un campo con `name` dentro de un `<dialog>` que cuelga de un
 *    formulario **pertenece a ese formulario**. Los datos del alta viajarían
 *    en el `FormData` de la venta, y un `required` de acá bloquearía el cobro.
 *
 * Por eso los campos no llevan `name` ni `required`: son estado de React, se
 * validan en JavaScript, y la acción se llama a mano. Nada de esto existe para
 * el formulario que lo rodea.
 *
 * ── Lo mínimo, y el porqué de cada campo ────────────────────────────────────
 *
 * Nombre y documento porque sin eso no hay a quién reclamarle. Teléfono porque
 * reclamar es llamar, y un registro sin número no sirve para lo único que se
 * hizo. La dirección NO: esta persona está en el mostrador, no pidió domicilio,
 * y se completa después desde su ficha —donde ya vive el formulario con mapa—.
 */
export function AltaRapidaDeCliente({
  abierto,
  cerrar,
  documentoInicial = '',
  alRegistrar,
}: {
  abierto: boolean
  cerrar: () => void
  /** Lo que ya se había escrito en la búsqueda. No se pide dos veces. */
  documentoInicial?: string
  alRegistrar: (cliente: Cliente) => void
}) {
  const [nombre, setNombre] = useState<Nombre>(NOMBRE_VACIO)
  const [tipoDocumento, setTipoDocumento] = useState<'CC' | 'NIT'>('CC')
  const [numeroDocumento, setNumeroDocumento] = useState(documentoInicial)
  const [tipo, setTipo] = useState<'residencial' | 'comercial'>('residencial')
  const [telefono, setTelefono] = useState('')

  const idError = useId()
  const [error, setError] = useState<string | undefined>(undefined)
  const [guardando, empezarGuardado] = useTransition()

  const faltaNombre = faltaElNombre(tipo, nombre)
  const faltaDocumento = numeroDocumento.trim().length === 0
  // El mismo mínimo que el esquema de `api/`. Acá solo adelanta el rechazo.
  const telefonoCorto = telefono.trim().length > 0 && telefono.trim().length < 7

  function registrar() {
    if (faltaNombre || faltaDocumento || telefonoCorto) return

    setError(undefined)
    empezarGuardado(async () => {
      const resultado = await crearClienteRapidoAction({
        ...soloLoEscrito(nombre),
        tipo,
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim(),
        ...(telefono.trim() && { telefono: { numero: telefono.trim() } }),
      })

      if (!resultado.cliente) {
        setError(resultado.error ?? 'No pudimos registrar al cliente.')
        return
      }

      alRegistrar(resultado.cliente)
      cerrar()
    })
  }

  return (
    <Modal abierto={abierto} cerrar={cerrar} titulo="Registrar cliente">
      {/*
        ── El Enter no puede salir de acá ──────────────────────────────────
        
        Estos campos, aunque estén en un diálogo, **pertenecen al formulario
        que rodea al diálogo** — el de la venta. Un Enter escribiendo el
        nombre dispara el envío implícito de ESE formulario: registrar a un
        cliente cobraría la venta.
        
        Frenarlo no alcanza; hay que darle el significado que la gente espera,
        que acá es registrar.
      */}
      <div
        className="grid gap-4"
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          // En el botón, el Enter ya es su propio clic: frenarlo lo anularía.
          if (e.target instanceof HTMLButtonElement) return

          e.preventDefault()
          registrar()
        }}
      >
        <p className="text-[13px] text-tenue">
          Lo mínimo para poder reclamar el envase. La dirección y el resto se completan
          después desde su ficha.
        </p>

        {/* Va primero porque decide qué campos de nombre se muestran. */}
        <div className="flex flex-wrap gap-2">
          {(['residencial', 'comercial'] as const).map((opcion) => (
            <label key={opcion} className="aq-ficha">
              <input
                type="radio"
                /*
                 * Sin `name` dos radios no son un grupo, y un lector de
                 * pantalla no dice «1 de 2». El prefijo `_` es la convención
                 * de la casa para un campo que el servidor no lee — y acá
                 * importa más que nunca, porque el formulario que lo recibiría
                 * es el de la venta.
                 */
                name="_tipoDeCliente"
                checked={tipo === opcion}
                onChange={() => setTipo(opcion)}
                className="sr-only"
              />
              <span className="aq-ficha-caja" aria-hidden />
              {opcion === 'residencial' ? 'Una persona' : 'Un negocio'}
            </label>
          ))}
        </div>

        <FormError id={idError}>{error}</FormError>

        {/*
          Los MISMOS campos que el alta completa, y por la misma razón que ella
          los tiene: un negocio no lleva apellidos. Dos copias de estas
          etiquetas se separarían solas.
        */}
        <div className="grid gap-4 sm:grid-cols-2">
          <CamposDeNombre tipo={tipo} valor={nombre} onCambio={setNombre} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <label className="aq-etiqueta-campo">
            <span>Tipo</span>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as 'CC' | 'NIT')}
              className="aq-campo"
            >
              <option value="CC">CC</option>
              <option value="NIT">NIT</option>
            </select>
          </label>

          <label className="aq-etiqueta-campo">
            <span>Número de documento</span>
            <input
              inputMode="numeric"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              className="aq-campo aq-cifra"
            />
          </label>
        </div>

        <label className="aq-etiqueta-campo">
          <span>
            Teléfono{' '}
            <span className="font-normal normal-case">(para poder reclamar el envase)</span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="300 123 4567"
            className="aq-campo aq-cifra"
          />
          {telefonoCorto ? (
            <span className="font-normal normal-case text-[13px] text-alerta-texto">
              Un teléfono tiene al menos 7 dígitos.
            </span>
          ) : null}
        </label>

        <div className="flex flex-wrap gap-2">
          {/*
            `type="button"` en los dos, y no es cosmético: sin eso, el default
            de un botón es `submit`, y el formulario que lo recibiría es el de
            la venta. Registrar un cliente cobraría la venta.
          */}
          <button
            type="button"
            onClick={registrar}
            disabled={guardando || faltaNombre || faltaDocumento || telefonoCorto}
            className="aq-boton aq-boton-primario"
          >
            {guardando ? 'Registrando…' : 'Registrar y continuar'}
          </button>

          <button type="button" onClick={cerrar} className="aq-boton aq-boton-secundario">
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  )
}
