import { MessageCircle, PhoneOff } from 'lucide-react'
import Link from 'next/link'
import { Encabezados, SinResultados, Tabla, Td, Th } from '@/components/ui/tabla'
import type {
  DireccionALlamar,
  Producto,
  ResumenDeStock,
  TelefonoParaLlamar,
} from '@/lib/api-types'
import { CorregirLaVenta } from './corregir-la-venta'

/**
 * Las direcciones para llamar — M15.
 *
 * ── Por qué dejó de ser tarjetas ────────────────────────────────────────────
 *
 * La primera versión era una tarjeta por cliente: dos franjas de color, el
 * contador grande, los teléfonos en bloques con fondo propio. Se leía bien de a
 * una y se leía PÉSIMO de a cuarenta — cada fila pesaba unos 110 px, así que en
 * una pantalla entraban seis y había que scrollear seis veces para ver la lista
 * que se supone que se tría de un vistazo.
 *
 * Quien la usa venía de un Excel, y tenía razón en extrañarlo: para recorrer
 * cuarenta filas eligiendo a quién llamar, una planilla es mejor herramienta que
 * cuarenta tarjetas. Lo que hacía falta no era menos información: era menos
 * espacio entre la misma información.
 *
 * Ahora es una tabla de verdad, con el encabezado fijo y una fila por dirección.
 * Entran veinticinco por pantalla en vez de seis.
 *
 * ── La urgencia pinta la CIFRA, no la fila ──────────────────────────────────
 *
 * Las tarjetas se pintaban enteras de rojo o de ámbar. Con cuarenta filas eso
 * es una pantalla de color donde no se distingue nada: si todo grita, nada
 * grita.
 *
 * El color se concentró en la celda de los días, que es la columna que se
 * recorre. Así la columna se lee como un mapa de calor —lo rojo arriba, lo
 * ámbar abajo— y las otras tres columnas se pueden leer en paz.
 *
 * Y la palabra sigue estando: `title` y el texto «urgente» acompañan al color,
 * porque una diferencia que vive solo en el tono no la ve quien no distingue
 * rojo de ámbar, y esta pantalla se mira de reojo entre cliente y cliente.
 *
 * ── Server Component, sin estado ────────────────────────────────────────────
 *
 * No hay `'use client'`. Los enlaces son `<a href>`, el número de WhatsApp
 * viene armado desde `api` y la dirección viene ya legible: no hay nada que
 * calcular en el navegador.
 */
