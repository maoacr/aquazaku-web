import { describe, expect, it } from 'vitest'
import type { TipoDeBase } from '@/lib/api-types'
import { DIAS_MAXIMOS_HACIA_ATRAS } from '@/components/ventas/mostrador'
import { LARGO_MINIMO_MOTIVO } from '@/lib/motivos'

/**
 * Los dos números que `api/` también tiene — y el aviso cuando cambian.
 *
 * ── Por qué están copiados ──────────────────────────────────────────────────
 *
 * Esta pantalla los necesita para avisar qué falta **antes** de mandar el
 * formulario: cuántos caracteres le faltan al motivo, y hasta qué fecha deja
 * elegir el calendario. Los dos repos son independientes y no hay paquete
 * común que los ate. Quien decide sigue siendo `api/`; esto solo evita un
 * viaje que ya sabemos que va a volver con un 422.
 *
 * ── Por qué este test ───────────────────────────────────────────────────────
 *
 * El problema de una copia no es tenerla: es que nadie se entere cuando una de
 * las dos cambia. Si `api/` sube el mínimo del motivo a 15 y acá queda en 10,
 * la pantalla dice «ya alcanza» y el servidor responde un 422 que nadie
 * entiende — y quien lo lee culpa al formulario, no al número.
 *
 * El espejo de este archivo es `api/src/lib/__tests__/constantes-espejo.test.ts`.
 * Si tocás uno, tocá el otro.
 *
 * Es el mismo mecanismo que ya ataba la vista previa del cierre de producción
 * con su cálculo en `api/` (ver `produccion-vista-previa.test.ts`): nada puede
 * importar entre repos, así que lo que los une es que los dos tests fijan los
 * mismos valores.
 */

describe('las constantes que `api/` también define', () => {
  it('el mínimo de un motivo escrito a mano son 10 caracteres', () => {
    expect(
      LARGO_MINIMO_MOTIVO,
      'si cambiás esto, cambiá `LARGO_MINIMO_MOTIVO` en `api/src/lib/motivos.ts`, que es quien rechaza',
    ).toBe(10)
  })

  it('una venta se puede registrar hasta 90 días hacia atrás', () => {
    expect(
      DIAS_MAXIMOS_HACIA_ATRAS,
      'si cambiás esto, cambiá `DIAS_MAXIMOS_HACIA_ATRAS` en `api/src/modules/ventas/venta.ts`, que es quien rechaza',
    ).toBe(90)
  })

  /**
   * RN-BAS-14. Los tipos de base que existen.
   *
   * No es un número y se rompe igual. El tipo **no tiene valor por omisión** en
   * ninguna capa —ni en la base, ni en el servicio, ni en el formulario— así
   * que esta lista es lo único que decide qué puede elegir quien registra una
   * base. Si `api/` agrega un tercer tipo y acá no está, ese tipo queda
   * imposible de registrar desde la pantalla, y no falla nada: no aparece.
   *
   * El espejo es `api/src/lib/__tests__/constantes-espejo.test.ts`, que fija la
   * misma lista contra el enum `tipo_de_base` de la base.
   */
  it('hay dos tipos de base: estructura y dispensador', () => {
    const tipos: TipoDeBase[] = ['estructura', 'dispensador']

    expect(
      tipos,
      'si `api/` agrega un tipo de base, agregalo acá, en `TipoDeBase` y en el desplegable de `src/components/retornables/bases.tsx`',
    ).toEqual(['estructura', 'dispensador'])
  })
})
