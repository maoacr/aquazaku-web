import { describe, expect, it } from 'vitest'
import {
  ZONA_DE_LA_PLANTA,
  fechaEnLaPlanta,
  fechaYHoraEnLaPlanta,
  horaEnLaPlanta,
} from '@/lib/hora-de-la-planta'

/**
 * La hora de Aquazaku es la hora de Campo de la Cruz — el gemelo de `dia.ts`.
 *
 * ── El bug que esto evita ───────────────────────────────────────────────────
 *
 * `toLocaleString('es-CO')` sin `timeZone` usa la zona del PROCESO. En un
 * Server Component eso es el proceso de Node, y el contenedor corre en UTC
 * porque el docker-compose no define `TZ`:
 *
 * | Venta del 31-ago a las 19:30 en la planta | Se muestra |
 * | --- | --- |
 * | Proceso en `America/Bogota` (una Mac) | 31/08/26, 7:30 p. m. ✓ |
 * | Proceso en UTC (el contenedor)        | **1/09/26, 12:30 a. m.** ✗ |
 *
 * Colombia es UTC−5: todo lo que pasa después de las 19:00 se muestra con el
 * día siguiente. No es la hora corrida — es la FECHA equivocada, en la lista de
 * ventas que alguien usa para saber qué se vendió ayer.
 *
 * Es el mismo bug que `api/src/lib/dia.ts` resolvió para las agregaciones SQL,
 * en la capa que quedó sin cubrir: la presentación.
 *
 * ── Por qué los tests fijan la zona del proceso en UTC ──────────────────────
 *
 * Porque reproducen PRODUCCIÓN. Corriendo en una Mac colombiana, un formateo
 * sin `timeZone` da el resultado correcto por accidente y el test no vigila
 * nada. Es la misma razón por la que `dia.test.ts` pone la sesión de Postgres
 * en UTC.
 */

/** 31 de agosto, 19:30 en la planta. En UTC ya es el 1 de septiembre. */
const CAE_EN_OTRO_DIA = new Date('2026-08-31T19:30:00-05:00')

describe('el proceso de este test corre en UTC, como el contenedor', () => {
  it('si no, el test no vigila nada', () => {
    expect(process.env.TZ).toBe('UTC')
    expect(new Date().getTimezoneOffset()).toBe(0)
  })
})

describe('la zona se declara una sola vez', () => {
  it('es la misma que la de api/', () => {
    expect(ZONA_DE_LA_PLANTA).toBe('America/Bogota')
  })
})

describe('fecha y hora juntas', () => {
  it('una venta de las 19:30 se muestra el día que fue, no el siguiente', () => {
    const texto = fechaYHoraEnLaPlanta(CAE_EN_OTRO_DIA)

    expect(texto).toMatch(/31\/08\/26/)
    expect(texto).not.toMatch(/01\/09|1\/09/)
  })

  it('la hora es la de la planta, no la del proceso', () => {
    expect(fechaYHoraEnLaPlanta(CAE_EN_OTRO_DIA)).toMatch(/7:30/)
  })

  /** Lo que llega de `api/` es un string ISO, no un Date. Los dos tienen que servir. */
  it('acepta el string ISO que manda api/', () => {
    expect(fechaYHoraEnLaPlanta('2026-08-31T19:30:00-05:00')).toBe(
      fechaYHoraEnLaPlanta(CAE_EN_OTRO_DIA),
    )
  })
})

describe('solo la fecha', () => {
  it('el día es el de la planta', () => {
    expect(fechaEnLaPlanta(CAE_EN_OTRO_DIA)).toMatch(/31\/08\/26/)
  })

  it('no arrastra la hora', () => {
    expect(fechaEnLaPlanta(CAE_EN_OTRO_DIA)).not.toMatch(/:/)
  })
})

describe('solo la hora', () => {
  it('es la de la planta', () => {
    expect(horaEnLaPlanta(CAE_EN_OTRO_DIA)).toMatch(/7:30/)
  })

  it('no arrastra la fecha', () => {
    expect(horaEnLaPlanta(CAE_EN_OTRO_DIA)).not.toMatch(/\d{2}\/\d{2}/)
  })
})

/**
 * El mediodía no distingue nada: a las 12:00 de Bogotá son las 17:00 UTC, mismo
 * día en las dos zonas. Un test que solo usara esa hora pasaría con el bug
 * puesto. Estas son las horas donde las dos zonas discrepan.
 */
describe('las horas donde el bug se ve', () => {
  it.each([
    ['19:00 — el primer minuto que cruza', '2026-08-31T19:00:00-05:00', '31/08/26'],
    ['23:59 — el último del mes', '2026-08-31T23:59:00-05:00', '31/08/26'],
    ['00:01 — recién pasada la medianoche', '2026-09-01T00:01:00-05:00', '1/09/26'],
  ])('%s', (_caso, iso, diaEsperado) => {
    expect(fechaEnLaPlanta(iso)).toBe(diaEsperado)
  })
})

/**
 * `hoyEnLaPlanta` sale contra el `value` de un `<input type="date">`, que es
 * ISO. Si devolviera el formato que se lee, toda venta de hoy viajaría marcada
 * como retroactiva.
 */
describe('qué día es hoy en la planta', () => {
  it('viene en AAAA-MM-DD, como el input de fecha', async () => {
    const { hoyEnLaPlanta } = await import('@/lib/hora-de-la-planta')

    expect(hoyEnLaPlanta()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  /** El proceso de este test corre en UTC: si usara su reloj, a la noche erraría el día. */
  it('usa la zona de la planta y no la del proceso', async () => {
    const { hoyEnLaPlanta } = await import('@/lib/hora-de-la-planta')
    const enLaPlanta = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
    }).format(new Date())

    expect(hoyEnLaPlanta()).toBe(enLaPlanta)
  })
})
