import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Encabezados, Tabla, Td, Th } from '@/components/ui/tabla'

/**
 * La columna que ancla la fila en un teléfono.
 *
 * En mobile la auditoría es una tabla de 1.099 px dentro de una caja de 351:
 * scrollear para leer «Detalle» dejaba la fecha en x = −736, y con ella el ancla
 * de qué fila se estaba leyendo.
 */

const globales = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8')

describe('la marca de columna fija', () => {
  it('solo la lleva la columna marcada', () => {
    const { container } = render(
      <Tabla>
        <Encabezados>
          <Th fija>Fecha</Th>
          <Th>Detalle</Th>
        </Encabezados>
        <tbody>
          <tr>
            <Td fija>26/08</Td>
            <Td>lo que pasó</Td>
          </tr>
        </tbody>
      </Tabla>,
    )

    const fijas = container.querySelectorAll('.aq-tabla-columna-fija')

    expect(fijas).toHaveLength(2)
    expect([...fijas].map((c) => c.textContent)).toEqual(['Fecha', '26/08'])
  })

  it('sin la marca, una tabla angosta no arrastra el canto ni el desenfoque', () => {
    const { container } = render(
      <Tabla>
        <Encabezados>
          <Th>Código</Th>
        </Encabezados>
        <tbody>
          <tr>
            <Td>BOT_20L</Td>
          </tr>
        </tbody>
      </Tabla>,
    )

    expect(container.querySelectorAll('.aq-tabla-columna-fija')).toHaveLength(0)
  })

  /**
   * ── Lo que jsdom no puede probar y este archivo sí ────────────────────────
   *
   * Un `@media` no se evalúa en jsdom, así que el comportamiento por ancho no
   * se puede verificar renderizando. Se verifica leyendo el CSS.
   *
   * Vale la pena porque el olvido es silencioso: sin la regla de escritorio, la
   * columna queda pegada también en pantalla ancha, donde la tabla entra entera
   * — un canto y un desenfoque que no anclan nada, y que nadie relaciona con
   * esta clase.
   *
   * Es el mismo tipo de guardia que ya protege la cascada del armazón.
   */
  it('en escritorio se apaga: ahí la tabla entra entera', () => {
    const reglas = globales.slice(globales.indexOf('.aq-tabla-columna-fija'))
    const escritorio = reglas.slice(reglas.indexOf('@media (min-width: 768px)'))

    expect(escritorio).toContain('position: static')
    expect(escritorio).toContain('backdrop-filter: none')
    expect(escritorio).toContain('background: transparent')
  })

  /**
   * El desenfoque acá NO es decoración: el sistema lo sacó de las tarjetas
   * porque costaba 17 fps y detrás había un gradiente —desenfocar algo borroso
   * da lo mismo borroso—. La regla que quedó es que aporta solo cuando detrás
   * pasa contenido con detalle, y por debajo de esta columna pasa el texto de
   * las otras. Sin él se leerían dos textos encima.
   */
  it('lleva desenfoque, que es lo que impide leer dos textos encima', () => {
    const regla = globales.slice(
      globales.indexOf('.aq-tabla-columna-fija {'),
      globales.indexOf('.aq-tabla-encabezado .aq-tabla-columna-fija'),
    )

    expect(regla).toContain('backdrop-filter: blur(')
    expect(regla).toContain('position: sticky')
    expect(regla).toContain('left: 0')
  })
})
