import { AlertTriangle, PackageX } from 'lucide-react'
import type { ResumenDeStock } from '@/lib/api-types'

/**
 * Qué hay que hacer con el stock, si es que hay algo que hacer.
 *
 * Lección de M1: la pregunta no es "¿falta algo?" sino **"¿qué acción hace
 * falta?"**. Un aviso que se apaga antes de que el problema esté resuelto
 * convence de que terminaste.
 *
 * Acá hay dos situaciones distintas y cada una pide algo diferente:
 * producto vencido que hay que descartar, y producto agotado que hay que
 * reponer. Mezclarlas en un solo cartel obliga a leer el detalle para saber
 * cuál de las dos es.
 *
 * Si no hay nada que hacer, no hay cartel: el sistema no felicita.
 */
export function AvisoDeStock({ productos }: { productos: ResumenDeStock[] }) {
  const conVencido = productos.filter((p) => p.vencido > 0)
  const agotados = productos.filter((p) => p.activo && p.vendible === 0)

  if (conVencido.length === 0 && agotados.length === 0) return null

  return (
    <div className="grid gap-3">
      {conVencido.length > 0 ? (
        <Aviso
          icono={<AlertTriangle aria-hidden className="size-5 shrink-0" />}
          titulo={
            conVencido.length === 1
              ? 'Hay producto vencido que sigue en la bodega'
              : `Hay producto vencido en ${conVencido.length} productos`
          }
        >
          Vencido no es descartado: las unidades siguen ocupando lugar hasta que alguien las
          descarte. {conVencido.map((p) => p.codigo).join(', ')}.
        </Aviso>
      ) : null}

      {agotados.length > 0 ? (
        <Aviso
          icono={<PackageX aria-hidden className="size-5 shrink-0" />}
          titulo={
            agotados.length === 1
              ? '1 producto activo sin unidades para vender'
              : `${agotados.length} productos activos sin unidades para vender`
          }
        >
          {agotados.map((p) => p.codigo).join(', ')} — está en el catálogo pero no se puede
          despachar.
        </Aviso>
      ) : null}
    </div>
  )
}

function Aviso({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode
  titulo: string
  children: React.ReactNode
}) {
  return (
    <div
      role="status"
      className="flex gap-3 rounded-lg border border-alerta-borde bg-alerta-fondo px-4 py-3 text-alerta-texto"
    >
      {icono}
      <div className="text-[14px]">
        <p className="font-semibold">{titulo}</p>
        <p className="mt-0.5 opacity-90">{children}</p>
      </div>
    </div>
  )
}
