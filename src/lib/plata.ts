/**
 * Cómo se escribe y cómo se suma un peso.
 *
 * ── Por qué vive en `lib/` y no en un componente ────────────────────────────
 *
 * `pesos` nació adentro de `components/productos/tabla-productos.tsx` y se
 * exportaba desde ahí. Mientras lo usaba una sola pantalla no molestaba; en
 * cuanto el tablero lo necesitó, importar de `components/` hacia `lib/`
 * invertía las capas y habría arrastrado una tabla de productos al bundle de
 * cualquier módulo que solo quería formatear un monto.
 *
 * ── Los montos de `api/` son STRINGS, y es a propósito ──────────────────────
 *
 * `numeric(12,2)` de Postgres viaja como `'12000.50'`. Convertirlo a `number`
 * para guardarlo o reenviarlo pierde centavos; `Number('12000.50') * 3` ya
 * acumula error de coma flotante. Aquí se convierte **solo para mostrar**, y
 * para sumar se pasa por centavos enteros — la misma regla que `aCentavos` /
 * `aMonto` en `api/src/modules/ventas/precio.ts`.
 */

/**
 * Un monto completo: `$12.000`.
 *
 * Sin decimales: en Colombia el centavo no circula, y dos decimales en una
 * columna de montos son dos dígitos de ruido en cada fila.
 */
export function pesos(monto: string | number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(monto))
}

/**
 * Un monto corto, para ejes y rótulos: `$1,3 M`, `$820 k`.
 *
 * ── Por qué hace falta ──────────────────────────────────────────────────────
 *
 * Un eje vertical con `$1.620.000` en cada marca se come sesenta píxeles de
 * ancho, y en un teléfono eso es un quinto de la pantalla. El número completo
 * vive en el tooltip, que es donde alguien lo va a leer de verdad.
 *
 * El separador decimal es coma porque es español: `$1,3 M`, no `$1.3 M`.
 */
export function pesosCortos(monto: string | number): string {
  const n = Number(monto)

  if (!Number.isFinite(n)) return '—'

  const abs = Math.abs(n)
  const signo = n < 0 ? '−' : ''

  if (abs >= 1_000_000) return `${signo}$${decimal(abs / 1_000_000)} M`
  if (abs >= 1_000) return `${signo}$${decimal(abs / 1_000)} k`

  return `${signo}$${Math.round(abs)}`
}

/** Un decimal, y sin el `,0` cuando es redondo: `1,3` pero `2` y no `2,0`. */
function decimal(n: number): string {
  return (Math.round(n * 10) / 10).toString().replace('.', ',')
}

/**
 * Un monto string a centavos enteros.
 *
 * Gemelo de `aCentavos` en `api/src/modules/ventas/precio.ts`. Toda suma de
 * plata pasa por aquí: sumar `Number('12000.50')` treinta veces acumula un
 * descuadre de centavos que después nadie puede explicar.
 *
 * `Math.round` y no `|0`: `12000.50 * 100` da `1200049.999…` en coma flotante,
 * y truncar perdería el centavo que esto viene a cuidar.
 */
export function aCentavos(monto: string | number): number {
  const n = Number(monto)

  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Centavos enteros de vuelta a `'12000.50'`. Gemelo de `aMonto` en `api/`. */
export function aMonto(centavos: number): string {
  return (centavos / 100).toFixed(2)
}
