import { describe, expect, it } from 'vitest'
import { ALL_MODULES, computeVisibleModules } from '@/lib/modules'
import type { Role } from '@/lib/roles'

describe('computeVisibleModules()', () => {
  it('admin ve usuarios y auditoría', () => {
    const ids = computeVisibleModules(['admin']).map((m) => m.id)

    expect(ids).toContain('usuarios')
    expect(ids).toContain('auditoria')
  })

  it('contador ve solo su propia auditoría', () => {
    const ids = computeVisibleModules(['contador']).map((m) => m.id)

    expect(ids).toEqual(['contador-auditoria'])
  })

  it('pos no ve ningún módulo de M0', () => {
    expect(computeVisibleModules(['pos'])).toEqual([])
  })

  it('seller no ve ningún módulo de M0', () => {
    expect(computeVisibleModules(['seller'])).toEqual([])
  })

  it('sin roles no ve nada', () => {
    expect(computeVisibleModules([])).toEqual([])
  })

  // RN-ACC-01: no existe switch-role. Todos los roles asignados están activos
  // a la vez, así que el menú es la UNIÓN — nunca la intersección ni "el primero".
  it('multi-rol ve la unión de los módulos de todos sus roles', () => {
    const ids = computeVisibleModules(['admin', 'contador']).map((m) => m.id)

    expect(ids).toEqual(['usuarios', 'auditoria', 'contador-auditoria'])
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