export function ClientesParaLlamar({
  filas,
  canal,
  productos,
  stock,
}: {
  filas: DireccionALlamar[]
  canal: 'botellones' | 'otros'
  /* Los necesita el mostrador que abre el lápiz — es el mismo de Ventas. */
  productos: Producto[]
  stock: ResumenDeStock[]
}) {
  /*
   * Los dos números que la cabecera necesita, contados una vez.
   *
   * `sinAsignar` no es un detalle de implementación que se escapó a la UI: es
   * trabajo pendiente y tiene que ser CONTABLE. Son las ventas anteriores a la
   * migración 0022, que no registraron a qué dirección se entregaron, y alguien
   * las va a corregir a mano. Un número que baja es la única forma de saber que
   * esa tarea avanza.
   */
  const urgentes = filas.filter((f) => f.urgencia === 'urgente').length
  const alDia = filas.filter((f) => f.urgencia === 'al-dia').length
  const sinAsignar = filas.filter((f) => f.ventaSinDireccion).length

  return (
    <section className="grid gap-3">
      {/*
        La bajada NO aparece cuando la lista está vacía.

        Decía lo mismo que la fila de «no hay nada» de la tabla, así que el
        estado vacío repetía la frase dos veces, una arriba de la otra. Se vio en
        el navegador, no en los tests: los dos textos existían y cada uno pasaba
        su propia aserción.
      */}
      {filas.length > 0 ? (
        <p className="text-[13px] text-tenue">
          {resumen(canal, urgentes, alDia)}
          {/*
            La leyenda del asterisco, al estilo planilla: se explica UNA vez
            arriba en vez de repetir un badge en cada fila. Y dice cuántas hay,
            porque son trabajo pendiente y un número que baja es la única forma
            de ver que la tarea avanza.
          */}
          {sinAsignar > 0 ? (
            <>
              {' · '}
              <span aria-hidden>*</span>
              {` en ${sinAsignar} ${sinAsignar === 1 ? 'fila el conteo viene' : 'filas el conteo viene'} de una venta que no registró a qué dirección se entregó, así que es del cliente y no de esa puerta.`}
            </>
          ) : null}
        </p>
      ) : null}

      {/*
        ── El alto acotado es lo que hace funcionar el encabezado pegajoso ────

        `.aq-tabla-encabezado` es `position: sticky; top: 0`, y sticky se ancla
        al contenedor de scroll más cercano. Sin una altura acá, este contenedor
        nunca scrollea en vertical: el ancla existe y no se activa nunca, así que
        el encabezado se va con la página y parece que sticky «no funciona».

        ── Y por qué solo desde `md` ──────────────────────────────────────────

        Abajo de 768 px la tabla se apila y el encabezado se esconde, así que no
        hay nada que pegar. Acotar el alto ahí solo metería un scroll ADENTRO del
        scroll de la página — dos superficies que se pelean el dedo, el peor
        gesto posible en un teléfono.
      */}
      <Tabla apilada alto="md:max-h-[70vh] md:overflow-y-auto">
        <Encabezados>
          {/*
            `w-px whitespace-nowrap` en la primera celda es el truco de tabla
            para «lo más angosto que quepa»: la columna se encoge al contenido y
            el ancho sobrante se lo llevan dirección y teléfonos, que son las que
            lo necesitan.

            Ninguna columna va `fija`: eso ancla la primera durante un scroll
            HORIZONTAL, y acá no hay — en angosto la tabla se apila y en ancho
            entra entera.
          */}
          <Th>Días</Th>
          <Th>Cliente</Th>
          <Th>Dirección</Th>
          <Th>Teléfonos</Th>
          {/*
            Sin título visible: una columna de iconos no se nombra dos veces.
            Pero la celda del encabezado tiene que existir igual, o la tabla
            queda con cuatro títulos y cinco celdas por fila — y un lector de
            pantalla anuncia cada lápiz bajo el título «Teléfonos».
          */}
          <Th>
            <span className="sr-only">Acciones</span>
          </Th>
        </Encabezados>

        <tbody>
          {filas.length === 0 ? (
            /*
             * La lista vacía se DICE. Una tabla que desaparece se lee como una
             * tabla rota: quien la vio ayer y hoy no la encuentra no piensa «no
             * hay nadie», piensa «se cayó algo».
             */
            <SinResultados columnas={5}>{vacio(canal)}</SinResultados>
          ) : (
            filas.map((fila) => (
              <Fila
                /*
                 * El `ventaId` va en el key, y no es decorativo.
                 *
                 * La fila «sin dirección» conserva su clienteId y su
                 * direccionId (null) aunque apunte a otra venta: al corregir
                 * una, la fila pasa a la siguiente del grupo. Sin el id, React
                 * reusa la instancia del lápiz y con ella su estado — y el
                 * botón termina abriendo una venta ya corregida.
                 *
                 * Otra venta es otra cosa. El key lo dice.
                 */
                key={`${fila.clienteId}-${fila.direccionId ?? 'sin-direccion'}-${fila.ventaId}`}
                fila={fila}
                productos={productos}
                stock={stock}
              />
            ))
          )}
        </tbody>
      </Tabla>
    </section>
  )
}

/**
 * La bajada, ahora que la lista es el padrón completo.
 *
 * Antes decía «estas direcciones ya pasaron ese punto», y era cierto porque
 * abajo del umbral nadie entraba. Ahora entran todos los que alguna vez
 * compraron, así que la frase tenía que dejar de describir a TODAS las filas y
 * pasar a decir qué es cada color — que es lo que alguien necesita saber para
 * leer la columna.
 */
