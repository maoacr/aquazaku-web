'use client'

import { Minus, Plus } from 'lucide-react'
import { useActionState, useEffect, useId, useState } from 'react'
import {
  type EstadoDeVenta,
  corregirVentaAction,
  registrarVentaAction,
} from '@/app/(app)/modulos/ventas/actions'
import { FormError } from '@/components/auth/form-error'
import { BuscadorDeCliente } from '@/components/clientes/buscador-de-cliente'
import { EntregaDeBase } from '@/components/retornables/entrega-de-base'
import { Cifra } from '@/components/stock/cifra'
import type { ClienteElegido, Producto, ResumenDeStock, VentaDelListado } from '@/lib/api-types'
import { useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'
import { aaaaMmDdEnLaPlanta, hoyEnLaPlanta } from '@/lib/hora-de-la-planta'

/** Hoy en la planta. Se calcula una vez por carga: nadie deja el mostrador abierto de un día para otro. */
const HOY = hoyEnLaPlanta()

/** El piso de RN-VEN-14. Espeja `DIAS_MAXIMOS_HACIA_ATRAS` de `api/`, que es quien manda. */
const HACE_90_DIAS = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
  new Date(Date.now() - 90 * 86_400_000),
)

/**
 * El piso del motivo. Espeja `LARGO_MINIMO_MOTIVO` de `api/`, que es quien manda.
 *
 * Se declara acá por lo mismo que `HACE_90_DIAS`: para poder decir qué falta
 * ANTES del viaje, no para decidir. Quien rechaza sigue siendo el servidor.
 */
const LARGO_MINIMO_MOTIVO = 10

const INICIAL: EstadoDeVenta = {}

/**
 * El mostrador — RN-VEN-09, RN-VEN-12, RN-VEN-13 y RN-VEN-14.
 *
 * ── Muestra el total ANTES de cobrar ────────────────────────────────────────
 *
 * Es la misma decisión que la vista previa del cierre de producción: quien está
 * del otro lado va a pagar ese número, y descubrirlo después de confirmar es
 * tarde. Acá además cambia con el tipo de cliente, así que elegirlo tiene que
 * verse reflejado en el momento.
 *
 * ── El total de la pantalla es una ESTIMACIÓN, y se dice ────────────────────
 *
 * El total real lo calcula `api/` con los precios y el piso de cada producto en
 * el momento de la venta. Este de acá usa el catálogo que se trajo al cargar la
 * página, que puede tener minutos. Coinciden casi siempre — y cuando no, manda
 * el del servidor.
 *
 * Prometerlo como exacto sería el mismo error que un saldo de stock en pantalla
 * presentado como verdad: se lee de hace un rato.
 *
 * ── No hay reserva de stock ─────────────────────────────────────────────────
 *
 * El aviso de «no alcanza» de acá es informativo. Quien decide es el descuento
 * atómico del servidor, y si dos personas van por la última unidad una recibe
 * el rechazo con el número real. Ver la spec de M6.
 */
/**
 * La venta que se está corrigiendo, ya desarmada en lo que el formulario pide.
 *
 * `null` —el caso normal— es el mostrador registrando una venta nueva.
 */
export interface Correccion {
  ventaId: string
  /** El cliente que tenía la venta, para que el modal no lo pierda al abrirse. */
  cliente: ClienteElegido | null
  medioDePago: string
  requiereFactura: boolean
  carrito: Record<string, number>
  /** Los precios que alguien había escrito a mano — RN-VEN-15. */
  manuales: Record<string, string>
  /**
   * AAAA-MM-DD de la venta original, vista desde la planta.
   *
   * Pre-cargada en el `<input name="ocurrioEn">` del modal de corrección para
   * que el admin vea y confirme la fecha del hecho antes de guardar
   * (RN-VEN-16 fecha corregible). Cuando coincide con el valor del input al
   * confirmar, sigue viajando explícita en el body — ver `corregirVentaAction`
   * y la nota sobre D10 en el comment del action.
   */
  ocurrioEnOriginal: string
  /** Botellones despachados en la venta original. RN-VEN-17. */
  botellonesEntregados: number
  /** Botellones devueltos por el cliente en la venta original. RN-VEN-17. */
  botellonesRecibidos: number
}

