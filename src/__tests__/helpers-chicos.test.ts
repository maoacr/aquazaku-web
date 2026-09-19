import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/errors'
import { siPuedeVerlo } from '@/lib/permiso-opcional'
import { unoSolo } from '@/lib/query'
import { ROLES_DISPONIBLES, type Role } from '@/lib/roles'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('sileo', () => ({ sileo: { success: vi.fn(), warning: vi.fn() } }))

const { cookies } = await import('next/headers')
const { COOKIE_MENU, esEstadoValido, leerEstadoDelMenu } = await import('@/lib/menu')
const { avisarAtencion, avisarExito } = await import('@/lib/avisos')
const { sileo } = await import('sileo')

/**
 * Los helpers chicos que sostienen decisiones grandes.
 *
 * Ninguno tiene más de cuarenta líneas, y los cuatro deciden algo que se nota
 * cuando falla: qué ve un rol, qué menú se pinta en la primera pintura, si una
 * pantalla se cae entera por un panel, y qué filtro se aplica cuando la URL
 * viene mal armada.
 */

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * Un query param puede llegar repetido (`?a=1&a=2`) y entonces Next lo entrega
 * como array.
 *
 * Se toma el primero en vez de rechazar: un link mal copiado no debería romper
 * una pantalla de consulta.
 */
describe('unoSolo()', () => {
  it('un valor simple pasa tal cual', () => {
    expect(unoSolo('2026-09')).toBe('2026-09')
  })

  it('un param repetido se queda con el primero, no rompe la pantalla', () => {
    expect(unoSolo(['2026-09', '2026-08'])).toBe('2026-09')
  })

  it('sin valor devuelve undefined', () => {
    expect(unoSolo(undefined)).toBeUndefined()
  })

  it('un array vacío devuelve undefined en vez de reventar', () => {
    expect(unoSolo([])).toBeUndefined()
  })

  it('una cadena vacía se conserva: es distinta de ausente', () => {
    expect(unoSolo('')).toBe('')
  })
})

/**
 * Los cuatro roles, como valor.
 *
 * El tipo solo existe en compilación: para pintar checkboxes hace falta una
 * lista de verdad. El `satisfies` hace que agregar un rol al `type` sin sumarlo
 * acá sea un error de compilación, no una casilla que nadie ve en la pantalla.
 */
describe('ROLES_DISPONIBLES', () => {
  it('están los cuatro', () => {
    expect(ROLES_DISPONIBLES).toEqual(['admin', 'seller', 'pos', 'contador'])
  })

  /*
   * `contador` no es un sub-caso de `admin`: se agregó para temas tributarios
   * (DIAN) y ve auditoría por su propia puerta.
   */
  it('contador está por derecho propio, no derivado de admin', () => {
    expect(ROLES_DISPONIBLES).toContain('contador')
  })

  it('no tiene repetidos', () => {
    expect(new Set(ROLES_DISPONIBLES).size).toBe(ROLES_DISPONIBLES.length)
  })

  it('cada uno es un Role válido', () => {
    const roles: readonly Role[] = ROLES_DISPONIBLES
    expect(roles).toHaveLength(4)
  })
})

/**
 * El estado del menú, en cookie y no en `localStorage`.
 *
 * Con `localStorage` el servidor no sabe la preferencia: manda el menú
 * desplegado y al hidratar se colapsa de golpe. Ese salto pasa en CADA
 * navegación y encima corre el contenido 160 px a la izquierda.
 */
describe('esEstadoValido()', () => {
  it.each(['desplegado', 'colapsado'])('«%s» es un estado del menú', (valor) => {
    expect(esEstadoValido(valor)).toBe(true)
  })

  it.each([
    ['vacío', ''],
    ['en mayúsculas', 'DESPLEGADO'],
    ['inventado', 'abierto'],
  ])('un valor %s no lo es', (_caso, valor) => {
    expect(esEstadoValido(valor)).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['un número', 1],
    ['un objeto', {}],
  ])('%s tampoco: la cookie puede traer cualquier cosa', (_caso, valor) => {
    expect(esEstadoValido(valor)).toBe(false)
  })
})

