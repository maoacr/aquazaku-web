/**
 * R49 · La carga de Usuarios.
 *
 * Arriba el formulario de alta y abajo la tabla. Son dos bloques y se
 * dibujan los dos: mostrar solo la tabla haría aparecer el formulario de
 * golpe empujando todo hacia abajo.
 */
import { EsqueletoDePantalla, EsqueletoDeTabla } from '@/components/ui/esqueleto'

export default function Cargando() {
  return (
    <EsqueletoDePantalla>
      <EsqueletoDeTabla columnas={2} filas={2} anchos={['w-32', 'w-full']} />
      <EsqueletoDeTabla columnas={5} anchos={['w-36', 'w-52', 'w-20', 'w-40', 'w-24']} />
    </EsqueletoDePantalla>
  )
}
