import { Encabezados, Etiqueta, SinResultados, Tabla, Td, Th } from '@/components/ui/tabla'
import type { Producto } from '@/lib/api-types'

/**
 * Catálogo en modo lectura. Lo ven los cuatro roles.
 *
 * Server Component: no hay estado ni interacción, así que no hay razón para
 * mandar JavaScript al browser. Sin TanStack Table por lo mismo — con tres
 * productos sería una librería entera para renderizar celdas estáticas.
 */
export function TablaDeProductos({ productos }: { productos: Producto[] }) {
  return (
    <Tabla>
      <Encabezados>
        <Th>Código</Th>
        <Th>Producto</Th>
        <Th>Contenido</Th>
        <Th>Residencial</Th>
        <Th>Comercial</Th>
        <Th>Piso</Th>
        <Th>Estado</Th>
      </Encabezados>
      <tbody>
        {productos.length === 0 ? (
          <SinResultados columnas={7}>No hay productos que mostrar.</SinResultados>
        ) : (
          productos.map((p) => (
            <tr key={p.id}>
              <Td className="font-mono text-xs">{p.codigo}</Td>
              <Td>{p.nombre}</Td>
              <Td className="whitespace-nowrap text-secundario">
                {p.presentacion === 'paca'
                  ? `${p.unidades} × ${p.contenidoMl} ml`
                  : `${p.contenidoMl / 1000} L`}
                <span className="ml-2 text-xs">({litros(p.litros)} L)</span>
              </Td>
              <Td className="whitespace-nowrap tabular-nums">{pesos(p.precioResidencial)}</Td>
              <Td className="whitespace-nowrap tabular-nums">{pesos(p.precioComercial)}</Td>
              <Td className="whitespace-nowrap tabular-nums text-secundario">
                {pesos(p.precioMinimo)}
              </Td>
              <Td>
                {p.activo ? (
                  <Etiqueta tono="ok">activo</Etiqueta>
                ) : (
                  <Etiqueta tono="neutro">desactivado</Etiqueta>
                )}
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </Tabla>
  )
}

/**
 * Formatea un monto que viene como string.
 *
 * `Intl` necesita un número, así que la conversión ocurre acá y **solo para
 * mostrar**. El valor que se reenvía a `api/` sigue siendo el string original:
 * un float redondeado que vuelve a la base es un peso que no cuadra.
 */
export function pesos(monto: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(monto))
}

/** `12.000` es ruido; `12` es el dato. */
function litros(valor: string): string {
  return String(Number(valor))
}