describe('leerEstadoDelMenu()', () => {
  function conCookie(valor: string | undefined): void {
    vi.mocked(cookies).mockResolvedValue({
      get: (nombre: string) => (nombre === COOKIE_MENU && valor !== undefined ? { value: valor } : undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>)
  }

  it('devuelve el estado guardado cuando es válido', async () => {
    conCookie('colapsado')

    expect(await leerEstadoDelMenu()).toBe('colapsado')
  })

  /*
   * Quien entra por primera vez tiene que ver los NOMBRES de los módulos: un
   * riel de iconos es cómodo para quien ya sabe dónde está cada cosa, y
   * adivinanza para quien no.
   */
  it('sin cookie arranca desplegado: los nombres antes que los iconos', async () => {
    conCookie(undefined)

    expect(await leerEstadoDelMenu()).toBe('desplegado')
  })

  it('una cookie con basura también cae en desplegado, no rompe la pintura', async () => {
    conCookie('sarasa')

    expect(await leerEstadoDelMenu()).toBe('desplegado')
  })
})

/**
 * Un panel que el tablero muestra SI el rol lo puede ver.
 *
 * ── Por qué se pregunta en vez de recordar ──────────────────────────────────
 *
 * La salida obvia era copiar la matriz de permisos en `web/` y consultarla
 * antes de pedir. Sería una segunda fuente de verdad de lo más delicado del
 * sistema: el día que la matriz cambie, el tablero seguiría escondiendo —o
 * peor, mostrando— lo que ya no corresponde, y nadie lo notaría porque no
 * fallaría nada.
 *
 * ── Y por qué SOLO el 403 ───────────────────────────────────────────────────
 *
 * Esconder un panel porque el backend está roto convierte una falla ruidosa en
 * un tablero que miente por omisión.
 */
describe('siPuedeVerlo()', () => {
  it('deja pasar el dato cuando el rol sí lo puede ver', async () => {
    expect(await siPuedeVerlo(Promise.resolve({ litros: 4200 }))).toEqual({ litros: 4200 })
  })

  it('un 403 se convierte en null: el panel no se dibuja y la página vive', async () => {
    const prohibido = Promise.reject(new ApiError(403, 'forbidden', { path: '/tanques' }))

    expect(await siPuedeVerlo(prohibido)).toBeNull()
  })

  it('un 500 SÍ sube: api/ roto tiene que hacer ruido, no esconder un panel', async () => {
    const caido = Promise.reject(new ApiError(500, 'boom', { path: '/tanques' }))

    await expect(siPuedeVerlo(caido)).rejects.toBeInstanceOf(ApiError)
  })

  it('un 401 también sube: sesión vencida no es «no tiene permiso»', async () => {
    const sinSesion = Promise.reject(new ApiError(401, 'unauthorized'))

    await expect(siPuedeVerlo(sinSesion)).rejects.toBeInstanceOf(ApiError)
  })

  /*
   * Una caída de red no es un ApiError y no trae status. Tragársela sería el
   * mismo tablero que miente por omisión, sin siquiera un status que lo delate.
   */
  it('un error que no es de api/ sube tal cual', async () => {
    const red = Promise.reject(new TypeError('fetch failed'))

    await expect(siPuedeVerlo(red)).rejects.toThrow('fetch failed')
  })
})

/**
 * Los avisos temporales.
 *
 * Envuelven a `sileo` para que la decisión de qué librería usar viva en un
 * archivo, y para que la duración sea una del sistema y no de cada pantalla.
 */
describe('los avisos', () => {
  it('un éxito va como success, con la duración del sistema', () => {
    avisarExito('Entrada registrada.')

    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Entrada registrada.', duration: 4000 }),
    )
  })

  it('sin detalle no manda una descripción vacía', () => {
    avisarExito('Entrada registrada.')

    expect(vi.mocked(sileo.success).mock.calls[0][0]).not.toHaveProperty('description')
  })

  it('con detalle lo manda como descripción', () => {
    avisarExito('Entrada registrada.', 'Quedan 542 unidades.')

    expect(sileo.success).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Quedan 542 unidades.' }),
    )
  })

  /*
   * Atención NO es error: la operación salió bien y el aviso es sobre lo que
   * viene —el saldo quedó bajo el mínimo—. Por eso va como `warning` y no como
   * un error de formulario, que se quedaría pegado al campo.
   */
  it('una atención va como warning: salió bien, pero hay algo que saber', () => {
    avisarAtencion('El saldo quedó bajo el mínimo.')

    expect(sileo.warning).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'El saldo quedó bajo el mínimo.', duration: 4000 }),
    )
    expect(sileo.success).not.toHaveBeenCalled()
  })

  it('la atención también acepta detalle', () => {
    avisarAtencion('El saldo quedó bajo el mínimo.', 'Quedan 8 de 100.')

    expect(sileo.warning).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Quedan 8 de 100.' }),
    )
  })
})