function resumen(canal: 'botellones' | 'otros', urgentes: number, alDia: number): string {
  const que =
    canal === 'botellones'
      ? 'Todas las direcciones que alguna vez llevaron botellón'
      : 'Todas las direcciones que alguna vez llevaron algo que no es botellón'

  const atrasadas =
    urgentes > 0
      ? `${urgentes} ${urgentes === 1 ? 'lleva' : 'llevan'} tanto sin recibir que probablemente ya compró en otro lado`
      : 'ninguna está en rojo'

  return `${que}, ordenadas por días sin recibir: ${atrasadas}, y ${alDia} al día.`
}

/**
 * El vacío dejó de significar «todos al día».
 *
 * Cuando la lista filtraba por el umbral, vacía quería decir «nadie atrasado» —
 * una buena noticia. Ahora vacía significa que NADIE compró nunca de este tipo
 * de producto, que es un hecho distinto y mucho más raro. Decir lo anterior
 * sería tranquilizar por el motivo equivocado.
 */
function vacio(canal: 'botellones' | 'otros'): string {
  return canal === 'botellones'
    ? 'Todavía no hay ninguna venta de botellón con cliente. Acá van a aparecer en cuanto se registre la primera.'
    : 'Todavía no hay ninguna venta de pacas ni de nada que no sea botellón.'
}

/**
 * Las tres franjas, cada una con su forma.
 *
 * `clases` cambia la ESTRUCTURA de la píldora y no solo el tinte: rellena con
 * anillo, hueca con anillo, y sin nada. Es lo que la hace legible en escala de
 * grises, donde los tres tonos son el mismo gris.
 *
 * `palabra` es el canal que no depende de ver: va en el `title` y en el
 * `sr-only`.
 */
const TONO = {
  urgente: { palabra: 'Urgente', clases: 'bg-error-fondo text-error-texto ring-1 ring-error' },
  aviso: { palabra: 'Aviso', clases: 'text-alerta-texto ring-1 ring-alerta-borde' },
  'al-dia': { palabra: 'Al día', clases: 'text-tenue' },
} as const

