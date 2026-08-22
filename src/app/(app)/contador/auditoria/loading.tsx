/**
 * R49 · La carga de la auditoría del contador.
 *
 * Misma forma que la de admin: el alcance cambia, la grilla no.
 */
import { EsqueletoDePantalla, EsqueletoDeTabla } from '@/components/ui/esqueleto'

export default function Cargando() {
  return (
    <EsqueletoDePantalla>
      <EsqueletoDeTabla columnas={5} filas={2} anchos={['w-24', 'w-24', 'w-24', 'w-24', 'w-24']} />
      <EsqueletoDeTabla columnas={5} filas={8} anchos={['w-36', 'w-44', 'w-32', 'w-24', 'w-28']} />
    </EsqueletoDePantalla>
  )
}
