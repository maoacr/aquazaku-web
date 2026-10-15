'use client'

import { PackagePlus } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { direccionesDeClienteAction } from '@/app/(app)/modulos/clientes/actions'
import { basesParaEntregarAction } from '@/app/(app)/modulos/retornables/actions'
import type { Base, ClienteElegido, Direccion, TipoDeBase } from '@/lib/api-types'
import { useSelectResistenteAlReset } from '@/lib/formulario-cliente'

/**
 * Llevarse una base con la venta — RN-BAS-03.
 *
 * ── Por qué esto vive en el mostrador y no solo en Retornables ──────────────
 *
 * Entregar la base era un segundo acto en otra pantalla, y el segundo acto es
 * el que se olvida. Con la base ya en el auto del cliente, nadie vuelve a
 * Retornables a registrarla — y queda un activo de la planta afuera sin ninguna
 * fila que lo reclame. Es exactamente lo que pasó con los botellones antes de
 * RN-ENV-09.
 *
 * ── Va a una DIRECCIÓN, no a un cliente ─────────────────────────────────────
 *
 * RN-BAS-03, y no es un tecnicismo: un comercial con tres locales tiene una
 * base en cada uno. Si el préstamo apuntara al cliente, no se sabría a cuál de
 * los tres ir a buscarla — y una base que no se puede reclamar es una base
 * perdida con papeles.
 *
 * Por eso las direcciones se piden **del cliente ya elegido**, y recién ahí.
 * Antes se traían las de todos los clientes por adelantado: mil peticiones para
 * llenar un desplegable que nadie puede recorrer.
 */
/**
 * Las direcciones de un cliente, pedidas cuando ya se sabe de quién.
 *
 * Lo usan los dos lugares donde se presta una base: el mostrador y Retornables.
 * Uno solo, porque el mecanismo es el mismo y dos copias se separan.
 */
export function useDireccionesDe(cliente: ClienteElegido | null) {
  /*
   * Se guarda DE QUIÉN son las direcciones, no solo las direcciones.
   *
   * Eso hace dos cosas de una. Primero, no hace falta limpiarlas al cambiar de
   * cliente: se derivan comparando el id, y sin cliente el resultado es la
   * lista vacía sin que nadie escriba estado. Segundo —y más importante— es la
   * guarda de carrera: si la respuesta de un cliente llega después de haber
   * elegido a otro, el id no coincide y se descarta.
   *
   * Mostrar las direcciones del cliente anterior es la peor equivocación
   * posible acá: la base terminaría prestada en la casa de otra persona.
   */
  const [respuesta, setRespuesta] = useState<{ clienteId: string; direcciones: Direccion[] } | null>(
    null,
  )
  const [cargando, empezarCarga] = useTransition()

  useEffect(() => {
    if (!cliente) return

    /*
     * La respuesta vieja se descarta AL LLEGAR, no después.
     *
     * La primera versión guardaba todas las respuestas y filtraba por id al
     * renderizar. No alcanza: la tardía pisaba a la buena, y entonces el filtro
     * descartaba las dos — el desplegable quedaba vacío con un cliente elegido.
     * Lo encontró el test, y era un defecto real.
     */
    let vigente = true

    empezarCarga(async () => {
      const direcciones = await direccionesDeClienteAction(cliente.id)
      if (vigente) setRespuesta({ clienteId: cliente.id, direcciones })
    })

    return () => {
      vigente = false
    }
  }, [cliente])

  const direcciones = cliente && respuesta?.clienteId === cliente.id ? respuesta.direcciones : []

  return { direcciones, cargando }
}

