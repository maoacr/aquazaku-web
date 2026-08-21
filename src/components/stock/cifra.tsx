import type { ReactNode } from 'react'

/**
 * Toda cantidad, código de lote, ID y monto va en mono con `tabular-nums`.
 *
 * Regla del sistema de diseño, y no es estética: en una columna de números
 * proporcionales el `1` es más angosto que el `8`, así que las cifras no
 * alinean y comparar dos filas obliga a leerlas dígito por dígito.
 *
 * Nunca en texto corrido.
 */
export function Cifra({
  children,
  tono = 'principal',
  tamano = 'cuerpo',
}: {
  children: ReactNode
  tono?: 'principal' | 'secundario' | 'agua' | 'alerta' | 'exito'
  tamano?: 'cuerpo' | 'grande'
}) {
  const tonos = {
    principal: 'text-principal',
    secundario: 'text-secundario',
    // Agua, botellones y bases. Nunca se mezcla con dinero.
    agua: 'text-agua',
    alerta: 'text-alerta-texto',
    // Reservado: solo cuando significa "todo en orden".
    exito: 'text-exito-texto',
  } as const

  return (
    <span
      className={`aq-cifra ${tonos[tono]} ${tamano === 'grande' ? 'text-2xl font-semibold' : ''}`}
    >
      {children}
    </span>
  )
}
