import type { ParametrosDeProduccion, Producto } from './api-types'

/**
 * La vista previa del cierre: qué va a pasar ANTES de confirmar.
 *
 * ── Por qué esto existe ─────────────────────────────────────────────────────
 *
 * Un cierre mueve tres saldos de una vez —agua, stock e insumos— y **no se
 * puede deshacer** (RN-PRD-08). Confirmarlo a ciegas es lo que hace que un
 * error se descubra tres días después, cuando ya no se sabe cuál de los tres
 * números era el equivocado.
 *
 * Es la misma decisión que la vista previa de la conversión en M3: quien carga
 * 12 kg tiene que ver «≈ 1.200 unidades» y poder decir «ese número no puede
 * ser» antes de escribirlo en el libro.
 *
 * ── De dónde salen los números ──────────────────────────────────────────────
 *
 * De ningún lado de este archivo. `parametros` llega de
 * `GET /produccion/parametros` y los litros por producto de `GET /productos`
 * (`productos.litros`, columna generada). Nada acá está escrito a mano.
 *
 * Y no es purismo: el galón puede ser imperial (pregunta 4) y el rendimiento
 * es RN-PRD-12, que se revisa cuando se mida de verdad. Con los números
 * copiados, el día que cambien la pantalla seguiría prometiendo los viejos y
 * quien confirma lo haría creyendo otra cosa.
 */

/** Lo que el formulario tiene cargado en este momento. */
export interface ConteosDelCierre {
  minutosProcesando: number
  pacas600: number
  pacas300: number
  botellonesLlenados: number
  botellonesLavados: number
  /** `undefined` mientras no se mida — pregunta 4. */
  caudalGpm?: number
  /** `undefined` mientras no se mida — pregunta 6. */
  litrosPorLavado?: number
}

/** El producto que se genera por cada conteo. Espeja `PRODUCTO_DE` en `api/`. */
export const PRODUCTO_DE = {
  pacas600: 'P20U_600ML',
  pacas300: 'P50U_300ML',
  botellonesLlenados: 'BOT_20L',
} as const

export interface LotePrevisto {
  codigoDeProducto: string
  nombre: string
  cantidad: number
}

export interface VistaPreviaDelCierre {
  /**
   * Litros que van a salir del tanque procesado: envasado + lavado.
   *
   * Se redondea AL FINAL, igual que `api/`: redondear cada término por
   * separado acumula una diferencia que después nadie puede explicar.
   */
  litrosConsumidos: number
  /**
   * Litros que van a entrar al tanque procesado. `null` sin caudal medido —
   * y ese `null` es información, no un hueco: significa que el procesamiento
   * de hoy no se va a poder calcular.
   */
  litrosProcesados: number | null
  /** Litros de crudo que va a consumir ese procesamiento. `null` sin caudal. */
  litrosCrudosConsumidos: number | null
  /** Uno de cada insumo por botellón envasado. */
  insumosConsumidos: number
  /** Se devuelve para que los avisos puedan nombrarlo sin volver a leer el campo. */
  botellonesLavados: number
  /** Un lote por producto envasado — RN-PRD-23. */
  lotes: LotePrevisto[]
  /**
   * Productos que hacen falta para calcular y no están en el catálogo.
   *
   * No se resuelven con cero: el consumo saldría subestimado, el balance
   * cerraría con un número que parece correcto, y nadie lo relacionaría con el
   * producto faltante. `api/` rechaza el cierre por esto mismo.
   */
  productosFaltantes: string[]
  /**
   * `true` cuando hay lavados registrados pero nadie midió cuánto consume uno.
   *
   * `api/` rechaza el cierre con `SIN_LITROS_DE_LAVADO`. Anticiparlo acá evita
   * que se llene todo el formulario para que lo rebote al enviar.
   */
  faltaMedirElLavado: boolean
}

export function preverCierre(
  conteos: ConteosDelCierre,
  parametros: ParametrosDeProduccion,
  catalogo: Producto[],
): VistaPreviaDelCierre {
  const porCodigo = new Map(catalogo.map((p) => [p.codigo, p]))
  const faltantes: string[] = []

  const litrosDe = (codigo: string): number => {
    const producto = porCodigo.get(codigo)
    if (!producto) {
      faltantes.push(codigo)
      return 0
    }
    return Number(producto.litros)
  }

  const lotes: LotePrevisto[] = []
  let envasado = 0

  for (const [campo, codigo] of Object.entries(PRODUCTO_DE)) {
    const cantidad = conteos[campo as keyof typeof PRODUCTO_DE]
    if (cantidad <= 0) continue

    envasado += cantidad * litrosDe(codigo)
    lotes.push({
      codigoDeProducto: codigo,
      nombre: porCodigo.get(codigo)?.nombre ?? codigo,
      cantidad,
    })
  }

  const lavado = conteos.botellonesLavados * (conteos.litrosPorLavado ?? 0)

  const litrosProcesados =
    conteos.caudalGpm === undefined
      ? null
      : Math.round(
          conteos.caudalGpm *
            conteos.minutosProcesando *
            parametros.litrosPorGalon *
            parametros.rendimiento,
        )

  return {
    litrosConsumidos: Math.round(envasado + lavado),
    litrosProcesados,
    litrosCrudosConsumidos:
      litrosProcesados === null ? null : Math.round(litrosProcesados / parametros.rendimiento),
    insumosConsumidos: conteos.botellonesLlenados,
    botellonesLavados: conteos.botellonesLavados,
    lotes,
    productosFaltantes: [...new Set(faltantes)],
    faltaMedirElLavado:
      conteos.botellonesLavados > 0 && conteos.litrosPorLavado === undefined,
  }
}