function Fila({
  fila,
  productos,
  stock,
}: {
  fila: DireccionALlamar
  productos: Producto[]
  stock: ResumenDeStock[]
}) {
  /*
   * `padding` y no `className`: el default de `Td` es `py-2.5` y sumarle
   * `py-1.5` dejaría las dos clases peleando por precedencia de CSS. Acá el
   * relleno se REEMPLAZA — es lo que hace que la fila mida la mitad.
   */
  const relleno = 'px-3 py-1.5'

  /*
   * ── Dónde van los iconos de WhatsApp de esta fila ─────────────────────────
   *
   * Se decide UNA vez acá y lo leen las dos columnas que dependen de ello. Si
   * cada una lo calculara por su cuenta, el día que una cambie la condición
   * aparecen dos botones para el mismo número, o ninguno.
   *
   * Con un solo destino el icono es de la fila y va con el lápiz. Con dos o
   * más es de cada número y va pegado al suyo — un botón al final de la fila
   * no puede nombrar a cuál de dos escribe. Ver `BotonDeWhatsapp`.
   */
  const iconosPorNumero = destinosDeWhatsapp(fila.telefonos).length > 1

  return (
    <tr>
      {/*
        La columna que hace escaneable la lista.

        `aq-cifra` es tabular: un `30` y un `8` ocupan lo mismo, así que la
        columna no baila y se puede recorrer con el ojo sin leer. Es la
        diferencia entre triar una lista y leer cuarenta frases.

        En la versión apilada esta celda ocupa el alto de las otras tres (lo hace
        `.aq-tabla-apilada td:first-child`), así que la columna de números sigue
        siendo recorrible hacia abajo también en un teléfono. Es el único dato
        que NO puede perder su columna: es la pregunta que la lista contesta.
      */}
      <Td padding={relleno} className="w-px whitespace-nowrap text-center">
        {/*
          ── Tres franjas, tres FORMAS ────────────────────────────────────────

          Relleno / contorno / sin contorno. La diferencia NO puede vivir en el
          color: medidos, los tonos de fondo de urgente y aviso contrastan entre
          sí 1.14:1 en escala de grises (1.016:1 en modo claro). Quien no separa
          rojo de ámbar no vería ninguna diferencia, y esta pantalla se recorre
          de reojo entre cliente y cliente.

          Con tres franjas el problema se agrava: tres tonos que en gris son el
          mismo gris. Por eso cada una cambia de ESTRUCTURA —relleno, anillo,
          nada— y no solo de tinte. Se distingue sin leer y sin color.

          La palabra sigue existiendo, en `sr-only`: salir de la VISTA no es
          salir del documento.
        */}
        {fila.ventaSinDireccion ? (
          /*
           * ── Acá el número son VENTAS, no días ───────────────────────────
           *
           * Esta fila agrupa todas las ventas viejas del cliente que no dicen a
           * qué puerta fueron, y mostraba los días de la más reciente. Al
           * corregir una, esa salía del grupo y la fila pasaba a la siguiente
           * —más vieja—, así que el número SUBÍA: 40, 47, 54.
           *
           * La operación lo reportó tres veces, y con razón: se veía como si
           * corregir no hubiera servido de nada, o peor, como si hubiera
           * empeorado algo.
           *
           * Contando ventas el número baja —3, 2, 1— y la fila se va sola. El
           * trabajo hecho se ve.
           *
           * Sin píldora de urgencia: esto no es una llamada, así que no compite
           * en el mismo eje. Los días siguen en el `title` y en el `sr-only`,
           * porque el dato no molesta — lo que molestaba era que encabezara.
           */
          <span
            title={`${fila.cuantasVentas} ${fila.cuantasVentas === 1 ? 'venta no dice' : 'ventas no dicen'} a qué dirección se entregó. La más reciente, hace ${fila.diasSinComprar} días`}
            className="aq-cifra inline-flex min-w-[2.5rem] items-center justify-center rounded px-1.5 py-1 text-[17px] leading-none font-semibold tabular-nums text-tenue"
          >
            {fila.cuantasVentas}
          </span>
        ) : (
          <span
            title={TONO[fila.urgencia].palabra}
            className={`aq-cifra inline-flex min-w-[2.5rem] items-center justify-center rounded px-1.5 py-1 text-[17px] leading-none font-semibold tabular-nums ${TONO[fila.urgencia].clases}`}
          >
            {fila.diasSinComprar}
          </span>
        )}
        <span className="sr-only">
          {fila.ventaSinDireccion
            ? `${fila.cuantasVentas} ${fila.cuantasVentas === 1 ? 'venta no dice' : 'ventas no dicen'} a qué dirección se entregó`
            : ` días sin recibir, ${TONO[fila.urgencia].palabra.toLowerCase()}`}
          {fila.ventaSinDireccion
            ? '. El conteo viene de una venta que no registró a qué dirección se entregó'
            : ''}
        </span>
      </Td>

      {/*
        El nombre es el enlace a la ficha: la lista dice a quién llamar, la ficha
        dice qué decirle. Sin ese salto, quien atiende tiene que ir a Clientes y
        buscar el nombre a mano, con el teléfono ya sonando.

        Ya no se estira la sombra del enlace sobre la fila entera: en una tabla
        densa, una fila clicable con enlaces de WhatsApp adentro hace que un dedo
        que apunta al número caiga en la ficha. El nombre es el enlace, y punto.
      */}
      <Td padding={relleno} className="md:max-w-[14rem]">
        <Link
          href={`/modulos/clientes/${fila.clienteId}`}
          className="font-medium text-principal underline-offset-4 hover:underline"
        >
          {fila.nombre}
        </Link>
      </Td>

      <Td padding={relleno} className="md:max-w-[18rem]">
        {fila.direccionId === null ? (
          /*
           * ── Acá NO va una dirección ─────────────────────────────────────
           *
           * Esta fila cuenta una venta que no registró a qué puerta fue. Una
           * versión anterior mostraba igual una dirección del cliente —la
           * repartía entre todas— y se leía como «acá se entregó hace 43
           * días», que es justamente lo que nadie sabe. Peor: con dos
           * direcciones salían dos filas idénticas reclamando puertas
           * distintas.
           *
           * O tiene dirección o no la tiene. Y cuando no la tiene, lo que
           * corresponde no es una etiqueta sino una ACCIÓN: el lápiz de la
           * fila abre la corrección para asignársela.
           */
          <span className="grid gap-0.5">
            <span className="text-[13px] font-medium text-alerta-texto">Asignar una dirección</span>
            {/*
              Explica el número de al lado y avisa que el trabajo no termina con
              la venta que el lápiz abre ahora.
            */}
            <span className="text-[12px] text-tenue">
              {fila.cuantasVentas === 1
                ? `1 venta sin ubicar, de hace ${fila.diasSinComprar} días`
                : `${fila.cuantasVentas} ventas sin ubicar · la más reciente, hace ${fila.diasSinComprar} días`}
            </span>
          </span>
        ) : (
          <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-[13px] text-secundario">{fila.direccion}</span>
            {/*
              ── Acá NO va ninguna marca ──────────────────────────────────────

              Hubo un badge «sin asignar» colgando de esta etiqueta, y era
              confuso con razón: decía «sin asignar» AL LADO de una dirección
              que estaba ahí escrita. Se leía como «esta dirección no está
              asignada», y eso es falso — la dirección es real y es del cliente.

              Lo que no se registró es a cuál de sus puertas fue LA VENTA. Es
              una duda sobre el CONTEO, no sobre la dirección, así que la marca
              se mudó al número, que es donde vive el dato dudoso.
            */}
            <span className="text-[12px] text-tenue">{fila.etiqueta}</span>
          </span>
        )}
      </Td>

      <Td padding={relleno}>
        {fila.telefonos.length === 0 ? (
          /*
           * «No hay a quién llamar» es accionable —alguien tiene que ir a cargar
           * ese número—, así que la fila aparece igual y lo dice.
           */
          <span className="flex items-center gap-1.5 text-[13px] italic text-tenue">
            <PhoneOff aria-hidden className="size-3.5 shrink-0" />
            Sin teléfono cargado
          </span>
        ) : (
          /*
            ── Tres columnas cuando hay varios destinos ──────────────────────

            Con un solo destino el botón se fue a la columna de acciones, así
            que acá no hay iconos y la grilla son dos columnas: número y
            etiqueta.

            Con dos o más, cada número lleva el suyo y los iconos forman su
            propia columna a la derecha. Alineados, y no pegados a textos de
            largo distinto — que es lo que hacía que esto se leyera como texto
            suelto en vez de como una planilla.

            ── Y la alineación cambia según QUÉ se alinea ────────────────────

            Sin iconos son dos textos de tamaños distintos —número de 13 px,
            etiqueta de 12— y ahí manda `items-baseline`: se apoyan en el mismo
            renglón, que es como se lee una columna de datos.

            Con iconos, `baseline` es lo PEOR que se puede pedir. Un `<a>` que
            solo contiene un SVG no tiene texto, así que su baseline es el borde
            INFERIOR de la caja: el navegador cuelga la caja del icono por
            encima del renglón del número. Medido en el navegador antes de
            tocar — el centro del icono quedaba 13,3 px arriba del centro de su
            número, con el número en 18,6 px.

            Con iconos manda `items-center`, que es lo que de verdad se quiere
            cuando lo que se alinea es un glifo contra una cifra.
          */
          <span
            className={`grid gap-x-2 gap-y-0.5 ${
              iconosPorNumero
                ? 'grid-cols-[auto_1fr_auto] items-center'
                : 'grid-cols-[auto_1fr] items-baseline'
            }`}
          >
            {fila.telefonos.map((t) => (
              <Telefono
                key={t.numero}
                telefono={t}
                nombre={fila.nombre}
                conBoton={iconosPorNumero}
              />
            ))}
          </span>
        )}
      </Td>

      {/*
        ── La columna de acciones ───────────────────────────────────────────

        Todos los iconos juntos al final de la fila. Antes el de WhatsApp vivía
        pegado a su número, en el medio de la columna de teléfonos, y la fila se
        leía como texto con botones intercalados en vez de como una planilla.

        `text-right` y no centrado: pegados al borde derecho se recorren igual
        que la columna de números, y no le roban ancho a los teléfonos.
      */}
      <Td padding="px-1.5 py-1" className="w-px whitespace-nowrap text-right align-middle">
        <span className="inline-flex items-center gap-0.5">
          <BotonDeWhatsapp telefonos={fila.telefonos} nombre={fila.nombre} />
          <CorregirLaVenta
            ventaId={fila.ventaId}
            nombre={fila.nombre}
            sinDireccion={fila.ventaSinDireccion}
            productos={productos}
            stock={stock}
          />
        </span>
      </Td>
    </tr>
  )
}