/** El desplegable de «a qué dirección», con el nombre de campo que le pidan. */
export function SelectorDeDireccion({
  cliente,
  name,
  elegida,
}: {
  cliente: ClienteElegido | null
  name: string
  /**
   * Cuál viene elegida de antes — la corrección de una venta la necesita.
   *
   * Es el valor INICIAL de la selección, no el valor permanente: una vez que
   * alguien elige otra, manda la suya.
   */
  elegida?: string
}) {
  const { direcciones, cargando } = useDireccionesDe(cliente)

  /*
   * ── Controlado, y eso arregla una venta que se perdía ─────────────────────
   *
   * Esto era `defaultValue` sin estado, con un argumento que era cierto hasta
   * que se midió: «el campo lo lee el `FormData`, no hay nada que sincronizar».
   *
   * Lo que faltaba es que React 19 RESETEA el formulario cuando una acción
   * termina, y no distingue el éxito del error. Con `defaultValue` —que React
   * solo aplica al montar— una venta rechazada por `api/` dejaba el desplegable
   * EN BLANCO: medido en `form-reset-al-fallar.test.tsx`, no volvía a la
   * primera opción, se vaciaba. Quien corregía el error y reintentaba sin
   * mirar mandaba la venta sin dirección, o con otra.
   *
   * Y no es cosmético: RN-VEN-02 prohíbe editar una venta confirmada. Un
   * botellón despachado a la dirección equivocada solo se arregla anulando.
   *
   * Controlado alcanza para un `<input>` —medido: un texto controlado conserva
   * su valor y uno no controlado se vacía— pero NO para un `<select>`: React
   * restaura los inputs después del reset y el desplegable no entra en esa
   * restauración, así que queda en blanco aunque el estado siga diciendo
   * «dir-2».
   */
  const [seleccion, setSeleccion] = useState(elegida ?? '')

  /*
   * ── El valor se DERIVA, no se sincroniza ──────────────────────────────────
   *
   * `seleccion` es lo que la persona eligió; `valor` es lo que corresponde
   * mostrar hoy. Con una sola dirección es ESA —preguntar entre una opción es
   * una pregunta que no existe, y sin opción vacía es también lo que viaja en
   * el `FormData`—; con varias, lo elegido, y «Elija una» mientras no haya nada.
   *
   * Derivarlo resuelve el cambio de cliente sin un `useEffect` que limpie: si
   * lo elegido no está entre las direcciones del cliente actual, no coincide y
   * deja de valer. Nunca viaja la dirección de otra persona, que es la peor
   * equivocación posible acá.
   */
  const valor = direcciones.some((d) => d.id === seleccion)
    ? seleccion
    : direcciones.length === 1
      ? direcciones[0]!.id
      : ''

  /* El reset de React al terminar la acción borraría esto. Ver el hook. */
  const refSelect = useSelectResistenteAlReset(valor)

  if (!cliente) return null

  if (!cargando && direcciones.length === 0) {
    return (
      <p className="text-[13px] text-alerta-texto">
        {cliente.nombre} no tiene ninguna dirección cargada. Una base se presta a una
        dirección, que es a donde hay que ir a buscarla: cárguele una desde su ficha.
      </p>
    )
  }

  return (
    <label className="aq-etiqueta-campo">
      <span>A qué dirección</span>
      {/*
        El `key` que remontaba el campo ya no está, y no hacía falta.

        Existía porque `defaultValue` solo se aplica al MONTAR y las direcciones
        llegan DESPUÉS del primer render — la corrección de una venta abría en
        «Elija una» y le cambiaba el destino sin que nadie lo notara. Un valor
        controlado se aplica en cada render, así que la llegada tardía se pinta
        sola cuando llega.
      */}
      <select
        ref={refSelect}
        name={name}
        value={valor}
        onChange={(e) => setSeleccion(e.target.value)}
        className="aq-campo"
      >
        {direcciones.length === 1 ? null : <option value="">Elija una</option>}
        {direcciones.map((d) => (
          <option key={d.id} value={d.id}>
            {/*
              `legible` la arma `api`: la función que compone la nomenclatura
              vive allá y `web` no puede importarla. Si cada pantalla la armara,
              en tres meses habría tres formatos.
            */}
            {d.etiqueta} — {d.legible}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Cómo se lee cada tipo en pantalla — RN-BAS-14. */
export const NOMBRE_DEL_TIPO: Record<TipoDeBase, string> = {
  estructura: 'Estructura',
  dispensador: 'Dispensador',
}

/*
 * El orden en que se ofrecen los tipos es el de declaración del enum, que es
 * el orden en que aparecieron en el negocio — el mismo criterio que usa
 * `disponibilidadPorTipo` en `api/`. Se deriva del mapa en vez de repetirse en
 * un array aparte: una segunda lista de tipos es un segundo lugar donde se
 * olvida el tercero.
 */
const TIPOS_EN_ORDEN = Object.keys(NOMBRE_DEL_TIPO) as TipoDeBase[]

/**
 * Las bases que se pueden entregar: en la bodega y sanas.
 *
 * Vive acá y no en cada formulario porque los dos lugares que prestan una base
 * —el mostrador y Retornables— tienen que ofrecer exactamente lo mismo. Dos
 * copias de este filtro se separan el día que `api/` agregue un estado, y la
 * que quede vieja ofrecería algo que el servidor rechaza.
 */
export function basesParaEntregar(bases: Base[]): Base[] {
  return bases.filter((b) => b.direccionId === null && b.estado === 'sana')
}

/**
 * Elegir la base: primero QUÉ, después CUÁL — RN-BAS-14.
 *
 * ── Por qué el tipo va primero ──────────────────────────────────────────────
 *
 * Es la pregunta que hace el negocio. El cliente pide «un dispensador», no «la
 * 0913», y hasta que eso no se responde el número no significa nada. Con los
 * dos parques en una sola lista ordenada por número, dar un dispensador obliga
 * a recorrer cuarenta estructuras leyendo la etiqueta de cada una — y el que
 * cobra lo hace con el cliente parado enfrente.
 *
 * ── Un tipo sin stock no se ofrece ──────────────────────────────────────────
 *
 * Mismo criterio que `disponibilidadPorTipo` en `api/`: ofrecer «dispensador»
 * cuando no queda ninguno libre promete algo que la pantalla siguiente no
 * puede cumplir. Y si queda UN solo tipo con stock, no se pregunta nada:
 * preguntar entre una opción es una pregunta que no existe, igual que hace
 * `SelectorDeDireccion` con la única dirección de un cliente.
 *
 * ── Lo elegido se DERIVA, no se sincroniza ──────────────────────────────────
 *
 * Al cambiar de tipo, el número elegido antes deja de estar entre las opciones
 * y por eso deja de valer, sin ningún `useEffect` que lo limpie. Es la guarda
 * que importa: mandar «0001» habiendo elegido «dispensador» entregaría el
 * activo equivocado con el papel correcto, y una entrega mal registrada solo
 * se arregla con el retorno y un segundo préstamo.
 */
export function SelectorDeBase({
  bases,
  name,
  identificarPor,
}: {
  bases: Base[]
  name: string
  /**
   * Qué viaja en el `FormData`, y lo decide `api/`.
   *
   * La venta busca la base por el STICKER —«en el mostrador nadie conoce el
   * uuid»— y el préstamo de Retornables por el id. El desplegable es el mismo;
   * lo que manda, no.
   */
  identificarPor: 'id' | 'idSticker'
}) {
  const disponibles = basesParaEntregar(bases)
  const tiposConStock = TIPOS_EN_ORDEN.filter((t) => disponibles.some((b) => b.tipo === t))

  const [tipoElegido, setTipoElegido] = useState('')
  const [baseElegida, setBaseElegida] = useState('')

  /* Con un solo tipo en bodega, ES ese: no hay nada que preguntar. */
  const tipo = tiposConStock.length === 1 ? tiposConStock[0]! : tipoElegido

  const delTipo = disponibles.filter((b) => b.tipo === tipo)

  /*
   * Misma derivación que `SelectorDeDireccion`: con una sola opción es esa —y
   * sin opción vacía, así que es también lo que viaja en el `FormData`—; con
   * varias, lo elegido; y vacío mientras no haya nada.
   */
  const valor = delTipo.some((b) => b[identificarPor] === baseElegida)
    ? baseElegida
    : delTipo.length === 1
      ? delTipo[0]![identificarPor]
      : ''

  /* El reset de React al terminar la acción borraría los dos. Ver el hook. */
  const refTipo = useSelectResistenteAlReset(tipo)
  const refBase = useSelectResistenteAlReset(valor)

  /*
   * Sin ninguna base libre no se dibuja nada. Quien decide qué decir en ese
   * caso es el formulario: en Retornables la tarjeta entera desaparece, y en
   * el mostrador hay un texto que explica dónde mirar.
   */
  if (disponibles.length === 0) return null

  return (
    <>
      {tiposConStock.length > 1 ? (
        <label className="aq-etiqueta-campo">
          <span>Qué tipo de base</span>
          <select
            ref={refTipo}
            value={tipoElegido}
            onChange={(e) => setTipoElegido(e.target.value)}
            className="aq-campo"
          >
            <option value="">Elija el tipo</option>
            {tiposConStock.map((t) => (
              <option key={t} value={t}>
                {NOMBRE_DEL_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/*
        El número no se pregunta antes que el tipo. Mostrar el desplegable
        vacío o deshabilitado sería pedir que se adivine el orden; no estando,
        el orden es el único que hay.
      */}
      {tipo ? (
        <label className="aq-etiqueta-campo">
          <span>Cuál base</span>
          <select
            ref={refBase}
            name={name}
            required
            value={valor}
            onChange={(e) => setBaseElegida(e.target.value)}
            className="aq-campo aq-cifra"
          >
            {delTipo.length === 1 ? null : <option value="">Elija una</option>}
            {/*
              Solo el número: el tipo ya se respondió arriba, y repetirlo en
              cada una de las cuarenta opciones es ruido que se aprende a
              saltear.
            */}
            {delTipo.map((b) => (
              <option key={b.id} value={b[identificarPor]}>
                {b.idSticker}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  )
}

/**
 * El parque, pedido al ABRIR el panel.
 *
 * ── Por qué no se trae con la pantalla ──────────────────────────────────────
 *
 * Mismo criterio que `useDireccionesDe`: la mayoría de las ventas no se llevan
 * ninguna base, y pedir el parque en cada carga del mostrador es pagar en
 * todas por lo que pasa en pocas. A diferencia de las direcciones, esto no
 * depende de quién sea el cliente, así que se pide una vez por apertura.
 *
 * ── Tres estados, no dos ────────────────────────────────────────────────────
 *
 * `null` mientras no se sabe —pidiendo, o falló— y la lista cuando se sabe.
 * Confundir «no pude averiguar» con «no hay» dejaría ir al cliente sin una
 * base que sí está en la bodega, así que quien dibuja los distingue.
 */
function useBasesParaEntregar(abierto: boolean) {
  const [parque, setParque] = useState<Base[] | null>(null)
  const [cargando, empezarCarga] = useTransition()

  useEffect(() => {
    if (!abierto) return

    /* Misma guarda que en `useDireccionesDe`: la tardía no pisa a la buena. */
    let vigente = true

    empezarCarga(async () => {
      const bases = await basesParaEntregarAction()
      if (vigente) setParque(bases)
    })

    return () => {
      vigente = false
    }
  }, [abierto])

  return { parque, cargando }
}

export function EntregaDeBase({ cliente }: { cliente: ClienteElegido | null }) {
  const [abierto, setAbierto] = useState(false)
  const { direcciones, cargando } = useDireccionesDe(cliente)
  const { parque, cargando: cargandoParque } = useBasesParaEntregar(abierto)

  // Sin cliente no hay a quién prestarle: RN-BAS-03 no tiene dónde apuntar.
  if (!cliente) return null

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        <PackagePlus aria-hidden className="size-4" />
        ¿Se lleva una base?
      </button>
    )
  }

  /*
   * Sin direcciones no se puede prestar, y hay que DECIRLO en vez de mostrar un
   * desplegable vacío. La salida está en la ficha del cliente, y el texto la
   * nombra: un aviso que no dice qué hacer es un aviso que frustra.
   */
  if (!cargando && direcciones.length === 0) {
    return (
      <div className="rounded-lg border border-sutil p-4">
        <p className="text-[13px] text-principal">
          {cliente.nombre} no tiene ninguna dirección cargada.
        </p>
        <p className="mt-1 text-[13px] text-tenue">
          Una base se presta a una dirección, que es a donde hay que ir a buscarla. Cárguele
          una desde su ficha y vuelva.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 rounded-lg border border-sutil p-4">
      <div>
        <p className="text-[13px] text-principal">Se lleva una base</p>
        <p className="mt-1 text-[13px] text-tenue">
          Queda prestada, no vendida: sigue siendo de la planta. El cliente tiene que estar
          verificado.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/*
          Primero el tipo, después el número — RN-BAS-14.

          Acá se TECLEABA el sticker, con un argumento que era cierto con un
          solo tipo de base: el número está pegado en la que la persona tiene
          en la mano. Con dos parques dejó de alcanzar — el cliente pide «un
          dispensador» y quien cobra no sabe cuál de las cuarenta lo es.

          Es el MISMO componente que Retornables: los dos lugares que prestan
          una base ofrecen exactamente lo mismo, y el filtro de qué se puede
          entregar vive una sola vez.
        */}
        {parque === null ? (
          cargandoParque ? null : (
            <p role="status" className="text-[13px] text-tenue">
              No pudimos traer las bases ahora. Puede cobrar la venta sin base y registrar
              la entrega desde Retornables.
            </p>
          )
        ) : basesParaEntregar(parque).length === 0 ? (
          <p role="status" className="text-[13px] text-alerta-texto">
            No hay ninguna base en la bodega: están todas prestadas o dañadas.
          </p>
        ) : (
          <SelectorDeBase bases={parque} name="baseSticker" identificarPor="idSticker" />
        )}

        <SelectorDeDireccion cliente={cliente} name="baseDireccionId" />
      </div>

      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="aq-boton aq-boton-secundario aq-boton-compacto justify-self-start"
      >
        No se lleva ninguna
      </button>
    </div>
  )
}
