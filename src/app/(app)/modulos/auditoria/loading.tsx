/**
 * R49 · La carga de Auditoría.
 *
 * Los filtros arriba y el registro abajo. Es la pantalla más pesada del
 * sistema —trae páginas de eventos— así que es donde más se nota.
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
