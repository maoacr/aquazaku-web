import { Receipt } from 'lucide-react'
import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import { Vacio } from '@/components/ui/vacio'
import type { CanalDeVenta, MedioDePago, VentaDelListado } from '@/lib/api-types'
import { fechaYHoraEnLaPlanta } from '@/lib/hora-de-la-planta'

/**
 * Desde dónde se mira esta lista.
 *
 * Cambia dos cosas —qué va arriba de cada tarjeta y qué dice el vacío— y las
 * dos son la MISMA decisión: si el cliente ya viene dado por el contexto o no.
 * Por eso es un solo prop y no dos: con dos se podría pedir la combinación
 * incoherente —esconder el nombre y seguir diciendo «todavía no hay ventas»,
 * que dentro de una ficha se lee como que el negocio no vendió nunca—.
 */
type Desde = 'la-pantalla-de-ventas' | 'la-ficha-del-cliente'

interface PropsDeUltimasVentas {
  ventas: VentaDelListado[]
  desde?: Desde
}

const VACIO: Record<Desde, { titulo: string; explicacion: string }> = {
  'la-pantalla-de-ventas': {
    titulo: 'Todavía no hay ventas',
    explicacion: 'Cada venta descuenta el stock y —si es a crédito— suma a la deuda del cliente.',
  },
  'la-ficha-del-cliente': {
    titulo: 'Este cliente todavía no compró',
    explicacion:
      'Puede haber comprado en el mostrador sin dar su documento: esa venta no queda a su nombre.',
  },
}

/**
 * Las últimas ventas, en tarjetas.
 *
 * ── Qué salió, a quién y cómo se pagó ───────────────────────────────────────
 *
 * Es lo que promete la pantalla, y durante un tiempo la tarjeta contestó solo
 * la tercera: un monto grande, el medio de pago y la hora. Dos ventas de
 * $20.000 en la misma tarde eran dos tarjetas idénticas, y para saber cuál era
 * la de la señora del 302 había que abrir la venta.
 *
 * Ahora el orden de lectura es el de la pregunta: **a quién** arriba —el dato
 * que distingue una fila de la otra—, **qué salió** debajo, y la plata a la
 * derecha, donde se la busca cuando se cuadra la caja.
 *
 * ── Tarjetas y no tabla ─────────────────────────────────────────────────────
 *
 * Por lo mismo que en clientes: siete columnas en un teléfono obligan a
 * scrollear en horizontal para leer una venta, y esto se consulta parado en el
 * mostrador.
 */
export function UltimasVentas({ ventas, desde = 'la-pantalla-de-ventas' }: PropsDeUltimasVentas) {
  if (ventas.length === 0) {
    const vacio = VACIO[desde]

    return (
      <Vacio variante="primera-vez" icono={Receipt} titulo={vacio.titulo}>
        {vacio.explicacion}
      </Vacio>
    )
  }

  return (
    <ul className="grid gap-3">
      {ventas.map((venta) => (
        <li key={venta.id}>
          <TarjetaDeVenta venta={venta} desde={desde} />
        </li>
      ))}
    </ul>
  )
}

function TarjetaDeVenta({ venta, desde }: { venta: VentaDelListado; desde: Desde }) {
  const anulada = venta.estado === 'anulada'
  const enLaFichaDelCliente = desde === 'la-ficha-del-cliente'

  return (
    <article className="aq-tarjeta grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
      <div className="min-w-0">
        {/*
          Arriba va el dato que DISTINGUE una venta de la de al lado, y cuál es
          depende de dónde se mire.

          En la pantalla de ventas, veinte tarjetas son de veinte personas:
          distingue a quién. En la ficha de un cliente, las veinte son de la
          misma persona —el nombre ya está en el título de la pantalla— y
          repetirlo veinte veces no distingue nada: es la misma palabra con peso
          de título en cada tarjeta, tapando lo que sí cambia. Ahí lo que
          distingue es CUÁNDO, así que la fecha sube del pie al encabezado.
        */}
        {enLaFichaDelCliente ? (
          <h3 className="aq-titulo-tarjeta truncate text-principal">
            {fechaYHoraEnLaPlanta(venta.createdAt)}
          </h3>
        ) : (
          /*
            El nombre en tono TENUE cuando no hay cliente. Es la diferencia entre
            «esta venta fue de alguien» y «esta venta no tuvo cliente», y ponerlos
            con el mismo peso haría que «Sin cliente» se leyera como un nombre más
            en la lista.
          */
          <h3
            className={`aq-titulo-tarjeta truncate ${
              venta.clienteNombre ? 'text-principal' : 'text-tenue'
            }`}
          >
            {venta.clienteNombre ?? 'Sin cliente'}
          </h3>
        )}

        <QueSalio venta={venta} />

        <p className="mt-2 text-[13px] text-tenue">
          {elPie(venta, enLaFichaDelCliente).join(' · ')}
        </p>

        {/*
          Una venta anulada NO desaparece: cambia de estado y muestra por qué.
          Esconderla sería reescribir el día.
        */}
        {anulada && venta.motivoAnulacion ? (
          <p className="mt-1 text-[13px] text-alerta-texto">{venta.motivoAnulacion}</p>
        ) : null}
      </div>

      <div className="grid gap-2 justify-items-start sm:justify-items-end">
        <p className="flex flex-wrap items-baseline gap-2">
          <Cifra tamano="grande" tono={anulada ? 'secundario' : 'principal'}>
            ${Number(venta.total).toLocaleString('es-CO')}
          </Cifra>
          <span className="text-[13px] text-tenue">{MEDIO[venta.medioDePago]}</span>
        </p>

        <Estado tono={anulada ? 'expuesto' : 'cubierto'}>
          {anulada ? 'Anulada' : 'Confirmada'}
        </Estado>
      </div>
    </article>
  )
}

