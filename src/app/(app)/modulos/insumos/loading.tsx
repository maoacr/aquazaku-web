import { Esqueleto, EsqueletoDePantalla } from '@/components/ui/esqueleto'

/**
 * R49 · La carga de Insumos.
 *
 * Dibuja TARJETAS y no una tabla, porque eso es lo que llega. Un esqueleto que
 * no coincide con lo que viene reproduce el salto que se quería evitar — el
 * mismo `layout shift` que en un mostrador se paga en clics equivocados.
 *
 * Cuatro: son los insumos que la planta tiene hoy —dos tapas y dos bolsas—, así
 * que es la forma más probable y no un número al azar.
 */
export default function Cargando() {
  return (
    <EsqueletoDePantalla>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="aq-tarjeta grid gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1.5">
                <Esqueleto className="h-6 w-40" />
                <Esqueleto className="h-4 w-20" />
              </div>
              <Esqueleto className="h-6 w-24 rounded-full" />
            </div>
            <Esqueleto className="h-8 w-24" />
            <Esqueleto className="h-4 w-28" />
          </li>
        ))}
      </ul>
    </EsqueletoDePantalla>
  )
}
