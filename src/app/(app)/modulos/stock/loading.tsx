/**
 * R49 · La carga de Stock.
 *
 * La columna de vencidos aparece solo cuando hay algo vencido, así que el
 * esqueleto dibuja las tres que están siempre. Dibujar una que puede no
 * llegar sería el mismo salto al revés.
 */
import { EsqueletoDePantalla, EsqueletoDeTabla } from '@/components/ui/esqueleto'

export default function Cargando() {
  return (
    <EsqueletoDePantalla>
      <EsqueletoDeTabla columnas={3} anchos={['w-52', 'w-14', 'w-14']} />
    </EsqueletoDePantalla>
  )
}
