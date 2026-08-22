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
    <thead className="aq-micro bg-fondo text-left text-secundario">
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
  /*
   * Los tres tonos salen de los tokens semánticos, no de la paleta de Tailwind.
   * Un `emerald-950` escrito acá no cambia con el tema y no comparte
   * significado con el resto del sistema: es un verde que se PARECE al de la
   * marca, y esa diferencia se nota cuando conviven en la misma pantalla.
   *
   * `ok` usa el verde RESERVADO. La regla dura del sistema de diseño es que ese
   * verde solo significa «todo en orden» — y acá lo significa: la acción estaba
   * autorizada y el sistema la dejó pasar.
   */
  const estilos = {
    ok: 'bg-exito-fondo text-exito-texto ring-exito-borde',
    alerta: 'bg-error-fondo text-error-texto ring-error-borde',
    neutro: 'bg-elevada text-secundario ring-sutil',
  } as const

  return (
    <span
      className={`aq-micro inline-flex items-center rounded-full px-2.5 py-1 ring-1 ring-inset ${estilos[tono]}`}
    >
      {children}
    </span>
  )
}