/**
 * Arma la corrección a partir de una fila del listado — RN-VEN-16.
 *
 * Vive acá, al lado del formulario que la consume, porque es el inverso exacto
 * de lo que el formulario envía: si mañana el carrito cambia de forma, las dos
 * mitades están a la vista una de la otra.
 */
export function correccionDesde(venta: VentaDelListado): Correccion {
  const carrito: Record<string, number> = {}
  const manuales: Record<string, string> = {}

  for (const linea of venta.lineas) {
    carrito[linea.productoId] = (carrito[linea.productoId] ?? 0) + linea.cantidad

    /*
     * El precio manual se precarga SIN decimales, que es como se escribe: el
     * campo solo acepta dígitos para que «3.800» no entre como $3,50. Ver
     * `escribirPrecio`.
     */
    if (linea.precioManual) manuales[linea.productoId] = String(Math.round(Number(linea.precioFinal)))
  }

  return {
    ventaId: venta.id,
    cliente:
      venta.clienteId && venta.clienteNombre
        ? {
            id: venta.clienteId,
            nombre: venta.clienteNombre,
            documento: venta.clienteDocumento ?? '',
            tipo: venta.tipoClienteAlMomento ?? 'residencial',
          }
        : null,
    medioDePago: venta.medioDePago,
    requiereFactura: venta.requiereFacturaElectronica,
    carrito,
    manuales,
    /*
     * La fecha del hecho en la planta, ya en `AAAA-MM-DD` para que el `<input
     * type="date">` la pueda pre-cargar — `api/` la serializa en ISO con
     * offset, y `aaaaMmDdEnLaPlanta` la lee en la zona de la planta para no
     * caer en el bug UTC que este archivo ya documenta.
     */
    ocurrioEnOriginal: aaaaMmDdEnLaPlanta(venta.createdAt),
    botellonesEntregados: venta.botellonesEntregados,
    botellonesRecibidos: venta.botellonesRecibidos,
  }
}