/**
 * Un teléfono de la fila: el número, su etiqueta y —cuando corresponde— su
 * propio botón de WhatsApp.
 *
 * ── Por qué es una grilla y no una fila ─────────────────────────────────────
 *
 * Con dos teléfonos y anchos distintos —«300 123 4567 el dueño» sobre
 * «605 878 1234 el fijo»— las etiquetas quedaban cada una en un lugar. Se leía
 * como texto suelto y no como una columna de datos, que es justo lo que esta
 * pantalla vino a ser.
 *
 * Las columnas fijas los alinean: los números arriba del otro en cifra
 * tabular, las etiquetas empezando todas en el mismo punto, y los iconos —si
 * hay— formando su propia columna derecha en vez de quedar cada uno pegado a
 * un texto de largo distinto.
 *
 * ── `conBoton` lo decide la FILA, no el teléfono ────────────────────────────
 *
 * Un teléfono solo no sabe si es el único destino del cliente, y de eso depende
 * dónde va su botón. Lo resuelve `Acciones` más abajo, que es quien ve los
 * teléfonos todos juntos.
 *
 * Cuando `conBoton` es `false` igual se dibuja la tercera celda, vacía. Sin
 * ella, un cliente con dos números y uno solo con WhatsApp desalinearía la
 * grilla: la fila del número sin icono correría una columna.
 */
