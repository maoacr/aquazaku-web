/**
 * R49 · La carga de Productos.
 *
 * Siete columnas: código, producto, contenido, tres precios y estado. El
 * esqueleto las dibuja todas para que la tabla no salte al llegar.
 */
import { EsqueletoDePantalla, EsqueletoDeTabla } from '@/components/ui/esqueleto'

export default function Cargando() {
  return (
    <EsqueletoDePantalla>
      <EsqueletoDeTabla
        columnas={7}
        anchos={['w-24', 'w-44', 'w-32', 'w-16', 'w-16', 'w-16', 'w-20']}
      />
    </EsqueletoDePantalla>
  )
}
