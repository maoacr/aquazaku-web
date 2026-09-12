'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useId, useRef, useState, useTransition } from 'react'
import { crearClienteRapidoAction, geografiaAction } from '@/app/(app)/modulos/clientes/actions'
import { FormError } from '@/components/auth/form-error'
import { CamposDeDireccion } from '@/components/clientes/campos-de-direccion'
import {
  CamposDeNombre,
  NOMBRE_VACIO,
  type Nombre,
  soloLoEscrito,
} from '@/components/clientes/campos-de-nombre'
import { DocumentoPrimero, type EstadoDelDocumento } from '@/components/clientes/documento-primero'
import { Modal } from '@/components/ui/modal'
import type { Cliente, Departamento, Municipio } from '@/lib/api-types'

/**
 * El alta de cliente, en tres pasos — M16.
 *
 * ── Por qué un stepper y no el formulario largo ─────────────────────────────
 *
 * El alta pedía nueve campos en una columna, y la dirección quedaba fuera: había
 * que registrar al cliente y después buscarlo otra vez para cargársela. En el
 * mostrador eso pasa con alguien esperando enfrente.
 *
 * Tres pasos, y cada uno contesta UNA pregunta:
 *
 *   1. **Quién es** — el documento primero, para no escribir nada si ya existe
 *   2. **A qué número llamarlo**
 *   3. **Dónde queda**
 *
 * ── Uno solo, usado en dos lugares ──────────────────────────────────────────
 *
 * El mismo componente vive en Clientes —detrás de un botón— y en el mostrador,
 * dentro de la venta. Antes eran dos altas distintas y **solo una ofrecía
 * cargar la dirección**: quien registraba desde el mostrador quedaba con un
 * cliente sin domicilio, y una base se presta a una DIRECCIÓN (RN-BAS-03).
 *
 * ── Y UN solo envío al final ────────────────────────────────────────────────
 *
 * `POST /clientes` acepta cliente, teléfono y dirección en una transacción. Con
 * tres envíos, un fallo en el tercero dejaría un cliente a medio cargar y quien
 * atiende no sabría qué quedó guardado.
 */

const PASOS = [
  { n: 1, titulo: 'Quién es' },
  { n: 2, titulo: 'A qué número llamarlo' },
  { n: 3, titulo: 'Dónde queda' },
] as const

/** Lo mismo que acepta `api`: más de cinco números es otra cosa, no un cliente. */
const MAXIMO_DE_TELEFONOS = 5

type Telefono = { id: number; numero: string; etiqueta: string }

let ultimoId = 0
const nuevoTelefono = (): Telefono => ({ id: ++ultimoId, numero: '', etiqueta: '' })