/**
 * Qué salió.
 *
 * Un recargo por daño (`dano_base`) no tiene líneas —hay un trigger en la base
 * que lo impide— así que acá se nombra en palabras. Sin esto se dibujaría como
 * una venta a la que se le perdieron los productos, que es justo lo contrario
 * de lo que pasó: nunca los tuvo.
 */
function QueSalio({ venta }: { venta: VentaDelListado }) {
  if (venta.tipo === 'dano_base') {
    return <p className="mt-1.5 text-[14px] text-secundario">Recargo por daño a una base</p>
  }

  return (
    <ul className="mt-1.5 grid gap-0.5 text-[14px] text-secundario">
      {venta.lineas.map((linea) => (
        <li key={linea.productoNombre} className="truncate">
          {/* La cantidad en mono: es una cifra, y en la columna se comparan. */}
          <Cifra tono="secundario">{linea.cantidad}</Cifra>
          {' × '}
          {linea.productoNombre}

          {/*
            ── El precio, SOLO cuando alguien lo escribió — RN-VEN-15 ─────────

            La bitácora guarda el delta contra la lista, pero vive en Auditoría:
            hay que acordarse de ir. Esta lista se mira todos los días, y sin
            esto una venta a $3.800 se dibuja igual que una a $10.000.

            Va en la LÍNEA y no en la venta porque una venta puede mezclar las
            dos cosas: marcar la venta entera diría que todos sus productos se
            cobraron distinto, y sería falso para los que no.

            Y aparece solo en las manuales a propósito. Mostrarlo en todas lo
            convertiría en una columna más —ruido en la abrumadora mayoría de
            las filas, donde el precio es el del catálogo y no dice nada—. Su
            ausencia significa «se cobró la lista».
          */}
          {linea.precioManual ? (
            <>
              {' · '}
              <Cifra tono="alerta">${Number(linea.precioFinal).toLocaleString('es-CO')}</Cifra>
              <span className="text-tenue"> a mano</span>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * El pie: cuándo, por dónde entró y quién la cargó.
 *
 * Va en un solo renglón porque son datos de CONTEXTO —se leen cuando algo no
 * cuadra, no mientras se atiende— y cuatro renglones de contexto empujarían
 * hacia abajo lo que sí se busca de un vistazo.
 *
 * El canal aparece siempre, incluso cuando es «Mostrador». Un dato que aparece
 * y desaparece obliga a leer cada tarjeta entera para saber si está o no.
 */
function elPie(venta: VentaDelListado, sinLaFecha: boolean): string[] {
  // Cuando la fecha ya es el encabezado, acá sería el mismo dato escrito dos
  // veces en cuatro centímetros de tarjeta.
  const partes = sinLaFecha
    ? [CANAL[venta.canal]]
    : [fechaYHoraEnLaPlanta(venta.createdAt), CANAL[venta.canal]]

  // `null` es una cuenta borrada, no una venta sin autor. Nombrarlo como
  // «desconocido» sería inventar una explicación que nadie comprobó.
  if (venta.registradoPorNombre) partes.push(venta.registradoPorNombre)
  if (venta.requiereFacturaElectronica) partes.push('pidió factura')

  return partes
}

const MEDIO: Record<MedioDePago, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  credito: 'Crédito',
}

const CANAL: Record<CanalDeVenta, string> = {
  mostrador: 'Mostrador',
  whatsapp: 'WhatsApp',
  ruta: 'Ruta',
}
