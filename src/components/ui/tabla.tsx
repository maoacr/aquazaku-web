import type { ReactNode } from 'react'

/**
 * Tabla server-rendered.
 *
 * ── Por qué no TanStack Table ───────────────────────────────────────────────
 *
 * El stack lo incluye (spec §5) y en M1+ se va a ganar el lugar: las tablas de
 * ventas y stock necesitan ordenar y filtrar del lado del cliente. Las de M0 no
 * hacen ninguna de las dos cosas — los filtros de auditoría los resuelve `api/`
 * y la paginación es por cursor, también del servidor.
 *
 * Usarlo igual obligaría a marcar la tabla como Client Component y mandar la
 * librería al browser para renderizar celdas estáticas: más JavaScript, más
 * hidratación y ni una funcionalidad de más. Regla de oro del proyecto: de menos
 * a más.
 */

export function Tabla({ children }: { children: ReactNode }) {
  return (
    // `overflow-x-auto` para que en un teléfono la tabla scrollee sola en vez
    // de estirar la página entera (mobile-first).
    <div className="overflow-x-auto rounded-lg border border-sutil">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Encabezados({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-fondo text-left text-xs uppercase tracking-wide text-secundario">
      <tr>{children}</tr>
    </thead>
  )
}

export function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-3 py-2 font-medium">{children}</th>
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-t border-sutil px-3 py-2 align-top ${className}`}>{children}</td>
}

/** Fila única que ocupa toda la tabla cuando no hay datos que mostrar. */
export function SinResultados({ columnas, children }: { columnas: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columnas} className="border-t border-sutil px-3 py-8 text-center text-tenue">
        {children}
      </td>
    </tr>
  )
}

/**
 * Etiqueta de estado.
 *
 * El color no es el único portador del significado: el texto dice lo mismo. Un
 * usuario con daltonismo no puede distinguir activo de inactivo por el punto.
 */
export function Etiqueta({ tono, children }: { tono: 'ok' | 'alerta' | 'neutro'; children: ReactNode }) {
  const estilos = {
    ok: 'bg-emerald-950 text-emerald-300 ring-emerald-900',
    alerta: 'bg-red-950 text-red-300 ring-red-900',
    neutro: 'bg-elevada text-secundario ring-sutil',
  } as const

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${estilos[tono]}`}
    >
      {children}
    </span>
  )
}
