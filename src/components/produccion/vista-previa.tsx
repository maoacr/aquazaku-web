import { Cifra } from '@/components/stock/cifra'
import { Estado } from '@/components/ui/estado'
import type { InsumoListado, SaldoDeAgua } from '@/lib/api-types'
import type { VistaPreviaDelCierre } from '@/lib/produccion'

/**
 * Lo que va a pasar al confirmar — antes de confirmar.
 *
 * ── Por qué se muestra el cálculo y no solo el resultado ────────────────────
 *
 * «Van a salir 795 litros» no se puede verificar. «10 pacas de 600, 5 de 300 y
 * 30 botellones = 795 litros» sí: quien cargó los conteos reconoce sus propios
 * números y puede decir «esas pacas no fueron diez» ANTES de escribirlo en tres
 * libros que no se editan.
 *
 * Es la misma decisión que la vista previa de la conversión en M3.
 *
 * ── Los avisos anticipan; no deciden ───────────────────────────────────────
 *
 * Que no alcancen las tapas o que falte la medición del lavado lo rechaza
 * `api/` con un mensaje que dice qué hacer. Acá se anticipa para no hacer
 * llenar todo el formulario y rebotarlo al enviar — pero la regla sigue
 * viviendo de un solo lado (RN-ACC-02).
 */
