/**
 * R49 · La carga muestra la forma de lo que viene.
 *
 * ```
 * dado    una pantalla cargando
 * entonces se dibuja el esqueleto de SU contenido
 * y        nunca un spinner de pantalla completa
 * ```
 *
 * ── Por qué no un spinner ───────────────────────────────────────────────────
 *
 * Un spinner dice «esperá» y nada más. Un esqueleto que copia la grilla real
 * dice «esperá, y va a aparecer una tabla de cuatro columnas acá». El ojo
 * empieza a ubicarse antes de que lleguen los datos, y cuando llegan no hay
 * salto: lo que estaba dibujado se rellena.
 *
 * Ese salto tiene nombre y costo — es el mismo *layout shift* que se mide en
 * Core Web Vitals— y en un punto de venta se paga en clics equivocados: alguien
 * apunta a un botón que todavía no está donde va a estar.
 *
 * ── Por qué `aria-hidden` y no un texto de carga ────────────────────────────
 *
 * El esqueleto es puro andamio visual: no hay nada que leerle a nadie. Quien usa
 * lector de pantalla se entera por el `aria-busy` de la región que lo contiene,
 * no por doce rectángulos anunciados uno por uno.
 */
export function Esqueleto({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      // `aq-pulse` ya está en el sistema. `motion-reduce` lo apaga: una
      // animación que late sin parar es exactamente lo que molesta a quien pidió
      // menos movimiento, y el esqueleto se entiende igual quieto.
      className={`block rounded bg-elevada [animation:aq-pulse_1.6s_ease-in-out_infinite] motion-reduce:animate-none ${className}`}
    />
  )
}

/**
 * El esqueleto de una tabla, con SU cantidad de columnas y filas.
 *
 * Los dos parámetros son obligatorios a propósito: un esqueleto genérico de
 * «tres columnas» delante de una tabla de siete vuelve a producir el salto que
 * R49 quiere evitar. Quien lo usa ya sabe cuántas tiene su tabla.
 */
export function EsqueletoDeTabla({
  columnas,
  filas = 5,
  anchos,
}: {
  columnas: number
  filas?: number
  /**
   * Anchos por columna, en fracciones de Tailwind (`w-24`, `w-full`…).
   *
   * Sin esto todas las celdas miden lo mismo y el esqueleto se lee como una
   * grilla de ladrillos, que no se parece a ninguna tabla real: en una tabla
   * las columnas son desparejas — un código es corto y un nombre es largo.
   */
  anchos?: string[]
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      // El texto para lector de pantalla va acá, UNA vez, en vez de en cada
      // rectángulo.
      aria-label="Cargando"
      className="overflow-hidden rounded-lg border border-sutil bg-tarjeta"
    >
      <div className="border-b border-sutil px-4 py-3">
        <Esqueleto className="h-3 w-24" />
      </div>

      {Array.from({ length: filas }, (_, fila) => (
        <div key={fila} className="flex items-center gap-4 border-t border-sutil px-4 py-4">
          {Array.from({ length: columnas }, (_, columna) => (
            <Esqueleto
              key={columna}
              className={`h-4 ${anchos?.[columna] ?? (columna === 0 ? 'w-40' : 'w-20')}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * El esqueleto de una pantalla: su título, su bajada y su contenido.
 *
 * Todas las pantallas de la app arrancan igual —un `h1` y un párrafo—, así que
 * esa parte se dibuja acá y cada `loading.tsx` solo describe lo suyo.
 */
export function EsqueletoDePantalla({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Esqueleto className="h-8 w-56" />
        <Esqueleto className="h-4 w-96 max-w-full" />
      </div>
      {children}
    </div>
  )
}
