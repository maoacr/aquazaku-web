import { columnasVisibles } from '@/components/reportes/columnas'
import { apiServerFetch, getServerUser } from '@/lib/api-server'
import type { Extracto } from '@/lib/api-types'

/**
 * El extracto en CSV — RN-CON-08.
 *
 * ── Por qué vive acá y no en `api/` ─────────────────────────────────────────
 *
 * El browser no puede hablarle a `api/` (ADR-0002), así que la descarga tiene
 * que salir de un origen propio. Y el CSV no es un dato distinto: es el MISMO
 * extracto con otra ropa. Un endpoint aparte en `api/` sería una segunda forma
 * de responder la misma pregunta, con su propio riesgo de contestar distinto.
 *
 * Acá adentro se pide por `apiServerFetch` como cualquier pantalla, y las
 * columnas salen de la misma declaración que dibuja la tabla: lo que se ve es
 * lo que se baja.
 *
 * ── El PDF no está acá, y es a propósito ────────────────────────────────────
 *
 * Lo genera el navegador con «Imprimir → Guardar como PDF» sobre los estilos de
 * impresión de la pantalla. Una librería de PDF en el servidor sería una
 * dependencia pesada para dibujar a mano una tabla que ya existe — y ese dibujo
 * empezaría a separarse de la pantalla desde el primer cambio.
 *
 * Así el PDF es, literalmente, lo que el contador está viendo.
 */
export async function GET(req: Request) {
  /*
   * La ruta valida por su cuenta. Que solo se llegue desde una pantalla que ya
   * exigió permiso es cosmética: esto es una URL, y se puede pegar en el
   * navegador (RN-ACC-02).
   */
  if (!(await getServerUser())) {
    return new Response('Sesión vencida', { status: 401 })
  }

  const params = new URL(req.url).searchParams
  const consulta = new URLSearchParams()
  for (const clave of ['desde', 'hasta', 'tipos'] as const) {
    const valor = params.get(clave)
    if (valor) consulta.set(clave, valor)
  }

  /*
   * El 403 de `api/` se deja pasar tal cual: quien no puede ver el extracto
   * tampoco puede bajarlo, y esa decisión es de allá, no de acá.
   */
  const extracto = await apiServerFetch<Extracto>(`/reportes/extracto?${consulta}`)
  const columnas = columnasVisibles(params.get('columnas') ?? undefined)

  const filas = [
    columnas.map((c) => c.etiqueta),
    ...extracto.movimientos.map((m) => columnas.map((c) => (c.numerica ? cifra(c.valor(m)) : c.valor(m)))),
  ]

  /*
   * ── El BOM y el punto y coma no son manías ────────────────────────────────
   *
   * Sin BOM, Excel abre el archivo en la codificación del sistema y «Panadería»
   * llega como «PanaderÃ­a». Y en un Excel en español el separador de listas es
   * `;`: con comas, todo el archivo entra en una sola columna.
   *
   * Las dos cosas juntas son la diferencia entre un reporte y un archivo que el
   * contador devuelve pidiendo «mandámelo bien».
   */
  const csv = `\uFEFF${filas.map((f) => f.map(escapar).join(';')).join('\r\n')}\r\n`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="extracto-${extracto.desde}-a-${extracto.hasta}.csv"`,
      // Un extracto se pide de nuevo cada vez: los movimientos del rango pueden
      // haber cambiado desde la última descarga.
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * El monto como lo espera un Excel en español: coma decimal, sin separador de
 * miles. Con punto decimal, `12000.00` entra como texto o como doce millones —
 * y una columna de montos que no se puede sumar no sirve para nada.
 *
 * **Supuesto** — pregunta 46: depende de en qué abre los archivos el contador.
 */
function cifra(monto: string): string {
  return monto.replace('.', ',')
}

/**
 * Comillas dobles alrededor y dobladas adentro, que es lo que dice el RFC 4180.
 * Un nombre con `;` —«Tienda La Esquina; sede norte»— parte la fila en dos sin
 * esto, y el archivo queda desalineado a partir de ahí.
 */
function escapar(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`
}