function Telefono({
  telefono,
  nombre,
  conBoton,
}: {
  telefono: TelefonoParaLlamar
  nombre: string
  /** Si este número lleva su propio botón. Lo decide la fila. */
  conBoton: boolean
}) {
  return (
    <>
      <span className="aq-cifra text-[13px] tabular-nums text-secundario">{telefono.numero}</span>
      {/*
        La etiqueta acompaña, no compite: más callada y fuera de la cifra
        tabular. Sirve para elegir a cuál llamar —«el celular del dueño»—, no
        para leerla primero.
      */}
      <span className="truncate text-[12px] text-tenue">{telefono.etiqueta ?? ''}</span>

      {/*
        ── La tercera celda existe SOLO cuando la grilla tiene tres columnas ──

        Con un solo destino la grilla es de dos columnas, y aportar una tercera
        celda igual rompe todo: los sobrantes empujan al teléfono siguiente, que
        arranca en la columna de la etiqueta y deja su propia etiqueta colgando
        en el renglón de abajo.

        Lo encontró un screenshot, no los tests: jsdom no hace layout, así que
        una grilla con celdas de más se ve idéntica a una bien armada. El test
        que lo fija ahora cuenta las celdas.

        El hueco lleva la ALTURA del icono, no es un `<span>` vacío.

        Sin alto, la fila de un número sin WhatsApp mide 18,6 px y la de uno con
        icono mide 36: los números quedan a distancias distintas entre sí y la
        columna deja de leerse como una columna. Con el alto puesto todas miden
        lo mismo, y cada número queda centrado contra su lugar de icono, lo
        tenga o no.

        `h-11` son los mismos 44 px que ocupa el enlace.
      */}
      {conBoton ? (
        telefono.whatsapp ? (
          <EnlaceDeWhatsapp telefono={telefono} nombre={nombre} />
        ) : (
          <span className="h-11" aria-hidden />
        )
      ) : null}
    </>
  )
}