export function AltaEnPasos({
  abierto,
  cerrar,
  departamentos,
  municipios,
  documentoInicial = '',
  alCrear,
}: {
  abierto: boolean
  cerrar: () => void
  /**
   * El catálogo del DANE. **Opcional**: si no viene, se pide al llegar al paso
   * de la dirección.
   *
   * Este componente vive en cuatro pantallas —Clientes, el mostrador y las dos
   * de Retornables—. Exigirlo como prop obligaría a las cuatro a cargar 1122
   * municipios en cada visita por si alguien registra un cliente, y en el
   * mostrador eso es en cada venta.
   *
   * Clientes ya lo tiene a mano y lo pasa; el resto lo pide cuando hace falta,
   * que muchas veces es nunca.
   */
  departamentos?: Departamento[]
  municipios?: Municipio[]
  /** Lo que ya se había tecleado en el buscador de la venta. */
  documentoInicial?: string
  /** Para que quien lo abrió pueda elegirlo sin volver a buscarlo. */
  alCrear?: (cliente: Cliente) => void
}) {
  const idError = useId()
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [error, setError] = useState<string | undefined>(undefined)
  const [enviando, empezarEnvio] = useTransition()

  const [tipo, setTipo] = useState<'residencial' | 'comercial'>('residencial')
  const [tipoDocumento, setTipoDocumento] = useState<'CC' | 'NIT'>('CC')
  const [numeroDocumento, setNumeroDocumento] = useState(documentoInicial)
  const [estadoDelDocumento, setEstadoDelDocumento] = useState<EstadoDelDocumento>('vacio')
  const [nombre, setNombre] = useState<Nombre>(NOMBRE_VACIO)

  /*
   * Los teléfonos son una LISTA, con una fila vacía de arranque.
   *
   * Un comercial tiene el celular del dueño y el fijo del local, y son dos
   * cosas distintas: al primero se le escribe por WhatsApp, al segundo solo se
   * le llama. Con un solo campo, quien atiende captura uno y el otro se pierde
   * —y agregarlo después exige `clientes:editar`, que el `pos` no tiene—.
   *
   * Cada fila lleva su `id` para poder EDITARLA y BORRARLA sin ambigüedad. Por
   * posición también se podría, hasta que dos filas queden iguales —dos vacías
   * lo están— y borrar una borre las dos.
   *
   * (Como clave de React el índice alcanzaría: los campos son controlados y el
   * valor sale del estado. Se probó sacándolo, y los tests siguieron en verde.)
   */
  const [telefonos, setTelefonos] = useState<Telefono[]>(() => [nuevoTelefono()])

  function cambiarTelefono(id: number, campo: 'numero' | 'etiqueta', valor: string) {
    setTelefonos((previos) =>
      previos.map((t) => (t.id === id ? { ...t, [campo]: valor } : t)),
    )
  }

  /*
   * La dirección se lee del DOM al enviar, no se refleja en estado.
   *
   * `CamposDeDireccion` son doce campos con `name` —vía, placa, municipio,
   * departamento, coordenadas—, pensados para viajar en un `FormData`. Copiarlos
   * a estado sería mantener trece `useState` sincronizados con el único fin de
   * volver a armarlos al final.
   *
   * El `ref` apunta a la ZONA del paso 3 y no al formulario entero: los campos
   * del paso 1 también tienen `name`, y levantarlos a todos metería el
   * documento del cliente adentro de la dirección.
   */
  const zonaDireccion = useRef<HTMLDivElement>(null)

  /*
   * El catálogo, pedido al llegar al paso 3 y no antes.
   *
   * Se guarda en estado en vez de derivarse porque es una respuesta del
   * servidor: lo que llega se queda hasta que el modal se desmonte, que es al
   * cerrarlo. No hay carrera posible — se pide una sola vez.
   */
  const [catalogo, setCatalogo] = useState<{
    departamentos: Departamento[]
    municipios: Municipio[]
  } | null>(departamentos && municipios ? { departamentos, municipios } : null)

  function irAlPaso(siguiente: 1 | 2 | 3) {
    setPaso(siguiente)

    if (siguiente === 3 && !catalogo) {
      empezarEnvio(async () => setCatalogo(await geografiaAction()))
    }
  }

  const hayNombre = Boolean(
    tipo === 'comercial' ? nombre.nombreLibre?.trim() : nombre.primerNombre?.trim() && nombre.apellidos?.trim(),
  )
  const documentoServible = numeroDocumento.replace(/\D/g, '').length >= 3
  const documentoLibre = estadoDelDocumento === 'libre' || estadoDelDocumento === 'cruce'

  /*
   * El paso 1 exige documento Y nombre. Sin documento no hay a quién reclamarle
   * nada (RN-CLI-13), y sin nombre el cliente es una cédula suelta.
   *
   * También frena si el documento está TOMADO: avanzar sería hacer escribir un
   * nombre para un cliente que ya existe.
   */
  const puedeAvanzar = paso === 1 ? documentoServible && documentoLibre && hayNombre : true

  const escritos = telefonos.filter((t) => t.numero.trim().length > 0)
  const hayTelefonoCorto = escritos.some((t) => t.numero.trim().length < 7)

  function registrar() {
    if (hayTelefonoCorto) {
      setError('Un teléfono tiene al menos 7 dígitos. Bórrelo o complételo.')
      return
    }

    /*
     * Se leen los campos DE LA ZONA de la dirección, no los del formulario.
     *
     * Un `new FormData(formulario)` levanta todo lo que tenga `name` adentro —y
     * el paso 1 tiene `tipoDocumento` y `numeroDocumento`—, así que la
     * dirección viajaba con el documento del cliente metido dentro. Hoy no
     * rompe porque el esquema de `api` descarta lo que no conoce; el día que
     * alguien lo ponga en `strict` rebota el alta entera al final de los tres
     * pasos, que es el peor momento para enterarse.
     */
    const escrito = Object.fromEntries(
      [...(zonaDireccion.current?.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        '[name]',
      ) ?? [])]
        .map((campo) => [campo.name, campo.value.trim()] as const)
        .filter(([, valor]) => valor !== ''),
    )

    const { etiqueta, ...resto } = escrito

    /*
     * ── Una dirección a medias AVISA, no se descarta ──────────────────────────
     *
     * `api` exige la etiqueta —«la casa», «el local»—: es lo que distingue una
     * dirección de otra cuando el cliente tiene tres.
     *
     * Acá la dirección se armaba SOLO si venía la etiqueta, y si no, se tiraba.
     * Quien llenaba vía, placa, municipio y departamento y no le ponía nombre
     * daba «Registrar cliente», veía el alta salir bien, y abría la ficha sin
     * dirección: ocho campos perdidos sin una palabra. Pasó con un cliente real.
     *
     * Frenar es lo único honesto. Poner una etiqueta por defecto sería
     * inventarle un nombre a la casa de otra persona, y seguir de largo es
     * justamente el bug.
     */
    if (!etiqueta && Object.keys(resto).length > 0) {
      setError('Escriba cómo la llaman —«la casa», «el local»— para poder guardar la dirección.')
      return
    }

    setError(undefined)

    const direccion = etiqueta ? { etiqueta, ...resto } : undefined

    empezarEnvio(async () => {
      const resultado = await crearClienteRapidoAction({
        /*
         * `soloLoEscrito` y no `...nombre` a secas.
         *
         * `Nombre` trae las CINCO claves siempre, en cadena vacía las que nadie
         * llenó. Mandarlas así devuelve un 400 de validación —`api` distingue
         * «no lo cargaron» de «lo cargaron vacío»— y el mensaje que llega es el
         * genérico «No pudimos registrar al cliente», que no dice qué campo.
         *
         * El helper ya existía para esto. Lo escribí sin usarlo y costó cinco
         * intentos fallidos en el navegador.
         */
        ...soloLoEscrito(nombre),
        tipo,
        tipoDocumento,
        numeroDocumento: numeroDocumento.replace(/\D/g, ''),
        ...(escritos.length > 0 && {
          telefonos: escritos.map((t) => ({
            numero: t.numero.trim(),
            ...(t.etiqueta.trim() && { etiqueta: t.etiqueta.trim() }),
          })),
        }),
        ...(direccion && { direccion }),
      })

      if (resultado.error) {
        setError(resultado.error)
        return
      }

      if (resultado.cliente) {
        alCrear?.(resultado.cliente)
        cerrar()
      }
    })
  }

  return (
    <Modal
      abierto={abierto}
      cerrar={cerrar}
      titulo="Registrar cliente"
      atras={paso > 1 ? () => irAlPaso(paso === 3 ? 2 : 1) : undefined}
    >
      <div className="grid gap-5">
        <Progreso paso={paso} />

        <FormError id={idError}>{error}</FormError>

        {/*
          Los tres pasos se MONTAN siempre y se esconden con `hidden`, en vez de
          renderizarse condicionalmente.

          Desmontar el paso 1 al avanzar borraría el nombre ya escrito, y volver
          atrás lo pediría de nuevo. Y el paso 3 tiene que estar montado al
          enviar: sus campos se leen del DOM con un `FormData`.
        */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (paso === 3) registrar()
          }}
          className="grid gap-5"
        >
          <div hidden={paso !== 1} className="grid gap-5">
            <DocumentoPrimero
              tipoDocumento={tipoDocumento}
              onTipoDocumento={setTipoDocumento}
              numero={numeroDocumento}
              onNumero={setNumeroDocumento}
              onEstado={setEstadoDelDocumento}
            />

            {/*
              `self-start` y no es cosmética: sin él las pastillas medían 186 px.

              El paso 1 es un grid de dos columnas, y en la MISMA fila viven el
              fieldset del documento —que sí necesita esa altura, tiene el aviso
              de duplicado debajo— y este. Un ítem de grid se estira a la altura
              de su fila por defecto, ese estirón baja al `flex` de adentro, y
              las pastillas de 44 px terminaron midiendo cuatro veces eso.

              Es la misma trampa que el `align-content: start` de
              `.aq-etiqueta-campo`, que por eso no sufre lo mismo.
            */}
            <fieldset className="grid gap-2 self-start">
              <legend className="aq-micro text-tenue">Quién es</legend>
              <div className="flex flex-wrap gap-2">
                {(['residencial', 'comercial'] as const).map((opcion) => (
                  <label key={opcion} className="aq-ficha">
                    <input
                      type="radio"
                      name="_tipoDeCliente"
                      value={opcion}
                      checked={tipo === opcion}
                      onChange={() => {
                        setTipo(opcion)
                        setTipoDocumento(opcion === 'comercial' ? 'NIT' : 'CC')
                      }}
                      className="sr-only"
                    />
                    <span className="aq-ficha-caja" aria-hidden />
                    {opcion === 'residencial' ? 'Una persona' : 'Un negocio'}
                  </label>
                ))}
              </div>
            </fieldset>

            <CamposDeNombre tipo={tipo} valor={nombre} onCambio={setNombre} />
          </div>

          <div hidden={paso !== 2} className="grid gap-4">
            <p className="text-[13px] text-tenue">
              Sin número no hay a quién reclamarle un envase. Puede cargar más de uno: el
              celular del dueño y el fijo del local no sirven para lo mismo.
            </p>

            {telefonos.map((t, i) => (
              <div key={t.id} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                <label className="aq-etiqueta-campo">
                  <span>
                    Teléfono {i + 1}{' '}
                    <span className="font-normal normal-case">(opcional)</span>
                  </span>
                  <input
                    value={t.numero}
                    onChange={(e) => cambiarTelefono(t.id, 'numero', e.target.value)}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="300 123 4567"
                    className="aq-campo aq-cifra"
                  />
                  {t.numero.trim().length > 0 && t.numero.trim().length < 7 ? (
                    <span className="mt-1 font-normal normal-case text-[13px] text-error-texto">
                      Un teléfono tiene al menos 7 dígitos.
                    </span>
                  ) : null}
                </label>

                <label className="aq-etiqueta-campo">
                  <span>
                    Cómo se llama ese número{' '}
                    <span className="font-normal normal-case">(opcional)</span>
                  </span>
                  <input
                    value={t.etiqueta}
                    onChange={(e) => cambiarTelefono(t.id, 'etiqueta', e.target.value)}
                    autoComplete="off"
                    placeholder={i === 0 ? 'el celular del dueño' : 'el fijo del local'}
                    className="aq-campo"
                  />
                </label>

                {/*
                  Quitar aparece recién desde la segunda fila. En la primera
                  sería un botón que no hace nada: la lista nunca queda vacía,
                  y para no cargar teléfono alcanza con dejarla en blanco.
                */}
                {telefonos.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setTelefonos((previos) => previos.filter((p) => p.id !== t.id))}
                    aria-label={`Quitar el teléfono ${i + 1}`}
                    className="aq-boton aq-boton-secundario aq-boton-compacto sm:mt-[26px]"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}

            {telefonos.length < MAXIMO_DE_TELEFONOS ? (
              <button
                type="button"
                onClick={() => setTelefonos((previos) => [...previos, nuevoTelefono()])}
                className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
              >
                <Plus aria-hidden className="size-4" />
                Agregar otro número
              </button>
            ) : null}
          </div>

          <div ref={zonaDireccion} hidden={paso !== 3} className="grid gap-4">
            <p className="text-[13px] text-tenue">
              Una base se presta a una dirección, que es a donde hay que ir a buscarla. Si
              todavía no la sabe, puede registrarlo igual.
            </p>
            {catalogo ? (
              <CamposDeDireccion
                departamentos={catalogo.departamentos}
                municipios={catalogo.municipios}
                opcional
              />
            ) : (
              <p className="text-[13px] text-tenue">Cargando municipios…</p>
            )}
          </div>

          <Botones
            paso={paso}
            puedeAvanzar={puedeAvanzar}
            enviando={enviando}
            hayTelefono={escritos.length > 0}
            siguiente={() => irAlPaso(paso === 1 ? 2 : 3)}
            registrar={registrar}
            cerrar={cerrar}
          />
        </form>
      </div>
    </Modal>
  )
}