export function Mostrador({
  productos,
  stock,
  correccion,
  alCorregir,
}: {
  productos: Producto[]
  stock: ResumenDeStock[]
  /**
   * Corregir una venta ya registrada — RN-VEN-16.
   *
   * Es el MISMO formulario y no una copia, y esa es toda la decisión. Una
   * pantalla de corrección aparte tendría que repetir el carrito, el piso, el
   * precio a mano y el aviso de stock — y el día que uno de los cinco cambie,
   * cambiaría en un solo lado. Quien corrige una venta necesita exactamente las
   * mismas decisiones que quien la cobró.
   */
  correccion?: Correccion
  /** Qué hacer cuando la corrección salió bien. Cierra el modal. */
  alCorregir?: () => void
}) {
  const corrigiendo = correccion !== undefined

  const [estado, accion, enviando] = useActionState(
    corrigiendo ? corregirVentaAction : registrarVentaAction,
    INICIAL,
  )
  const idError = useId()

  const [carrito, setCarrito] = useState<Record<string, number>>(correccion?.carrito ?? {})
  const [cliente, setCliente] = useState<ClienteElegido | null>(correccion?.cliente ?? null)
  const [medioDePago, setMedioDePago] = useState(correccion?.medioDePago ?? 'efectivo')
  const [codigo, setCodigo] = useState('')
  const [requiereFactura, setRequiereFactura] = useState(correccion?.requiereFactura ?? false)
  /*
   * La fecha del hecho — RN-VEN-14 + RN-VEN-16 fecha corregible.
   *
   * Alta: arranca en HOY, que es lo normal del mostrador. Corrección: arranca
   * en la fecha ORIGINAL, que es lo que el admin está viendo para decidir si
   * la cambia. La edición la maneja `api/` con el piso de 90 días y el rechazo
   * de futuro — acá solo se muestra y se envía.
   */
  const [ocurrioEn, setOcurrioEn] = useState(correccion?.ocurrioEnOriginal ?? HOY)
  /*
   * Botellones despachados / recibidos en esta transacción — RN-VEN-17.
   *
   * Alta: defaults 1-a-1 sobre la cantidad de botellones en el carrito. El
   * operador ajusta si el cliente compra sin devolver o devuelve extras. El
   * `useEffect` que sigue mantiene los defaults sincronizados con el carrito
   * mientras el operador no haya tocado los campos — agregar o sacar
   * botellones del carrito arrastra los dos números hasta la nueva cantidad.
   *
   * Corrección: pre-cargados con los valores de la venta original — la
   * corrección puede moverlos, y si los deja como están el server los toma
   * como delta=0 y no inserta compensatorios. El flag `botellonesDirty` no
   * se usa en corrección.
   */
  const [entregados, setEntregados] = useState(correccion?.botellonesEntregados ?? 0)
  const [recibidos, setRecibidos] = useState(correccion?.botellonesRecibidos ?? 0)
  const [botellonesDirty, setBotellonesDirty] = useState(false)
  const [motivo, setMotivo] = useState('')

  /*
   * ── Los precios escritos a mano — RN-VEN-15 ───────────────────────────────
   *
   * La CLAVE presente es el checkbox tildado; el valor son los dígitos escritos.
   * Por eso `''` es un estado válido y distinto de ausente: es «lo voy a
   * escribir» y no «cobrá la lista».
   */
  const [manuales, setManuales] = useState<Record<string, string>>(correccion?.manuales ?? {})

  useAvisoDeExito(estado)
  useLimpiezaAlRegistrar(estado.token, () => {
    /*
     * Corrigiendo no hay nada que limpiar: el modal se cierra y se desmonta
     * entero. Vaciar el carrito antes de eso dibujaría el formulario vacío
     * durante un cuadro, que se lee como que la corrección se perdió.
     */
    if (corrigiendo) {
      alCorregir?.()
      return
    }

    setCarrito({})
    setCliente(null)
    setMedioDePago('efectivo')
    setCodigo('')
    setRequiereFactura(false)
    setManuales({})
    setBotellonesDirty(false)
    setEntregados(0)
    setRecibidos(0)
  })

  const vendibleDe = (id: string) => stock.find((s) => s.productoId === id)?.vendible ?? 0

  const cambiar = (id: string, delta: number) =>
    setCarrito((previo) => {
      const cantidad = (previo[id] ?? 0) + delta

      if (cantidad > 0) return { ...previo, [id]: cantidad }

      // Llegar a cero SACA el producto del carrito en vez de dejarlo en cero:
      // una línea de cero unidades no es una línea, y viajaría al servidor.
      const resto = { ...previo }
      delete resto[id]
      return resto
    })

  const items = Object.entries(carrito).map(([productoId, cantidad]) => ({
    productoId,
    cantidad,
    ...(productoId in manuales && { precioManual: manuales[productoId] }),
  }))

  /*
   * ── Solo dígitos, y es la decisión que evita registrar $3,50 ──────────────
   *
   * La card pinta «$10.000» con `toLocaleString('es-CO')`, así que quien quiere
   * poner tres mil ochocientos escribe «3.800» — es lo que tiene enfrente. Ese
   * texto contra el `^\d+(\.\d{1,2})?$` del sistema hace dos cosas, y las dos
   * son malas: «3.800» rebota con un mensaje sobre un regex, y «3.5» PASA como
   * $3,50 cuando se quería $3.500.
   *
   * Lo segundo es lo grave, porque no falla: registra. Y RN-VEN-02 prohíbe
   * editar una venta confirmada — la única salida sería anular y rehacer, si es
   * que alguien nota que tres botellones sumaron $10,50.
   *
   * Descartando el punto en la entrada, el formato ambiguo deja de existir.
   * Cuesta no poder cargar centavos desde el mostrador, que en pesos
   * colombianos y con el catálogo en enteros no es un caso.
   */
  const escribirPrecio = (id: string, texto: string) =>
    setManuales((previo) => ({ ...previo, [id]: texto.replace(/\D/g, '') }))

  const alternarPrecioManual = (id: string) =>
    setManuales((previo) => {
      if (!(id in previo)) return { ...previo, [id]: '' }

      const resto = { ...previo }
      delete resto[id]
      return resto
    })

  /*
   * El precio que se muestra es el que le toca al cliente elegido — RN-VEN-12.
   * Sin cliente se cobra la lista residencial: es la de quien compra un
   * botellón y se va, que es la venta de mostrador normal.
   */
  const listaDe = (producto: Producto) =>
    cliente?.tipo === 'comercial' ? producto.precioComercial : producto.precioResidencial

  /** El escrito a mano gana sobre la lista — RN-VEN-15. Vacío todavía no es un precio. */
  const precioDe = (producto: Producto) => manuales[producto.id] || listaDe(producto)

  const total = items.reduce((suma, item) => {
    const producto = productos.find((p) => p.id === item.productoId)
    return suma + (producto ? Number(precioDe(producto)) * item.cantidad : 0)
  }, 0)

  /*
   * ── Los envases que salen del parque — RN-ENV-03 ──────────────────────────
   *
   * Solo cuentan los productos de presentación `botellon`: una paca de bolsas
   * no lleva ningún activo retornable, y preguntar por vacíos ahí sería ruido.
   */
  const botellonesEnCarrito = items.reduce((suma, item) => {
    const producto = productos.find((p) => p.id === item.productoId)
    return suma + (producto?.presentacion === 'botellon' ? item.cantidad : 0)
  }, 0)

  /*
   * Mantener los defaults sincronizados con el carrito en alta — RN-VEN-17.
   *
   * Mientras el operador no haya tocado los campos (flag `botellonesDirty`),
   * cada cambio en `botellonesEnCarrito` arrastra `entregados` y `recibidos`
   * al nuevo valor: agregar una recarga de botellón pinta 1 y 1; subir a
   * cinco pinta 5 y 5. En el momento que el operador edita uno de los dos,
   * el flag se prende y dejamos de sobrescribir — lo que tipeó gana hasta
   * que se registre la venta o se limpie el formulario.
   *
   * En corrección el flag y el effect son no-ops: los valores ya vienen de
   * la venta original y el operador decide si los mueve.
   */
  useEffect(() => {
    if (corrigiendo) return
    if (botellonesDirty) return
    setEntregados(botellonesEnCarrito)
    setRecibidos(botellonesEnCarrito)
  }, [botellonesEnCarrito, botellonesDirty, corrigiendo])

  /*
   * Cap visual sobre `entregados` solo en alta: dejar un valor mayor que los
   * botellones del carrito haría que el servidor rechace con `BOTELLONES_SIN_RESPALDO`
   * un número que la pantalla ya sabía que estaba mal. En corrección el cap
   * no aplica — el carrito pudo haber cambiado desde la venta original y la
   * corrección está explícitamente autorizada a mover ambos campos.
   */
  const entregadosCap = corrigiendo ? entregados : Math.min(entregados, botellonesEnCarrito)
  const botellonSinCliente = (entregadosCap > 0 || recibidos > 0) && !cliente

  const excedidos = items.filter((i) => i.cantidad > vendibleDe(i.productoId))
  const creditoSinCliente = medioDePago === 'credito' && !cliente

  return (
    <form
      action={accion}
      className={corrigiendo ? 'grid gap-5' : 'aq-tarjeta grid gap-5 p-5'}
    >
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="medioDePago" value={medioDePago} />
      <input type="hidden" name="requiereFactura" value={requiereFactura ? 'si' : 'no'} />
      {corrigiendo ? (
        <input type="hidden" name="ventaId" value={correccion.ventaId} />
      ) : null}
      <input type="hidden" name="botellonesEntregados" value={entregadosCap} />
      <input type="hidden" name="botellonesRecibidos" value={recibidos} />

      {/*
        Corrigiendo, el título lo pone el modal: repetirlo acá serían dos
        encabezados a cuatro centímetros uno del otro diciendo lo mismo.
      */}
      {corrigiendo ? (
        <>
          <p className="text-[13px] text-tenue">
            Esta venta no se edita: se reemplaza por una nueva y las dos quedan enlazadas. El
            producto vuelve al stock y se descuenta de nuevo con lo que quede acá.
          </p>

          {/*
            ── El motivo va ARRIBA, y es lo primero que se ve ─────────────────

            Estuvo abajo, pegado al botón, con el argumento de que es «lo último
            que se escribe». En una página eso es cierto. En un MODAL QUE
            SCROLLEA es falso y caro: medido en el navegador, el campo nacía a
            1101px con el modal cortando en 1082 — debajo del fold— y el botón
            261px más abajo. Quien abría la corrección llegaba a un «Guardar»
            apagado sin haber visto nunca el campo que lo apaga.

            Arriba se resuelve solo: es lo primero que aparece, y además es lo
            primero que se sabe. Nadie abre esta pantalla sin saber por qué la
            abrió.
          */}
          <label className="aq-etiqueta-campo">
            <span>
              Por qué se corrige <span className="text-alerta">·</span>{' '}
              <span className="font-normal normal-case text-tenue">obligatorio</span>
            </span>
            <textarea
              name="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Se cargaron 2 botellones y habían salido 5"
              className="aq-campo"
            />
            <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
              Queda en la venta reemplazada y en la bitácora. Tiene que servir para entender el
              cambio dentro de tres meses.
            </span>
          </label>
        </>
      ) : (
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">Registrar una venta</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Una venta confirmada no se edita. Si sale mal, se anula y se hace de nuevo.
          </p>
        </div>
      )}

      <FormError id={idError}>{estado.error}</FormError>

      {/*
        El recorte contra el piso NO es un error: la venta se hizo. Va con otro
        peso para que quien cobró sepa que el código no entró entero, sin que
        parezca que algo falló.
      */}
      {estado.avisoDePiso ? (
        <p
          role="status"
          className="rounded-lg border border-alerta-borde bg-alerta-fondo p-3 text-[14px] text-alerta-texto"
        >
          {estado.avisoDePiso}
        </p>
      ) : null}

      {/*
        El cliente va primero, antes de los productos, y se queda con la fila entera.

        Es el campo del que dependen el precio, el crédito y el botellón sin
        vacío, y ahora además despliega resultados: en un tercio del ancho el
        nombre y el documento no entran en la misma línea.
      */}
      <BuscadorDeCliente
        elegido={cliente}
        onElegir={setCliente}
        sinCliente="Sin cliente se cobra la lista residencial."
      />

      {/*
        La base va justo debajo del cliente porque depende de él: se presta a
        una de SUS direcciones, y sin cliente no tiene dónde apuntar.

        Corrigiendo no aparece: la base que salió con la venta original sigue
        prestada y la corrección no la rehace. Ofrecerla acá prestaría una
        SEGUNDA base por arreglar un tipeo.
      */}
      {corrigiendo ? null : <EntregaDeBase cliente={cliente} />}

      {/*
        ── Cuándo fue la venta — RN-VEN-14 + RN-VEN-16 fecha corregible ──────

        Arranca en HOY para el alta (lo normal del mostrador) y en la fecha
        ORIGINAL para la corrección — `ocurrioEnOriginal` ya viene en
        `AAAA-MM-DD`, así que el `<input type="date">` la muestra directo sin
        volver a formatear.

        Existe para tres casos:
        - alta: la venta se carga tarde y se encuadra en el día real del hecho;
        - corrección: la venta se cargó con la fecha equivocada y se corrige al
          día que debería haber tenido — la nueva hereda por default pero el
          admin puede ajustarla dentro del piso de 90 días de RN-VEN-14;
        - ambos: el reporte del mes no se reescribe por un tipeo (RN-VEN-02).

        Es un `<input type="date">` nativo y no un calendario propio: en un
        celular abre el selector del sistema, que es táctil y conocido, y esto
        se usa parado al lado de una llenadora. Además el navegador ya lo muestra
        DD/MM/AAAA con el locale es-CO, mientras su `value` sigue siendo ISO —
        que es lo que `api/` espera.

        `max` lo cierra en hoy porque una venta futura no existe. El piso son los
        90 días de `DIAS_MAXIMOS_HACIA_ATRAS`; quien manda es `api/`, esto solo
        evita el viaje.
      */}
      <label className="aq-etiqueta-campo max-w-xs">
        <span>Cuándo fue la venta</span>
        <input
          type="date"
          name="ocurrioEn"
          value={ocurrioEn}
          max={HOY}
          min={HACE_90_DIAS}
          onChange={(e) => setOcurrioEn(e.target.value)}
          className="aq-campo"
        />
        <span className="mt-1 text-[13px] font-normal normal-case text-tenue">
          {corrigiendo
            ? 'Esta venta corregida va a contar en el día que elija, no en el día que se cargó.'
            : ocurrioEn === HOY
              ? 'Hoy. Cámbielo solo si está cargando una venta de otro día.'
              : 'Esta venta va a contar en el día que eligió, no en el de hoy.'}
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="aq-etiqueta-campo">
          <span>Cómo paga</span>
          <select
            value={medioDePago}
            onChange={(e) => setMedioDePago(e.target.value)}
            className="aq-campo"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="credito">Crédito</option>
          </select>
        </label>

        <label className="aq-etiqueta-campo">
          <span>
            Código <span className="font-normal normal-case">(opcional)</span>
          </span>
          <input
            name="codigoDescuento"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="VERANO2026"
            className="aq-campo uppercase"
          />
        </label>
      </div>

      <label className="aq-ficha">
        <input
          type="checkbox"
          checked={requiereFactura}
          onChange={(e) => setRequiereFactura(e.target.checked)}
          className="sr-only"
        />
        <span className="aq-ficha-caja" aria-hidden />
        El cliente pide factura electrónica
      </label>

      <section className="grid gap-2">
        <h3 className="aq-micro text-tenue">Qué se lleva</h3>

        <ul className="grid gap-2">
          {productos.map((producto) => {
            const cantidad = carrito[producto.id] ?? 0
            const vendible = vendibleDe(producto.id)

            return (
              <li
                key={producto.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sutil p-3"
              >
                <div className="min-w-0">
                  <p className="text-[14px] text-principal">{producto.nombre}</p>
                  <p className="mt-0.5 text-[13px] text-tenue">
                    <Cifra tono="secundario">
                      ${Number(precioDe(producto)).toLocaleString('es-CO')}
                    </Cifra>{' '}
                    · quedan <Cifra tono={vendible === 0 ? 'alerta' : 'secundario'}>{vendible}</Cifra>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => cambiar(producto.id, -1)}
                    disabled={cantidad === 0}
                    aria-label={`Quitar uno de ${producto.nombre}`}
                    className="aq-boton aq-boton-secundario aq-boton-compacto"
                  >
                    <Minus aria-hidden className="size-4" />
                  </button>

                  <span className="aq-cifra w-10 text-center text-[16px] text-principal">
                    {cantidad}
                  </span>

                  <button
                    type="button"
                    onClick={() => cambiar(producto.id, 1)}
                    aria-label={`Agregar uno de ${producto.nombre}`}
                    className="aq-boton aq-boton-secundario aq-boton-compacto"
                  >
                    <Plus aria-hidden className="size-4" />
                  </button>
                </div>

                {/*
                  ── Cobré otro precio — RN-VEN-15 ────────────────────────────

                  Vive DENTRO de la card y no en un panel aparte porque el precio
                  es de este producto: un campo suelto abajo obligaría a decir a
                  cuál se refiere, y esa es exactamente la clase de dato que se
                  pone en la fila equivocada.
                */}
                <div className="w-full border-t border-sutil pt-2.5">
                  <label className="aq-ficha">
                    <input
                      type="checkbox"
                      checked={producto.id in manuales}
                      onChange={() => alternarPrecioManual(producto.id)}
                      className="sr-only"
                    />
                    <span className="aq-ficha-caja" aria-hidden />
                    Cobré otro precio
                  </label>

                  {producto.id in manuales ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {/*
                        El ancho lo pone el CONTENEDOR, no el input.

                        `.aq-campo` declara `width: 100%` en una regla sin capa,
                        y las utilidades de Tailwind viven en `@layer utilities`:
                        un `w-28` sobre el input es inerte. Es la misma trampa
                        que `globals.css` ya documenta para `padding` y para
                        `position` — jsdom no hace layout, así que la suite pasa
                        en verde y el campo sale a todo lo ancho de la card.

                        Envolverlo es lo que ya hace el campo de fecha de acá
                        abajo con `max-w-xs`: el 100% del input se mide contra un
                        padre acotado, y nadie pelea contra la cascada.
                      */}
                      <span className="block w-32">
                        <input
                          inputMode="numeric"
                          autoComplete="off"
                          value={
                            manuales[producto.id]
                              ? Number(manuales[producto.id]).toLocaleString('es-CO')
                              : ''
                          }
                          onChange={(e) => escribirPrecio(producto.id, e.target.value)}
                          placeholder={Number(listaDe(producto)).toLocaleString('es-CO')}
                          aria-label={`Precio por unidad de ${producto.nombre}`}
                          className="aq-campo aq-cifra"
                        />
                      </span>

                      {/*
                        La lista se sigue viendo al lado. Es el mismo criterio que
                        el total antes de cobrar: quien escribe un precio tiene que
                        poder ver contra qué lo está escribiendo, sin cambiar de
                        pantalla ni destildar para espiar.
                      */}
                      <span className="text-[13px] text-tenue">
                        por unidad · la lista dice{' '}
                        <Cifra tono="secundario">
                          ${Number(listaDe(producto)).toLocaleString('es-CO')}
                        </Cifra>
                      </span>

                      {/*
                        El subtotal de ESTA línea, ya multiplicado.

                        El precio se escribe por unidad y se cobra por cantidad, y
                        esas dos cosas se confunden con tres botellones en el
                        mostrador. Mostrar la cuenta hecha es más barato que
                        anular la venta después — RN-VEN-02 no deja corregirla.
                      */}
                      {cantidad > 0 && manuales[producto.id] ? (
                        <span className="w-full text-[13px] text-principal">
                          {cantidad} ×{' '}
                          <Cifra tono="secundario">
                            ${Number(manuales[producto.id]).toLocaleString('es-CO')}
                          </Cifra>{' '}
                          ={' '}
                          <Cifra tono="principal">
                            ${(Number(manuales[producto.id]) * cantidad).toLocaleString('es-CO')}
                          </Cifra>
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {/*
        RN-VEN-17. Alta: defaults 1-a-1 sobre la cantidad de botellones del
        carrito (intercambio normal — caso común). Corrección: muestra los
        mismos dos campos, pre-cargados con los valores originales, editables.
        El server inserta los movimientos según el delta contra la original.
      */}
      {botellonesEnCarrito > 0 || (corrigiendo && (correccion.botellonesEntregados > 0 || correccion.botellonesRecibidos > 0)) ? (
        <div className="rounded-lg border border-sutil p-4">
          <p className="text-[13px] text-principal">
            {corrigiendo
              ? 'Botellones despachados y recibidos en la venta original. Ajuste si el registro estaba mal.'
              : '¿Cuántos botellones se llevan y cuántos traen de vuelta?'}
          </p>
          <p className="mt-1 text-[13px] text-tenue">
            Por defecto, un intercambio 1 a 1. Ajuste si el cliente compra sin devolver o devuelve sin comprar.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="aq-etiqueta-campo">
              <span>Entregados</span>
              <input
                type="number"
                min={0}
                {...(corrigiendo ? {} : { max: botellonesEnCarrito })}
                value={entregadosCap}
                onChange={(e) => {
                  setEntregados(Number(e.target.value))
                  setBotellonesDirty(true)
                }}
                className="aq-campo aq-cifra w-full"
              />
            </label>
            <label className="aq-etiqueta-campo">
              <span>Recibidos</span>
              <input
                type="number"
                min={0}
                value={recibidos}
                onChange={(e) => {
                  setRecibidos(Number(e.target.value))
                  setBotellonesDirty(true)
                }}
                className="aq-campo aq-cifra w-full"
              />
            </label>
          </div>

          {botellonSinCliente ? (
            <p className="mt-3 text-[13px] text-alerta">
              Un botellón que sale o vuelve queda a cargo de alguien. Elija el cliente arriba: sin
              nombre no hay a quién reclamárselo.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Lo que va a pasar al cobrar ───────────────────────────────────── */}
      {items.length > 0 ? (
        <section
          aria-live="polite"
          className="grid gap-2 rounded-xl border border-sutil bg-elevada p-4"
        >
          <p className="flex items-baseline justify-between gap-3">
            <span className="aq-micro text-tenue">Total estimado</span>
            <span>
              <Cifra tamano="grande">${total.toLocaleString('es-CO')}</Cifra>
            </span>
          </p>

          <p className="text-[13px] text-tenue">
            {cliente
              ? `Lista ${cliente.tipo}. `
              : 'Lista residencial, que es la de una venta de mostrador. '}
            El total definitivo lo calcula el servidor con los precios del momento
            {codigo ? ' y el código, que puede recortarse contra el precio mínimo' : ''}.
          </p>

          {excedidos.length > 0 ? (
            <p className="text-[13px] text-alerta-texto">
              Hay más unidades pedidas que disponibles. Lo que se lee acá es de hace un
              rato: quien decide es el servidor al confirmar.
            </p>
          ) : null}

          {creditoSinCliente ? (
            <p className="text-[13px] text-alerta-texto">
              Una venta a crédito necesita cliente: no hay a quién cobrarle una deuda sin
              dueño.
            </p>
          ) : null}

          {/*
            ── Un botón apagado tiene que decir qué lo apaga ──────────────────

            Es el mismo patrón que las dos líneas de arriba, y faltaba. Sin
            esto, «Guardar la corrección» se dibujaba gris y sin explicación: no
            hay forma de distinguir «le falta algo» de «esto está roto», y quien
            no encuentra qué falta concluye lo segundo.

            Va acá y no en el botón porque es donde ya viven los otros dos
            avisos —la sección tiene `aria-live`, así que un lector de pantalla
            lo anuncia cuando aparece— y porque un botón que crece con un texto
            adentro se mueve debajo del dedo.
          */}
          {corrigiendo && motivo.trim().length < LARGO_MINIMO_MOTIVO ? (
            <p className="text-[13px] text-alerta-texto">
              Falta decir por qué se corrige, arriba. Son al menos{' '}
              {LARGO_MINIMO_MOTIVO} caracteres: es lo que hace que el cambio se entienda
              dentro de tres meses.
            </p>
          ) : null}
        </section>
      ) : null}

      <button
        type="submit"
        disabled={
          enviando ||
          items.length === 0 ||
          botellonSinCliente ||
          /*
           * El motivo se exige acá y en `api/`. Acá para que el botón diga qué
           * falta antes del viaje; allá porque es donde vive la regla y esta
           * pantalla no es el único camino.
           */
          (corrigiendo && motivo.trim().length < LARGO_MINIMO_MOTIVO)
        }
        className="aq-boton aq-boton-primario aq-boton-grande justify-self-start"
      >
        {corrigiendo
          ? enviando
            ? 'Corrigiendo…'
            : 'Guardar la corrección'
          : enviando
            ? 'Registrando…'
            : 'Cobrar'}
      </button>
    </form>
  )
}
