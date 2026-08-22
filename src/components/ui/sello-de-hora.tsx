/**
 * R51 · El dato tibio se marca, no se esconde.
 *
 * ```
 * dado    una consulta de stock
 * entonces se muestra a qué hora se leyó
 * y        el dato viejo se marca en vez de ocultarse
 * ```
 *
 * ── Por qué esto importa acá y no en cualquier app ──────────────────────────
 *
 * En Aquazaku el stock lo mueven varias personas a la vez: alguien despacha en
 * el mostrador mientras otro registra un descarte en la bodega. Un número de
 * inventario en pantalla **siempre** es de hace un rato — la pregunta no es si
 * está viejo, es cuánto.
 *
 * Esconder eso es peor que mostrarlo. Quien ve «110 unidades» sin más asume que
 * es ahora, y si son de hace veinte minutos puede prometer un despacho que ya no
 * existe. Decir la hora convierte una certeza falsa en una estimación honesta,
 * que es lo que el dato realmente es.
 *
 * ── Por qué la hora la calcula el servidor ──────────────────────────────────
 *
 * `leidoEn` llega por parámetro desde quien hizo la consulta. Tomarla en el
 * browser mediría cuándo se pintó la pantalla, no cuándo se leyó la base — y
 * entre las dos cosas hay una carga de red y un render, que es justamente el
 * rato que se quiere reportar.
 */
export function SelloDeHora({ leidoEn }: { leidoEn: Date }) {
  return (
    <p className="text-[13px] text-tenue">
      {/*
        `<time>` con `dateTime` en ISO: el texto es para leer y el atributo es
        para que una máquina —o un lector de pantalla— sepa de qué momento
        exacto se habla, sin depender del formato local.
      */}
      Datos leídos a las{' '}
      <time dateTime={leidoEn.toISOString()} className="text-secundario">
        {formatearHora(leidoEn)}
      </time>
      . El inventario lo mueven varias personas: recargue para ver el último.
    </p>
  )
}

/**
 * La hora en formato de Colombia, sin la fecha.
 *
 * Sin fecha a propósito: esto se mira para saber si el número es de hace un
 * minuto o de hace una hora, y la fecha en un dato que se relee todo el tiempo
 * es ruido. Si alguien dejó la pantalla abierta desde ayer, el problema no lo
 * resuelve un sello de hora.
 */
function formatearHora(momento: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(momento)
}
