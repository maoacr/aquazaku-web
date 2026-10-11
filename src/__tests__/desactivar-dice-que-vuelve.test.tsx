import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CambiarEstado } from '@/components/clientes/acciones-de-cliente'
import type { FichaDeCliente } from '@/lib/api-types'

vi.mock('@/app/(app)/modulos/clientes/actions', () => ({
  agregarDireccionAction: vi.fn(),
  agregarTelefonoAction: vi.fn(),
  cambiarEstadoAction: vi.fn(),
  configurarCreditoAction: vi.fn(),
  desactivarClienteAction: vi.fn(),
  desactivarTelefonoAction: vi.fn(),
  verificarDocumentoAction: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

/**
 * Lo que la desactivación dice que va a mover — RN-CLI-06 y RN-BAS-04.
 *
 * ── Por qué este archivo existe ─────────────────────────────────────────────
 *
 * Este modal decía «este cliente no tiene bases ni botellones a su nombre»
 * SIEMPRE, incluso con dos bases prestadas y tres botellones en su poder. Lo
 * decía justo antes de confirmar una acción irreversible que los devuelve al
 * parque.
 *
 * La causa estaba en `api/`: `GET /clientes/:id` mandaba los saldos en `null`
 * fijo, y el componente leía ese `null` como «cero». Pero nada en `web/` lo
 * atrapaba, y por dos razones que vale nombrar:
 *
 * 1. El único fixture de la ficha **copiaba la forma equivocada** de
 *    producción (los cuatro saldos en `null`), así que el test espejaba el bug
 *    en vez de delatarlo.
 * 2. Ningún test renderizaba este modal con saldos **mayores que cero**. El
 *    camino que mentía no estaba cubierto: solo el que decía la verdad por
 *    casualidad.
 *
 * Por eso acá se prueban los DOS lados. Un test que solo mira el cliente sin
 * nada no distingue «no tiene» de «no sé contar».
 */

function cliente(saldos: FichaDeCliente['saldos']): FichaDeCliente {
  return {
    id: 'c1',
    nombre: 'Yeimy Poveda',
    nombreLibre: null,
    primerNombre: 'Yeimy',
    segundoNombre: null,
    apellidos: 'Poveda',
    apodo: null,
    tipo: 'residencial',
    tipoDocumento: 'CC',
    numeroDocumento: '79123456',
    documento: '79.123.456',
    verificacionEstado: 'verificado',
    verificadoPor: null,
    verificadoEn: null,
    verificacionMetodo: 'admin_oficial',
    creditoHabilitado: true,
    creditoLimite: null,
    activo: true,
    createdAt: '',
    updatedAt: '',
    direcciones: [],
    telefonos: [],
    saldos,
  }
}

const abrirElModal = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Desactivar cliente' }))
}

describe('el modal de desactivar dice qué vuelve al parque', () => {
  it('con dos bases y tres botellones, los nombra', async () => {
    render(<CambiarEstado cliente={cliente({ bases: 2, botellones: 3 })} />)
    await abrirElModal()

    expect(screen.getByText('Esta desactivación mueve stock:')).toBeInTheDocument()

    /*
     * Se afirma sobre el `<li>` entero y no sobre el `<strong>`: el número vive
     * en el `strong` y el resto de la frase en el padre, así que buscar «2» a
     * secas devuelve un nodo cuyo texto es «2» y no dice de qué.
     *
     * Y los números tienen que estar EN el texto, no solo el hecho de que hay
     * algo: «mueve stock» sin la cantidad obliga a cerrar el modal e ir a
     * buscarla, que es justo cuando alguien confirma sin mirar.
     */
    const renglones = screen
      .getAllByRole('listitem')
      .map((li) => (li.textContent ?? '').replace(/\s+/g, ' '))

    expect(renglones).toHaveLength(2)
    expect(renglones.some((t) => /2 bases prestadas vuelven al parque/.test(t))).toBe(true)
    /*
     * «botellones», sin tilde: el plural de «botellón» la pierde. La pantalla
     * decía «3 botellónes» —el código le pegaba `es` al singular— y este
     * renglón es lo que lo delata.
     */
    expect(renglones.some((t) => /3 botellones en poder del cliente vuelven/.test(t))).toBe(true)
    expect(renglones.some((t) => /botellónes/.test(t))).toBe(false)

    expect(
      screen.queryByText('Este cliente no tiene bases ni botellones a su nombre.'),
    ).not.toBeInTheDocument()
  })

  /**
   * El otro lado: cero es cero, y la pantalla puede afirmarlo.
   *
   * Esta frase era la que aparecía SIEMPRE cuando los saldos llegaban en
   * `null`. Ahora solo puede aparecer cuando de verdad no hay nada que
   * devolver.
   */
  it('sin bases ni botellones, lo afirma', async () => {
    render(<CambiarEstado cliente={cliente({ bases: 0, botellones: 0 })} />)
    await abrirElModal()

    expect(
      screen.getByText('Este cliente no tiene bases ni botellones a su nombre.'),
    ).toBeInTheDocument()
  })

  /**
   * El singular, completo: también el VERBO.
   *
   * Decía «1 base prestada **vuelven** al parque». El plural estaba resuelto
   * para el sustantivo y el participio y no para el verbo, y esto se lee en una
   * confirmación antes de algo que no se puede deshacer.
   */
  it('con una sola base, el singular concuerda hasta en el verbo', async () => {
    render(<CambiarEstado cliente={cliente({ bases: 1, botellones: 0 })} />)
    await abrirElModal()

    const [renglon] = screen
      .getAllByRole('listitem')
      .map((li) => (li.textContent ?? '').replace(/\s+/g, ' '))

    expect(renglon).toMatch(/1 base prestada vuelve al parque/)
    expect(renglon).not.toMatch(/vuelven/)
  })

  it('con un solo botellón, también', async () => {
    render(<CambiarEstado cliente={cliente({ bases: 0, botellones: 1 })} />)
    await abrirElModal()

    const [renglon] = screen
      .getAllByRole('listitem')
      .map((li) => (li.textContent ?? '').replace(/\s+/g, ' '))

    expect(renglon).toMatch(/1 botellón en poder del cliente vuelve a la bodega/)
    expect(renglon).not.toMatch(/vuelven/)
  })
})
