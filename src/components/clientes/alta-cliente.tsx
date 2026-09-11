'use client'

import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useId, useState } from 'react'
import { crearClienteAction, type EstadoDeAlta } from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { AgregarDireccion } from '@/components/clientes/acciones-de-cliente'
import { DocumentoPrimero, type EstadoDelDocumento } from '@/components/clientes/documento-primero'
import { CamposDeNombre } from '@/components/clientes/campos-de-nombre'
import type { Departamento, Municipio } from '@/lib/api-types'
import { useAvisoDeExito } from '@/lib/formulario-cliente'

const INICIAL: EstadoDeAlta = {}

/**
 * Alta de cliente — RN-CLI-13 y RN-CLI-17.
 *
 * ── Dos pasos, y el segundo NO bloquea ──────────────────────────────────────
 *
 * El primero es lo que hace falta para que el cliente exista: cómo se llama,
 * qué documento tiene y a qué número llamarlo. Con eso ya está registrado y se
 * le puede vender.
 *
 * El segundo es la dirección. Va aparte por una razón técnica y una humana. La
 * técnica: `POST /clientes/:id/direcciones` necesita un cliente que ya exista,
 * así que antes del primer paso no hay dónde guardarla. La humana: la dirección
 * es el campo más largo del sistema —vía, placa, municipio, departamento,
 * indicaciones y un mapa— y ponerla antes de guardar convierte el alta en un
 * trámite que se abandona a la mitad.
 *
 * Un cliente sin dirección es un cliente válido. Uno que nadie registró porque
 * el formulario era largo, no.
 *
 * ── El documento se pide siempre, y el DV NO ────────────────────────────────
 *
 * No hay campo para el dígito de verificación: es una función del número base
 * definida por norma, así que pedirlo sería pedir un dato que el sistema ya
 * sabe — y abrir la puerta a que alguien lo escriba mal.
 */
