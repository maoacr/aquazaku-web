import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FiltrosDeAuditoria } from '@/components/auditoria/filtros-de-auditoria'

/**
 * Los filtros de la bitácora.
 *
 * ── Por qué dejaron de ser texto libre ──────────────────────────────────────
 *
 * El filtro de `action` en `api/` es coincidencia EXACTA. Con un `<input>`,
 * `ventas:anular ` con un espacio al final devolvía cero filas, y cero filas
 * por un typo se ve idéntico a cero filas porque no pasó nada. En la pantalla
 * cuyo único trabajo es encontrar lo que alguien hizo, eso es lo peor que puede
 * fallar: el log parece limpio justo cuando no lo está.
 *
 * ── Y por qué en dos pasos ──────────────────────────────────────────────────
 *
 * Son más de setenta acciones. Encadenar el segundo desplegable al primero es
 * la diferencia entre elegir entre siete y scrollear entre setenta.
 */

const elegir = (etiqueta: string) => screen.getByRole('combobox', { name: etiqueta })

function pintar(filtros: Record<string, string> = {}) {
  return render(<FiltrosDeAuditoria filtros={filtros} ruta="/modulos/auditoria" />)
}

describe('el desplegable de acción depende del módulo', () => {
  it('sin módulo elegido está deshabilitado y lo dice', () => {
    pintar()

    const accion = elegir('Acción')

    expect(accion).toBeDisabled()
    expect(accion).toHaveTextContent('Primero escoja un módulo')
  })

  it('al elegir un módulo ofrece solo las acciones de ese módulo', async () => {
    pintar()

    await userEvent.selectOptions(elegir('Módulo'), 'ventas')

    const opciones = Array.from(elegir('Acción').querySelectorAll('option')).map((o) => o.value)

    expect(elegir('Acción')).toBeEnabled()
    expect(opciones).toContain('ventas:anular')
    expect(opciones).toContain('ventas:precio_manual')
    // La prueba de que está ACOTADO, no solo poblado: sin esto, un desplegable
    // con las setenta acciones pasaría este test igual.
    expect(opciones).not.toContain('clientes:crear')
    expect(opciones).not.toContain('stock:ajustar')
  })

  /*
   * Ojo con lo que este test NO prueba.
   *
   * El componente hace `setAccion('')` al cambiar de módulo, y quitarlo no
   * rompe nada: como las opciones del segundo desplegable se reemplazan, la
   * vieja deja de existir en el DOM y el `<select>` cae a `''` por su cuenta.
   * Se comprobó por ablación.
   *
   * El `setAccion('')` se queda igual, porque sin él el estado de React sigue
   * diciendo `ventas:anular` mientras el DOM dice `''` — invisible hoy, trampa
   * para el que agregue el próximo campo que lea ese estado.
   *
   * Lo que sí se vigila acá es lo que le llega al servidor, que es lo que el
   * usuario sufre: un par `resource=clientes&action=ventas:anular` devuelve
   * tabla vacía sin nada en pantalla que explique por qué.
   */
  it('cambiar de módulo no deja viajando la acción del módulo anterior', async () => {
    const { container } = pintar()

    await userEvent.selectOptions(elegir('Módulo'), 'ventas')
    await userEvent.selectOptions(elegir('Acción'), 'ventas:anular')
    expect(elegir('Acción')).toHaveValue('ventas:anular')

    await userEvent.selectOptions(elegir('Módulo'), 'clientes')

    expect(elegir('Acción')).toHaveValue('')

    const datos = new FormData(container.querySelector('form')!)
    expect(datos.get('resource')).toBe('clientes')
    expect(datos.get('action')).toBe('')
  })
})

describe('un link compartido abre con los desplegables puestos', () => {
  it('deduce el módulo cuando la URL solo trae la acción', () => {
    pintar({ action: 'botellones:descartar' })

    expect(elegir('Módulo')).toHaveValue('botellones')
    expect(elegir('Acción')).toHaveValue('botellones:descartar')
  })

  it('respeta el módulo explícito de la URL', () => {
    pintar({ resource: 'stock' })

    expect(elegir('Módulo')).toHaveValue('stock')
    expect(elegir('Acción')).toBeEnabled()
    expect(elegir('Acción')).toHaveValue('')
  })
})

describe('lo que viaja al servidor', () => {
  it('los campos llevan los nombres que espera `GET /audit`', async () => {
    const { container } = pintar()

    await userEvent.selectOptions(elegir('Módulo'), 'ventas')
    await userEvent.selectOptions(elegir('Acción'), 'ventas:crear')

    const form = container.querySelector('form')!
    const datos = new FormData(form)

    /*
     * Con acción escogida viaja SOLO la acción.
     *
     * `ventas:crear` ya dice que el módulo es ventas, y la API combina los dos
     * filtros con AND: basta una fila donde el `resource` guardado no sea el
     * prefijo del `action` para que la consulta devuelva cero. Ya pasó con
     * `configuracion:editar`, que `alertas` escribía con `resource:
     * 'parametros'`. Esas filas viejas no se pueden corregir —la tabla es
     * append-only— así que el filtro se hace robusto desde acá.
     */
    expect(datos.get('resource')).toBeNull()
    expect(datos.get('action')).toBe('ventas:crear')
    // Navega por GET: los filtros quedan en la URL y el «volver» funciona.
    expect(form.getAttribute('method')).toBe('get')
  })

  it('sin acción escogida sí manda el módulo, que es el único filtro que queda', async () => {
    const { container } = pintar()

    await userEvent.selectOptions(elegir('Módulo'), 'clientes')

    const datos = new FormData(container.querySelector('form')!)

    expect(datos.get('resource')).toBe('clientes')
    expect(datos.get('action')).toBe('')
  })

  it('no quedan inputs de texto donde el usuario pueda escribir un filtro', () => {
    const { container } = pintar()

    const libres = Array.from(container.querySelectorAll('input')).filter(
      (i) => i.type !== 'date' && i.type !== 'hidden',
    )

    expect(libres).toEqual([])
  })
})
