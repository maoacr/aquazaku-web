import { describe, expect, it } from 'vitest'
import { ALL_MODULES, computeVisibleModules } from '@/lib/modules'
import type { Role } from '@/lib/roles'

describe('computeVisibleModules()', () => {
  it('admin ve usuarios, auditoría y productos', () => {
    const ids = computeVisibleModules(['admin']).map((m) => m.id)

    expect(ids).toContain('usuarios')
    expect(ids).toContain('auditoria')
    expect(ids).toContain('productos')
  })

  it('contador ve catálogo, stock y la auditoría', () => {
    const ids = computeVisibleModules(['contador']).map((m) => m.id)

    // Necesita el inventario para cerrar los números, no solo la bitácora.
    // La auditoría es la MISMA que ve el admin: qué filas trae cada uno lo
    // decide `api/` según la sesión, no la ruta por la que se entró.
    expect(ids).toEqual(['productos', 'stock', 'insumos', 'auditoria'])
  })

  /**
   * Hasta M0 estos dos roles no veían ningún módulo. M1 les dio el catálogo
   * (RN-CAT-06) y M2 el stock: quien vende necesita saber qué hay.
   *
   * M3 los SEPARA. El `pos` ve insumos porque es quien produce —sin tapas no se
   * envasa— y el `seller` no: contacta clientes y registra ventas, no toca la
   * planta. Es la primera vez que estos dos roles dejan de ver lo mismo, así
   * que el test deja de ser compartido.
   */
  it('el seller ve catálogo y stock, y nada de la planta', () => {
    expect(computeVisibleModules(['seller']).map((m) => m.id)).toEqual(['productos', 'stock'])
  })

  it('el pos ve además los insumos: es quien produce', () => {
    expect(computeVisibleModules(['pos']).map((m) => m.id)).toEqual([
      'productos',
      'stock',
      'insumos',
    ])
  })

  /**
   * Este test afirmaba que el catálogo era el ÚNICO módulo universal, y era
   * cierto en M1. M2 sumó el stock.
   *
   * Se reescribe como lista para que crezca a conciencia: agregar un módulo que
   * vean los cuatro roles obliga a tocar acá y decir por qué.
   */
  it('los módulos que ven los cuatro roles son catálogo y stock', () => {
    const paraTodos = ALL_MODULES.filter((m) =>
      (['admin', 'seller', 'pos', 'contador'] as Role[]).every((rol) => m.roles.includes(rol)),
    )

    expect(paraTodos.map((m) => m.id)).toEqual(['productos', 'stock'])
  })

  it('sin roles no ve nada', () => {
    expect(computeVisibleModules([])).toEqual([])
  })

  /**
   * RN-ACC-01: no existe switch-role. Todos los roles asignados están activos a
   * la vez, así que el menú es la UNIÓN — nunca la intersección ni «el primero».
   *
   * Este test afirmaba que la unión incluía `auditoria` Y `contador-auditoria`,
   * o sea que codificaba el duplicado como correcto. El test que tenía que
   * atrapar el defecto lo estaba sosteniendo, y por eso pasó desapercibido
   * hasta que alguien miró el menú.
   *
   * La unión sigue siendo la unión. Lo que cambió es que la auditoría es UNA
   * capacidad, así que unirla consigo misma da una sola entrada.
   */
  it('multi-rol ve la unión de los módulos de todos sus roles', () => {
    const ids = computeVisibleModules(['admin', 'contador']).map((m) => m.id)

    expect(ids).toEqual(['productos', 'stock', 'insumos', 'usuarios', 'auditoria'])
  })

  it('multi-rol no duplica un módulo que dos roles comparten', () => {
    const ids = computeVisibleModules(['admin', 'admin' as Role]).map((m) => m.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('el orden de los roles no cambia el resultado', () => {
    const directo = computeVisibleModules(['admin', 'contador']).map((m) => m.id)
    const invertido = computeVisibleModules(['contador', 'admin']).map((m) => m.id)

    expect(invertido).toEqual(directo)
  })

  it('no muta ALL_MODULES', () => {
    const antes = ALL_MODULES.length
    computeVisibleModules(['admin', 'contador', 'pos', 'seller'])

    expect(ALL_MODULES.length).toBe(antes)
  })

  // La UI oculta, la API prohíbe (RN-ACC-02). Este test no valida seguridad
  // —eso vive en api/— pero sí que el menú no invente un módulo sin dueño.
  it('todo módulo declara al menos un rol que lo puede ver', () => {
    for (const modulo of ALL_MODULES) {
      expect(modulo.roles.length).toBeGreaterThan(0)
    }
  })
})

/**
 * ── Una capacidad, una entrada ──────────────────────────────────────────────
 *
 * `auditoria` estuvo registrado dos veces —admin y contador— con dos rutas que
 * renderizaban exactamente el mismo componente. Quien tenía los dos roles veía
 * «Auditoría» dos veces en el menú, sin forma de saber en qué se diferenciaban:
 * en nada.
 *
 * La tentación era filtrar por precedencia —«si es admin, escondé el de
 * contador»—, y habría sido peor. Los roles se SUMAN (RN-ACC-01): meter
 * precedencia contradice el modelo, y encima solo arregla este par. El próximo
 * par que comparta una capacidad necesitaría su propia excepción.
 *
 * Estos dos tests cierran la clase entera: si dos módulos comparten etiqueta o
 * ruta, es la misma capacidad registrada dos veces y hay que unirla.
 */
describe('el catálogo no registra la misma capacidad dos veces', () => {
  it('ninguna etiqueta se repite', () => {
    const vistas = new Map<string, string[]>()

    for (const modulo of ALL_MODULES) {
      vistas.set(modulo.label, [...(vistas.get(modulo.label) ?? []), modulo.id])
    }

    const repetidas = [...vistas].filter(([, ids]) => ids.length > 1)

    expect(
      repetidas.map(([label, ids]) => `«${label}» en ${ids.join(' y ')}`),
      'dos entradas con la misma etiqueta son indistinguibles en el menú',
    ).toEqual([])
  })

  it('ninguna ruta se repite', () => {
    const hrefs = ALL_MODULES.map((m) => m.href)

    expect(new Set(hrefs).size, `rutas duplicadas en ${hrefs.join(', ')}`).toBe(hrefs.length)
  })

  /**
   * El caso concreto que se reportó, con los roles reales.
   *
   * Vale además del test de etiquetas únicas: aquel mira el catálogo, y este
   * mira lo que sale del cálculo. Si alguien volviera a introducir el filtro por
   * precedencia, el de etiquetas seguiría pasando y este seguiría diciendo la
   * verdad sobre la pantalla.
   */
  it('admin + contador ven una sola Auditoría', () => {
    const visibles = computeVisibleModules(['admin', 'contador'])
    const auditorias = visibles.filter((m) => m.label === 'Auditoría')

    expect(auditorias).toHaveLength(1)
  })

  /**
   * Y la unión sigue siendo una unión: unificar no puede haberle sacado la
   * auditoría a nadie que la tenía.
   */
  it('cada rol que la veía la sigue viendo por su cuenta', () => {
    for (const rol of ['admin', 'contador'] as const) {
      expect(
        computeVisibleModules([rol]).some((m) => m.label === 'Auditoría'),
        `${rol} perdió el acceso a la auditoría`,
      ).toBe(true)
    }

    for (const rol of ['seller', 'pos'] as const) {
      expect(
        computeVisibleModules([rol]).some((m) => m.label === 'Auditoría'),
        `${rol} no debería ver la auditoría`,
      ).toBe(false)
    }
  })
})