export function AltaDeCliente({
  departamentos,
  municipios,
}: {
  departamentos: Departamento[]
  municipios: Municipio[]
}) {
  const [estado, accion, enviando] = useActionState(crearClienteAction, INICIAL)
  const idError = useId()

  /*
   * El tipo vive en estado porque decide QUÉ CAMPOS se ven: una persona tiene
   * nombre y apellidos, un negocio tiene razón social. Es la única pregunta del
   * formulario que cambia el formulario.
   */
  const [tipo, setTipo] = useState<'residencial' | 'comercial'>('residencial')

  /*
   * El tipo de documento es CONTROLADO, y eso no es un detalle.
   *
   * Con `defaultValue` el `<select>` solo mira ese valor al montar: elegir «Un
   * negocio» dejaba el documento en «Cédula de ciudadanía», porque cambiar el
   * tipo no remonta nada. Un negocio con CC es un dato mal cargado que después
   * nadie sabe si fue error o decisión.
   *
   * Elegir el tipo PROPONE el documento que corresponde; sigue pudiendo
   * cambiarse, porque hay negocios pequeños que operan con la cédula del dueño.
   */
  const [tipoDocumento, setTipoDocumento] = useState<'CC' | 'NIT'>('CC')

  /*
   * Si ese documento ya está tomado no hay nada que registrar, y el botón lo
   * dice en vez de dejar intentar. La barrera real sigue siendo el índice único
   * de la base: esto solo evita el viaje y el mensaje de error al final.
   */
  const [estadoDelDocumento, setEstadoDelDocumento] = useState<EstadoDelDocumento>('vacio')
  const documentoTomado = estadoDelDocumento === 'tomado'

  function elegirTipo(nuevo: 'residencial' | 'comercial') {
    setTipo(nuevo)
    setTipoDocumento(nuevo === 'comercial' ? 'NIT' : 'CC')
  }

  const router = useRouter()

  useAvisoDeExito(estado)

  /*
   * ── Cómo se cierra el segundo paso ────────────────────────────────────────
   *
   * `useActionState` no se puede reiniciar, y el cliente creado se queda en su
   * estado para siempre. Así que en vez de borrarlo se anota cuál token ya se
   * dio por cerrado, y el paso se DERIVA de esa comparación — el mismo patrón
   * que `useLimpiezaAlRegistrar`, sin efectos.
   *
   * La primera versión de esto era un enlace a `/modulos/clientes`. No servía:
   * es la pantalla en la que ya se está, así que no reiniciaba nada.
   */
  const [tokenCerrado, setTokenCerrado] = useState<string | undefined>(undefined)
  const recienCreado = estado.token && estado.token !== tokenCerrado ? estado.cliente : undefined

  if (recienCreado) {
    return (
      <div className="aq-tarjeta grid gap-5 p-5">
        <div className="flex items-start gap-3">
          <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-exito" />
          <div>
            <h2 className="aq-titulo-tarjeta text-principal">
              {recienCreado.nombre} quedó registrado
            </h2>
            <p className="mt-1 text-[13px] text-tenue">
              Ya se le puede vender. Si sabe dónde vive, cárguelo ahora; si no, queda para
              cuando lo sepa.
            </p>
          </div>
        </div>

        {/*
          El aviso de cruce se queda acá arriba porque hay que decidir algo: ese
          número ya existe con el otro tipo de documento.
        */}
        {estado.aviso ? <AvisoDeCruce aviso={estado.aviso} /> : null}

        <section className="grid gap-4">
          <h3 className="aq-micro text-tenue">Dónde queda</h3>
          <AgregarDireccion
            clienteId={recienCreado.id}
            departamentos={departamentos}
            municipios={municipios}
          />
        </section>

        {/*
          La salida sin dirección va A LA VISTA, no escondida.

          Si el único botón visible dijera «guardar dirección», el paso sería
          opcional en el código y obligatorio en la práctica: nadie se anima a
          irse de un formulario a medio llenar.

          Recarga la pantalla en vez de limpiar el estado a mano — así la lista
          de clientes de arriba muestra al recién creado.
        */}
        <div className="border-t border-sutil pt-4">
          <button
            type="button"
            onClick={() => {
              setTokenCerrado(estado.token)
              // Para que la lista de arriba muestre al recién creado.
              router.refresh()
            }}
            className="aq-boton aq-boton-secundario"
          >
            Listo, la dirección puede esperar
          </button>
        </div>
      </div>
    )
  }

  return (
    <form action={accion} className="aq-tarjeta grid gap-5 p-5">
      <div>
        <h2 className="aq-titulo-tarjeta text-principal">Nuevo cliente</h2>
        <p className="mt-1 text-[13px] text-tenue">
          Lo necesario para que exista y se le pueda vender. La dirección viene después.
        </p>
      </div>

      <FormError id={idError}>{estado.error}</FormError>

      {estado.aviso ? <AvisoDeCruce aviso={estado.aviso} /> : null}

      {/*
        ── El documento va primero ────────────────────────────────────────────

        Es el único dato que puede decir «este cliente ya existe». Pedirlo
        quinto —después de cuatro campos de nombre— hacía que el rechazo por
        duplicado llegara recién al enviar, con todo el trabajo ya hecho.

        El índice único de la base sigue siendo la garantía; esto solo mueve el
        aviso al principio.
      */}
      <DocumentoPrimero
        tipoDocumento={tipoDocumento}
        onTipoDocumento={setTipoDocumento}
        onEstado={setEstadoDelDocumento}
      />

      {/*
        La segunda pregunta, y la que manda sobre el resto: de acá sale si se
        piden nombre y apellidos o la razón social del negocio.
      */}
      <fieldset className="grid gap-2">
        <legend className="aq-micro text-tenue">Quién es</legend>
        <div className="flex flex-wrap gap-2">
          {(['residencial', 'comercial'] as const).map((opcion) => (
            <label key={opcion} className="aq-ficha">
              <input
                type="radio"
                name="tipo"
                value={opcion}
                checked={tipo === opcion}
                onChange={() => elegirTipo(opcion)}
                className="sr-only"
              />
              <span className="aq-ficha-caja" aria-hidden />
              {opcion === 'residencial' ? 'Una persona' : 'Un negocio'}
            </label>
          ))}
        </div>
        <p className="text-[13px] text-tenue">
          Decide qué lista de precios se le aplica, y se puede cambiar después.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <CamposDeNombre tipo={tipo} />

        {/*
          El teléfono va acá y no en un paso aparte porque es lo que convierte
          un registro en algo útil: la cartera por edad dice a quién llamar
          primero, y sin número no hay a quién llamar. Lo pidió la demo.
        */}
        <label className="aq-etiqueta-campo sm:col-span-2">
          <span>
            Teléfono <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="300 123 4567"
            className="aq-campo aq-cifra"
          />
          <span className="mt-1 font-normal normal-case text-[13px] text-tenue">
            Se le pueden agregar más después, con su etiqueta.
          </span>
        </label>
      </div>

      {/*
        El botón dice POR QUÉ no se puede, no solo que no se puede. Un botón
        apagado sin explicación manda a quien registra a buscar el error en los
        campos, que es el único lugar donde no está.
      */}
      <button
        type="submit"
        disabled={enviando || documentoTomado}
        className="aq-boton aq-boton-primario justify-self-start"
      >
        {enviando
          ? 'Registrando…'
          : documentoTomado
            ? 'Ese cliente ya existe'
            : 'Registrar cliente'}
      </button>
    </form>
  )
}

/**
 * El cruce CC/NIT NO es un error, y por eso no va en `<FormError>`.
 *
 * El cliente SE CREÓ. Esto avisa que el mismo número ya existe con el otro tipo
 * de documento, que puede ser la misma persona —el NIT de una persona natural
 * se basa en su cédula— o un duplicado entrando por la puerta de atrás. El
 * sistema no puede distinguirlos; quien registra sí.
 */
function AvisoDeCruce({ aviso }: { aviso: NonNullable<EstadoDeAlta['aviso']> }) {
  return (
    <div
      role="status"
      className="grid gap-1 rounded-lg border border-alerta-borde bg-alerta-fondo p-3 text-[14px] text-alerta-texto"
    >
      <p className="font-medium">Ojo: ese número ya está registrado</p>
      <p className="opacity-90">{aviso.mensaje}</p>
      <a
        href={`/modulos/clientes/${aviso.clienteExistente.id}`}
        className="mt-1 font-medium underline underline-offset-4"
      >
        Ver a {aviso.clienteExistente.nombre} →
      </a>
    </div>
  )
}
