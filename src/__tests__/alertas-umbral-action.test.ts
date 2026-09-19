import { afterEach, describe, expect, it, vi } from 'vitest'
import { cambiarUmbralAction } from '@/app/(app)/modulos/alertas/actions'

vi.mock('@/lib/api-server', () => ({ apiServerFetchRaw: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { apiServerFetchRaw } = await import('@/lib/api-server')
const { revalidatePath } = await import('next/cache')

/**
 * Cambiar un umbral de alerta — M12.
 *
 * ── Lo que NO hace, y es lo importante ──────────────────────────────────────
 *
 * No valida el rango. Ese lo decide `api/`, que lo lee de la misma fila donde
 * vive el valor: copiar los números acá sería un tercer lugar donde pueden
 * discrepar, y el día que discrepen gana el que no se actualizó.
 *
 * ── Por qué refresca tres pantallas y no una ────────────────────────────────
 *
 * El umbral decide qué se pinta como «vence pronto» en stock y en el panel.
 * Sin revalidarlas, alguien lo cambia, vuelve al panel, ve los avisos viejos —
 * y concluye que no se guardó.
 */

function form(campos: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) fd.set(k, v)
  return fd
}

function respuesta(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function respondeSiempre(status: number, body: unknown = {}): void {
  vi.mocked(apiServerFetchRaw).mockImplementation(async () => respuesta(status, body))
}

function ultimoPedido(): { url: string; metodo: string; body: Record<string, unknown> } {
  const llamada = vi.mocked(apiServerFetchRaw).mock.calls.at(-1)!
  const init = (llamada[1] ?? {}) as RequestInit
  return {
    url: llamada[0],
    metodo: String(init.method),
    body: init.body ? JSON.parse(String(init.body)) : {},
  }
}

const PARAMETRO = { etiqueta: 'Vencimiento próximo', valor: 5, unidad: 'días' }

afterEach(() => {
  vi.clearAllMocks()
})

describe('lo que se ataja antes del viaje', () => {
  it('un valor vacío no gasta una llamada a api/', async () => {
    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '' }))

    expect(estado.error).toBe('Escriba un número de días.')
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  it('un valor de solo espacios cuenta como vacío', async () => {
    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '   ' }))

    expect(estado.error).toBe('Escriba un número de días.')
    expect(apiServerFetchRaw).not.toHaveBeenCalled()
  })

  /*
   * Un rango inválido SÍ viaja: quien decide si 900 días es demasiado es `api/`,
   * que tiene el mínimo y el máximo al lado del valor. Atajarlo acá con números
   * copiados es lo que crea las dos verdades.
   */
  it('un número fuera de rango SÍ viaja: el rango lo decide api/', async () => {
    respondeSiempre(422, { mensaje: 'El umbral va entre 1 y 30 días.' })

    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '900' }))

    expect(apiServerFetchRaw).toHaveBeenCalled()
    expect(estado.error).toBe('El umbral va entre 1 y 30 días.')
  })
})

describe('lo que viaja a api/', () => {
  it('va por PUT al parámetro, identificado por su clave', async () => {
    respondeSiempre(200, PARAMETRO)

    await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    expect(ultimoPedido().url).toBe('/parametros/vence_pronto')
    expect(ultimoPedido().metodo).toBe('PUT')
  })

  it('manda el valor recortado', async () => {
    respondeSiempre(200, PARAMETRO)

    await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '  5  ' }))

    expect(ultimoPedido().body).toEqual({ valor: '5' })
  })
})

describe('lo que se cuenta al volver', () => {
  /*
   * El mensaje se arma con lo que devolvió `api/`, no con lo que se escribió.
   * Si `api/` normalizó el valor —o lo redondeó—, el texto tiene que decir lo
   * que quedó guardado, no lo que se pidió.
   */
  it('el mensaje usa lo que guardó api/, no lo que se escribió', async () => {
    respondeSiempre(200, { etiqueta: 'Vencimiento próximo', valor: 5, unidad: 'días' })

    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5.4' }))

    expect(estado.ok).toBe('Vencimiento próximo: ahora avisa a los 5 días.')
  })

  it('un éxito trae token', async () => {
    respondeSiempre(200, PARAMETRO)

    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    expect(estado.token).toBeDefined()
  })

  it('refresca alertas, stock y el panel: el umbral se ve en los tres', async () => {
    respondeSiempre(200, PARAMETRO)

    await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    const rutas = vi.mocked(revalidatePath).mock.calls.map((c) => String(c[0]))
    expect(rutas).toContain('/modulos/alertas')
    expect(rutas).toContain('/modulos/stock')
    expect(rutas).toContain('/')
  })

  /*
   * Stock se revalida como `layout`, no como página: el aviso de «vence pronto»
   * vive en la estructura que envuelve a las rutas hijas. Revalidarlo como
   * página dejaría el detalle de cada producto con el umbral viejo.
   */
  it('stock se refresca como layout: el aviso envuelve a las rutas hijas', async () => {
    respondeSiempre(200, PARAMETRO)

    await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    expect(revalidatePath).toHaveBeenCalledWith('/modulos/stock', 'layout')
  })

  it('cuando falla no refresca nada', async () => {
    respondeSiempre(500, {})

    await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('un error sin cuerpo útil cae al genérico en vez de reventar', async () => {
    vi.mocked(apiServerFetchRaw).mockResolvedValue(
      new Response('<html>502</html>', { status: 502 }),
    )

    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    expect(estado.error).toBe('No pudimos cambiar el umbral. Intente de nuevo.')
  })

  it('un error NO trae token', async () => {
    respondeSiempre(500, {})

    const estado = await cambiarUmbralAction({}, form({ clave: 'vence_pronto', valor: '5' }))

    expect(estado.token).toBeUndefined()
  })
})
