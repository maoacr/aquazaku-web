import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import type { ParqueDeBotellones } from '@/lib/api-types'

/**
 * La ley de conservación, a la vista — RN-ENV-02.
 *
 * ── Por qué esto ocupa lugar en la pantalla ─────────────────────────────────
 *
 * El botellón no tiene identificador individual, así que **uno que se pierde no
 * deja hueco en ninguna tabla**: no hay fila huérfana ni ID que falte. Lo único
 * que cambia es que la suma deja de cerrar.
 *
 * El dominio pidió que ese fallo fuera *ruidoso*. Un número que solo existe en
 * un test corre una vez al día en CI; acá lo ve quien abre la pantalla.
 *
 * Cuando cuadra, ocupa una línea y no molesta. Cuando no cuadra, dice **cuántos
 * faltan** y qué significa — que es la única información accionable que existe
 * sobre un botellón perdido.
 */
export function EstadoDelParque({ parque }: { parque: ParqueDeBotellones }) {
  return (
    <section className="aq-tarjeta grid gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="aq-titulo-tarjeta text-principal">El parque de botellones</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Los botellones no tienen número de serie, así que la única forma de saber que
            falta uno es que la cuenta no cierre.
          </p>
        </div>

        <Estado tono={parque.cuadra ? 'cubierto' : 'expuesto'}>
          {parque.cuadra ? 'La cuenta cierra' : 'No cuadra'}
        </Estado>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="aq-micro text-tenue">En bodega</dt>
          <dd className="mt-1">
            <Cifra tamano="grande">{parque.enBodega.toLocaleString('es-CO')}</Cifra>
          </dd>
        </div>

        <div>
          <dt className="aq-micro text-tenue">Afuera, con clientes</dt>
          <dd className="mt-1">
            <Cifra tamano="grande">
              {(parque.enPoderDeAlguien - parque.enBodega).toLocaleString('es-CO')}
            </Cifra>
          </dd>
        </div>

        <div>
          <dt className="aq-micro text-tenue">Registrados en total</dt>
          <dd className="mt-1">
            <Cifra tamano="grande" tono={parque.cuadra ? 'principal' : 'alerta'}>
              {parque.registrados.toLocaleString('es-CO')}
            </Cifra>
            <p className="mt-1 text-[13px] text-tenue">compras más ajustes, menos descartes</p>
          </dd>
        </div>
      </dl>

      {!parque.cuadra ? (
        <p className="rounded-lg border border-error-borde bg-error-fondo p-3 text-[14px] text-error-texto">
          Hay <Cifra tono="alerta">{Math.abs(parque.diferencia)}</Cifra> botellones de
          diferencia
          {parque.diferencia < 0
            ? ': el libro dice que hay menos de los que se registraron. Falta una entrega o un retorno sin anotar.'
            : ': el libro dice que hay más de los registrados. Sobra un movimiento, o falta registrar una compra.'}{' '}
          Cuente el parque y corrija con un ajuste, que exige motivo.
        </p>
      ) : null}
    </section>
  )
}