export function VistaPrevia({
  previa,
  insumos,
  aguaProcesada,
  insumosPorBotellon,
  hayAlgoQueMostrar,
}: {
  previa: VistaPreviaDelCierre
  insumos: InsumoListado[]
  aguaProcesada: SaldoDeAgua | undefined
  insumosPorBotellon: string[]
  hayAlgoQueMostrar: boolean
}) {
  if (!hayAlgoQueMostrar) return null

  const necesarios = insumosPorBotellon.map((codigo) => ({
    codigo,
    insumo: insumos.find((i) => i.codigo === codigo),
  }))

  const faltantes = necesarios.filter(
    ({ insumo }) => insumo !== undefined && insumo.saldo < previa.insumosConsumidos,
  )
  const sinCargar = necesarios.filter(({ insumo }) => insumo === undefined)

  const aguaAlcanza =
    aguaProcesada === undefined || previa.litrosConsumidos <= aguaProcesada.litros

  return (
    <section
      aria-live="polite"
      className="grid gap-4 rounded-xl border border-sutil bg-elevada p-4"
    >
      <h3 className="aq-micro text-tenue">Al confirmar va a pasar esto</h3>

      <dl className="grid gap-3 sm:grid-cols-3">
        <Dato
          termino="Sale del tanque procesado"
          detalle={detalleDelConsumo(previa)}
        >
          <Cifra tono="agua" tamano="grande">
            {previa.litrosConsumidos.toLocaleString('es-CO')}
          </Cifra>{' '}
          <span className="text-[13px] text-tenue">L</span>
        </Dato>

        <Dato
          termino="Entra al tanque procesado"
          detalle={
            previa.litrosProcesados === null
              ? 'Sin caudal medido no se puede calcular.'
              : `Consume ${previa.litrosCrudosConsumidos?.toLocaleString('es-CO')} L de agua cruda.`
          }
        >
          {previa.litrosProcesados === null ? (
            <span className="text-[15px] text-tenue">Sin calcular</span>
          ) : (
            <>
              <Cifra tono="agua" tamano="grande">
                {previa.litrosProcesados.toLocaleString('es-CO')}
              </Cifra>{' '}
              <span className="text-[13px] text-tenue">L</span>
            </>
          )}
        </Dato>

        <Dato
          termino="Se consumen"
          detalle={
            previa.insumosConsumidos === 0
              ? 'No se llenaron botellones.'
              : `Uno de cada uno por botellón: ${insumosPorBotellon.join(' y ')}.`
          }
        >
          <Cifra tamano="grande">{previa.insumosConsumidos.toLocaleString('es-CO')}</Cifra>{' '}
          <span className="text-[13px] text-tenue">
            de cada insumo
          </span>
        </Dato>
      </dl>

      {previa.lotes.length > 0 ? (
        <div className="grid gap-2">
          <p className="aq-micro text-tenue">Lotes que se van a generar</p>
          <ul className="grid gap-1.5">
            {previa.lotes.map((lote) => (
              <li key={lote.codigoDeProducto} className="flex items-baseline gap-2 text-[14px]">
                <Cifra>{lote.cantidad}</Cifra>
                <span className="text-secundario">{lote.nombre}</span>
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-tenue">
            Uno por producto, con 30 días de vencimiento desde hoy.
          </p>
        </div>
      ) : null}

      {/* ── Lo que `api/` va a rechazar, dicho antes de llenar el formulario ── */}

      {previa.faltaMedirElLavado ? (
        <Aviso tono="justo" titulo="Falta la medición del lavado">
          Hay <Cifra>{previa.botellonesLavados}</Cifra> botellones lavados pero nadie midió
          cuántos litros lleva enjuagar uno. Sin ese número, un término del balance
          quedaría en cero y el agua no cuadraría nunca. Se mide una vez.
        </Aviso>
      ) : null}

      {previa.productosFaltantes.length > 0 ? (
        <Aviso tono="expuesto" titulo="Falta un producto en el catálogo">
          No está {previa.productosFaltantes.join(', ')}. No lo podemos contar como cero: el
          consumo saldría bajo, el balance cerraría con un número que parece correcto y
          nadie lo relacionaría con esto.
        </Aviso>
      ) : null}

      {sinCargar.length > 0 ? (
        <Aviso tono="expuesto" titulo="Falta un insumo en el catálogo">
          No está {sinCargar.map((f) => f.codigo).join(', ')}. Cárguelo en Insumos antes de
          cerrar: el cierre lo descuenta y no puede descontar algo que no existe.
        </Aviso>
      ) : null}

      {faltantes.length > 0 ? (
        <Aviso tono="justo" titulo="No alcanzan los insumos">
          {faltantes.map(({ insumo }) => (
            <span key={insumo?.id} className="block">
              {insumo?.nombre}: quedan{' '}
              <Cifra>{insumo?.saldo.toLocaleString('es-CO')}</Cifra> y el cierre consume{' '}
              <Cifra>{previa.insumosConsumidos.toLocaleString('es-CO')}</Cifra>.
            </span>
          ))}
          <span className="mt-1 block">
            Si se envasaron igual, el inventario estaba mal antes: regístrelo con un ajuste
            y vuelva a cerrar.
          </span>
        </Aviso>
      ) : null}

      {!aguaAlcanza && aguaProcesada ? (
        <Aviso tono="justo" titulo="El libro dice que no hay tanta agua">
          El tanque procesado figura con{' '}
          <Cifra tono="agua">{aguaProcesada.litros.toLocaleString('es-CO')}</Cifra> L y el
          cierre consume{' '}
          <Cifra tono="agua">{previa.litrosConsumidos.toLocaleString('es-CO')}</Cifra>. Puede
          ser que falte registrar una reposición, o que el saldo venga descuadrado de antes.
        </Aviso>
      ) : null}
    </section>
  )
}

function Dato({
  termino,
  detalle,
  children,
}: {
  termino: string
  detalle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="aq-micro text-tenue">{termino}</dt>
      <dd className="mt-1">
        <p className="flex items-baseline gap-1">{children}</p>
        <p className="mt-1 text-[13px] text-tenue">{detalle}</p>
      </dd>
    </div>
  )
}

function Aviso({
  tono,
  titulo,
  children,
}: {
  tono: 'justo' | 'expuesto'
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-sutil p-3">
      <Estado tono={tono}>{titulo}</Estado>
      <p className="text-[14px] text-secundario">{children}</p>
    </div>
  )
}

/** El cálculo completo, para poder reconocer el propio error en los conteos. */
function detalleDelConsumo(previa: VistaPreviaDelCierre): string {
  if (previa.lotes.length === 0) return 'Todavía no se cargó nada envasado.'

  return previa.lotes
    .map((l) => `${l.cantidad.toLocaleString('es-CO')} × ${l.nombre}`)
    .join(' + ')
}
