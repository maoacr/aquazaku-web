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

  it('contador ve catálogo, stock y su auditoría', () => {
    const ids = computeVisibleModules(['contador']).map((m) => m.id)

    // Necesita el inventario para cerrar los números, no solo la bitácora.
    expect(ids).toEqual(['productos', 'stock', 'contador-auditoria'])
  })

  // Hasta M0 estos dos roles no veían ningún módulo. M1 les dio el catálogo
  // (RN-CAT-06) y M2 el stock: quien vende necesita saber qué hay.
  it.each(['pos', 'seller'] as const)('%s ve catálogo y stock', (rol) => {
    expect(computeVisibleModules([rol]).map((m) => m.id)).toEqual(['productos', 'stock'])
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

  // RN-ACC-01: no existe switch-role. Todos los roles asignados están activos
  // a la vez, así que el menú es la UNIÓN — nunca la intersección ni "el primero".
  it('multi-rol ve la unión de los módulos de todos sus roles', () => {
    const ids = computeVisibleModules(['admin', 'contador']).map((m) => m.id)

    expect(ids).toEqual(['productos', 'stock', 'usuarios', 'auditoria', 'contador-auditoria'])
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
