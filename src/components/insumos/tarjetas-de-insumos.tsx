import { PackageOpen } from 'lucide-react'
import { Estado, type Tono } from '@/components/ui/estado'
import { Vacio } from '@/components/ui/vacio'
import type { InsumoListado } from '@/lib/api-types'

/**
 * El estado de un insumo, en la escala de cobertura del sistema.
 *
 * No son `ok`/`warning`/`error`: son grados de **cobertura**. Un insumo en el
 * mínimo no es un error —nadie se equivocó— es un estado del que hay que
 * ocuparse antes de que frene la planta.
 */
export function nivelDeInsumo(insumo: InsumoListado): Tono {
  if (insumo.saldo === 0) return 'expuesto'
  return insumo.bajoMinimo ? 'justo' : 'cubierto'
}

const QUE_SIGNIFICA: Record<Tono, string> = {
  cubierto: 'Alcanza',
  justo: 'Hay que pedir',
  expuesto: 'Sin unidades',
}

export function TarjetasDeInsumos({ insumos }: { insumos: InsumoListado[] }) {
  if (insumos.length === 0) {
    return (
      <Vacio
        variante="primera-vez"
        icono={PackageOpen}
        titulo="Todavía no hay insumos cargados"
      >
        Las tapas, los sellos y las bolsas se cargan acá. Sin ellos, el sistema no puede
        avisar cuándo hay que pedir más.
      </Vacio>
    )
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {insumos.map((insumo) => (
        <li key={insumo.id}>
          <TarjetaDeInsumo insumo={insumo} />
        </li>
      ))}
    </ul>
  )
}

function TarjetaDeInsumo({ insumo }: { insumo: InsumoListado }) {
  const nivel = nivelDeInsumo(insumo)

  return (
    <article className="aq-tarjeta grid h-full gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="aq-titulo-tarjeta truncate text-principal">{insumo.nombre}</p>
          <p className="aq-cifra mt-0.5 text-[13px] text-tenue">{insumo.codigo}</p>
        </div>

        {/* Cuatro canales: color, forma, icono y texto. Con perder tres, el
            estado se sigue leyendo — al sol, en blanco y negro, o para quien
            no distingue verde de rojo. */}
        <Estado tono={nivel}>{QUE_SIGNIFICA[nivel]}</Estado>
      </div>

      <p className="flex items-baseline gap-2">
        <span className="aq-cifra text-[32px] font-semibold leading-none text-principal">
          {insumo.saldo}
        </span>
        <span className="text-[13px] text-tenue">
          {insumo.saldo === 1 ? 'unidad' : 'unidades'}
        </span>
      </p>

      <p className="text-[13px] text-tenue">
        Mínimo: <span className="aq-cifra">{insumo.minimo}</span>
      </p>

      {insumo.equivalenciaPorKilo === null ? (
        /*
          No es un aviso de error: es una medición que falta. Se dice acá porque
          es quien mira este insumo el que puede ir a hacerla, y porque explica
          por qué el formulario de entrada no ofrece kilos.
        */
        <p className="text-[13px] text-tenue">
          Sin equivalencia medida — la compra se carga en unidades.
        </p>
      ) : (
        <p className="text-[13px] text-tenue">
          <span className="aq-cifra">{Number(insumo.equivalenciaPorKilo)}</span> unidades por
          kilo
        </p>
      )}
    </article>
  )
}