/**
 * En qué paso se está, y cuántos faltan.
 *
 * Un stepper sin esto es un formulario que cambia solo: quien lo usa no sabe si
 * le quedan dos preguntas o diez, y esa incertidumbre es la que hace abandonar.
 */
function Progreso({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <div className="grid gap-2">
      <p className="aq-micro text-tenue">
        Paso {paso} de 3 · {PASOS[paso - 1]!.titulo}
      </p>
      <ol className="flex gap-1.5" aria-hidden>
        {PASOS.map(({ n }) => (
          <li
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= paso ? 'bg-accion' : 'bg-current/15'}`}
          />
        ))}
      </ol>
    </div>
  )
}

/**
 * Los botones que HACEN algo. Volver atrás no está acá: es navegación, y vive
 * arriba a la izquierda, en la cabecera del modal.
 */
function Botones({
  paso,
  puedeAvanzar,
  enviando,
  hayTelefono,
  siguiente,
  registrar,
  cerrar,
}: {
  paso: 1 | 2 | 3
  puedeAvanzar: boolean
  enviando: boolean
  hayTelefono: boolean
  siguiente: () => void
  registrar: () => void
  cerrar: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-sutil pt-4">
      {/*
        ── `type="button"` SIEMPRE, incluso para registrar ────────────────────

        Acá vivía un bug que se saltaba el paso 3 entero: en el paso 2, un clic
        en «Seguir sin teléfono» registraba al cliente sin dirección.

        Es un solo `<button>` que React REUSA al cambiar de paso. El clic
        actualiza el estado a paso 3, React vuelve a pintar —de forma síncrona,
        porque un clic es un evento discreto— y le cambia el atributo a
        `type="submit"`. El navegador recién DESPUÉS evalúa la acción por
        defecto del clic, y la mira sobre el botón como quedó: envía el
        formulario, `onSubmit` ve `paso === 3` y llama a `registrar()`. Un solo
        clic, dos efectos.

        Sin acción por defecto no hay nada que evaluar después. El `Enter` sigue
        registrando: lo maneja el `onSubmit` del formulario.

        Es la misma trampa que vigila el alta del mostrador, donde un botón sin
        `type` cobraba la venta.
      */}
      {paso === 3 ? (
        <button
          type="button"
          onClick={registrar}
          disabled={enviando}
          className="aq-boton aq-boton-primario"
        >
          {enviando ? 'Registrando…' : 'Registrar cliente'}
        </button>
      ) : (
        /*
          El botón del paso 2 DICE que se puede seguir sin teléfono. «Siguiente»
          a secas deja la duda de si el campo vacío va a rebotar, y en la duda
          alguien inventa un número.
        */
        <button
          type="button"
          onClick={siguiente}
          disabled={!puedeAvanzar}
          className="aq-boton aq-boton-primario"
        >
          {paso === 2 && !hayTelefono ? 'Seguir sin teléfono' : 'Siguiente'}
        </button>
      )}

      <button type="button" onClick={cerrar} className="aq-boton aq-boton-secundario ml-auto">
        Cancelar
      </button>
    </div>
  )
}