/**
 * El enlace a un número concreto. Uno solo, sin ambigüedad posible.
 *
 * El `aria-label` nombra a la persona Y el número: quien usa lector de pantalla
 * oye a quién le va a escribir antes de apretar. Con dos botones en la misma
 * fila eso deja de ser un detalle y es la única forma de distinguirlos.
 *
 * ── Declara sus 44 px, porque a un enlace nadie se los da ──────────────────
 *
 * La regla de `globals.css` que pone `min-height: 44px` cubre `button`,
 * `select`, `input` y `textarea`, y deja los enlaces afuera a propósito: un
 * enlace dentro de una oración no puede medir 44 px sin romper el renglón, y
 * WCAG 2.2 los exime por eso. Pero dice la otra mitad: «el enlace que ES una
 * acción suelta sí lleva el mínimo, y lo declara en su lugar».
 *
 * Este es ese caso, y no lo declaraba. Medido en el navegador: el lápiz de
 * `CorregirLaVenta` salía en 44 px por la regla global y este enlace en 36,
 * así que el icono nuevo era el objetivo más chico de la tabla — en una
 * pantalla que se usa desde un celular, al lado de una llenadora.
 *
 * `size-11` son los 44 px en las dos direcciones, con el glifo centrado.
 */
function EnlaceDeWhatsapp({
  telefono,
  nombre,
}: {
  telefono: TelefonoParaLlamar
  nombre: string
}) {
  return (
    <Link
      href={`https://wa.me/${telefono.whatsapp}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir por WhatsApp a ${nombre} al ${telefono.numero}`}
      title={`Escribir por WhatsApp al ${telefono.numero}`}
      className="inline-flex size-11 items-center justify-center rounded text-exito-texto transition-colors hover:bg-elevada"
    >
      <MessageCircle aria-hidden className="size-4" />
    </Link>
  )
}

/**
 * Cuántos de los teléfonos de un cliente tienen WhatsApp.
 *
 * Se calcula una vez por fila y lo leen los dos lugares que dependen de ello:
 * la columna de teléfonos para saber si dibuja iconos, y la de acciones para
 * saber si dibuja el suyo. Calcularlo dos veces es donde las dos columnas se
 * desincronizan y aparecen dos botones para el mismo número.
 */
const destinosDeWhatsapp = (telefonos: TelefonoParaLlamar[]) =>
  telefonos.filter((t) => t.whatsapp !== null)

/**
 * El botón de WhatsApp de la FILA — solo cuando hay un único destino.
 *
 * ── La regla: el icono vive donde su destino es inequívoco ──────────────────
 *
 * Juntar los iconos al final de la fila es más prolijo: antes el de WhatsApp
 * vivía en el medio de la columna de teléfonos y la fila se leía como texto con
 * botones intercalados en vez de como una planilla.
 *
 * Pero un botón al final de la fila no puede nombrar a cuál de dos números
 * escribe. Es el error que este archivo ya cometió una vez y documentó: «con
 * dos teléfonos, el botón quedaba ENTRE ambos y no se sabía a cuál pertenecía».
 *
 * De ahí la regla, que no es un caso especial sino la misma idea aplicada dos
 * veces:
 *
 * - **Un solo destino** → la acción es de la fila, y va con el lápiz.
 * - **Dos o más** → la acción es de cada número, y va pegada a su número, en
 *   la tercera columna de la grilla de teléfonos.
 *
 * Lo que NO se hace es elegir por quien llama. Con dos destinos, un botón
 * cualquiera manda el mensaje a la persona equivocada; y hacerlo desaparecer
 * —como quedó a medio camino— le quita WhatsApp a un cliente que sí lo tiene.
 *
 * ── Y el caso de dos NO es hipotético ──────────────────────────────────────
 *
 * Cuando se empezó este ajuste el comentario decía «cero clientes con dos»,
 * medido en su momento, y de ahí salió la idea de que con dos no hacía falta
 * botón. Vuelto a medir en el navegador al terminarlo: de 19 filas en pantalla,
 * 7 tienen un destino, 9 no tienen WhatsApp y **3 tienen dos**.
 *
 * O sea que hacer desaparecer el botón —como quedó a medio camino— no le
 * quitaba WhatsApp a un caso raro: se lo quitaba a tres filas de cada
 * diecinueve.
 */
function BotonDeWhatsapp({
  telefonos,
  nombre,
}: {
  telefonos: TelefonoParaLlamar[]
  nombre: string
}) {
  const destinos = destinosDeWhatsapp(telefonos)

  if (destinos.length !== 1) return null

  return <EnlaceDeWhatsapp telefono={destinos[0]!} nombre={nombre} />
}
