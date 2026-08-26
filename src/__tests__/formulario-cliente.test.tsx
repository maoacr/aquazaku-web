import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EstadoDeFormulario } from '@/lib/formulario'
import { limpiezaKey, useAvisoDeExito, useLimpiezaAlRegistrar } from '@/lib/formulario-cliente'

/**
 * La plomería compartida de los formularios.
 *
 * Se prueba acá y no en cada pantalla porque ahora es UNA sola: estaba copiada
 * en dos archivos con dos formas distintas, y las copias que sobraban no eran
 * iguales entre sí.
 */

const avisarExito = vi.hoisted(() => vi.fn())
vi.mock('@/lib/avisos', () => ({ avisarExito, avisarAtencion: vi.fn() }))

beforeEach(() => {
  avisarExito.mockClear()
})

function Avisador({ estado }: { estado: EstadoDeFormulario }) {
  useAvisoDeExito(estado)
  return <p>listo</p>
}

describe('useAvisoDeExito', () => {
  it('avisa una vez por éxito', () => {
    render(<Avisador estado={{ ok: 'Entrada registrada.', token: 'a' }} />)

    expect(avisarExito).toHaveBeenCalledExactlyOnceWith('Entrada registrada.')
  })

  it('no avisa dos veces el mismo éxito aunque el componente se vuelva a pintar', () => {
    const estado = { ok: 'Entrada registrada.', token: 'a' }
    const { rerender } = render(<Avisador estado={estado} />)
    rerender(<Avisador estado={{ ...estado }} />)

    expect(avisarExito).toHaveBeenCalledTimes(1)
  })

  /**
   * ── Lo que de verdad protege el `ref` ───────────────────────────────────
   *
   * El repintado ya lo frenan las dependencias del efecto: con el mismo token
   * y el mismo mensaje, React no lo vuelve a correr. El caso que SÍ necesita
   * el ref es StrictMode, que monta, desmonta y vuelve a montar cada efecto —
   * y Next lo activa en desarrollo. Sin el ref, cada confirmación se ve doble
   * mientras se desarrolla, que es justo cuando se mira la pantalla.
   *
   * Este test existe porque el anterior pasaba igual con el ref borrado.
   */
  it('tampoco avisa dos veces bajo StrictMode, que monta el efecto dos veces', () => {
    render(
      <StrictMode>
        <Avisador estado={{ ok: 'Entrada registrada.', token: 'a' }} />
      </StrictMode>,
    )

    expect(avisarExito).toHaveBeenCalledTimes(1)
  })

  /**
   * ── Lo que justifica que exista el token ────────────────────────────────
   *
   * Dos entradas seguidas del mismo insumo dejan el mismo saldo, así que el
   * mensaje es idéntico. Anclado al TEXTO, el segundo registro no avisaría y
   * quien lo hizo no sabría si se envió.
   */
  it('avisa de nuevo cuando el mensaje se repite pero el token cambió', () => {
    const { rerender } = render(<Avisador estado={{ ok: 'Quedan 40 unidades.', token: 'a' }} />)
    rerender(<Avisador estado={{ ok: 'Quedan 40 unidades.', token: 'b' }} />)

    expect(avisarExito).toHaveBeenCalledTimes(2)
  })

  it('un error no es un toast: se queda junto al campo', () => {
    render(<Avisador estado={{ error: 'No alcanza: hay 3 unidades.' }} />)

    expect(avisarExito).not.toHaveBeenCalled()
  })
})

function Campo({ estado }: { estado: EstadoDeFormulario }) {
  const [valor, setValor] = useState('12')
  useLimpiezaAlRegistrar(estado.token, () => setValor(''))

  // Un input de verdad: el caso que importa es que la persona ESCRIBA después
  // de un éxito, y con un `<output>` no había forma de escribir.
  return (
    <input aria-label="cantidad" value={valor} onChange={(e) => setValor(e.target.value)} />
  )
}

const cantidad = () => screen.getByLabelText<HTMLInputElement>('cantidad')

describe('useLimpiezaAlRegistrar', () => {
  it('vacía el campo cuando la acción tuvo éxito', () => {
    const { rerender } = render(<Campo estado={{}} />)
    expect(cantidad().value).toBe('12')

    rerender(<Campo estado={{ ok: 'Registrado.', token: 'a' }} />)

    expect(cantidad().value).toBe('')
  })

  /**
   * Con error lo escrito se conserva. Hacer reescribir el motivo por un error
   * de cantidad castiga a quien ya pensó la explicación.
   */
  it('con error NO lo vacía', () => {
    const { rerender } = render(<Campo estado={{}} />)
    rerender(<Campo estado={{ error: 'No alcanza.' }} />)

    expect(cantidad().value).toBe('12')
  })

  /**
   * ── El caso que de verdad ejercita el guard ─────────────────────────────
   *
   * El test de arriba va de «sin token» a «sin token»: el estado nunca cambia,
   * así que pasa igual con el guard borrado. El que muerde es registrar bien y
   * que el SIGUIENTE envío falle — ahí el token vuelve a `undefined`, y sin el
   * guard se borraría lo que la persona acaba de escribir.
   */
  it('después de un éxito, un error posterior conserva lo escrito', async () => {
    // Arranca sin token: el hook limpia con el CAMBIO, no con el valor inicial
    // — un formulario que se monta con un token no debería borrar nada.
    const { rerender } = render(<Campo estado={{}} />)
    rerender(<Campo estado={{ ok: 'Registrado.', token: 'a' }} />)
    expect(cantidad().value).toBe('')

    // La persona vuelve a escribir…
    await userEvent.type(cantidad(), '40')
    expect(cantidad().value).toBe('40')

    // …y el siguiente envío falla: el token vuelve a `undefined`.
    rerender(<Campo estado={{ error: 'No alcanza: hay 3 unidades.' }} />)

    expect(cantidad().value).toBe('40')
  })
})

describe('limpiezaKey', () => {
  it('cambia con el token, para que el campo se remonte', () => {
    expect(limpiezaKey({ token: 'a' }, 'cantidad')).not.toBe(
      limpiezaKey({ token: 'b' }, 'cantidad'),
    )
  })

  /**
   * Estas claves se aplican a elementos HERMANOS. Repetirlas entre campos
   * dispara «two children with the same key» y el formulario se rompe de
   * formas que no se explican solas.
   */
  it('dos campos distintos del mismo envío NO comparten clave', () => {
    const estado = { token: 'a' }

    expect(limpiezaKey(estado, 'cantidad')).not.toBe(limpiezaKey(estado, 'motivo'))
  })
})
