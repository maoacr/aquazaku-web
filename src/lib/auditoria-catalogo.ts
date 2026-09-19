/**
 * Vocabulario de la bitácora: qué módulos existen y qué acciones tiene cada uno.
 *
 * Espeja `api/src/modules/authz/matrix.ts` (la matriz de permisos) más las
 * acciones que las rutas emiten por su cuenta y no son permisos —`precio_manual`,
 * `sign-in`, `reactivar`—. Se mantiene a mano y acá, igual que `api-types.ts`:
 * un cambio en la matriz exige el cambio en este archivo.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 *
 * Los filtros de acción y módulo eran `<input type="text">`. El filtro de la
 * API es coincidencia EXACTA, así que una letra de más devolvía cero filas — y
 * cero filas por un typo se ve idéntico a cero filas porque no pasó nada. En
 * una pantalla cuyo único trabajo es encontrar lo que alguien hizo, esa
 * ambigüedad es el peor defecto posible.
 *
 * ── Por qué en dos pasos y no una lista sola ────────────────────────────────
 *
 * Todas las acciones juntas son más de setenta. Un desplegable de setenta
 * ítems no se lee, se scrollea. Eligiendo primero el módulo, el segundo
 * desplegable nunca pasa de siete, y encima las acciones se dicen solas:
 * dentro de «Botellones», `registrar` es «Registrar» y no `botellones:registrar`.
 */

export interface AccionAuditable {
  /** Lo que viaja en `?action=` — formato canónico `recurso:accion`. */
  valor: string
  etiqueta: string
}

export interface ModuloAuditable {
  /** Lo que viaja en `?resource=`. */
  valor: string
  etiqueta: string
  acciones: AccionAuditable[]
}

/**
 * Etiquetas por acción pelada.
 *
 * Van sin el módulo adelante a propósito: el desplegable ya está acotado a un
 * módulo, así que repetirlo en cada opción sería ruido. `registrar` dentro de
 * «Cobros» no necesita aclarar que es un cobro.
 */
const ETIQUETAS: Record<string, string> = {
  abrir: 'Abrir',
  ajustar: 'Ajustar',
  anular: 'Anular',
  anular_verificada: 'Anular una ya verificada',
  cargar_ruta: 'Cargar ruta',
  cerrar_con_faltante: 'Cerrar con faltante',
  'change-password': 'Cambio de contraseña',
  corregir: 'Corregir',
  crear: 'Crear',
  crear_retroactiva: 'Crear con fecha anterior',
  descargar_pdf: 'Descargar PDF',
  descartar: 'Descartar',
  desactivar: 'Desactivar',
  editar: 'Editar',
  editar_precios: 'Editar precios',
  entregar: 'Entregar',
  equivalencias: 'Equivalencias',
  financieros: 'Ver financieros',
  gestionar_cuentas_pendientes: 'Gestionar cuentas pendientes',
  habilitar_credito: 'Habilitar crédito',
  operativos: 'Ver operativos',
  precio_manual: 'Precio escrito a mano',
  prestar: 'Prestar',
  'rate-limit': 'Bloqueo por intentos fallidos',
  reactivar: 'Reactivar',
  recibir: 'Recibir',
  recibir_retorno: 'Recibir retorno',
  registrar: 'Registrar',
  registrar_cierre: 'Registrar cierre',
  registrar_reposicion: 'Registrar reposición',
  rendir: 'Rendir',
  'restablecer-password': 'Restablecer contraseña',
  retirar: 'Retirar',
  'sign-in': 'Inicio de sesión',
  'sign-out': 'Cierre de sesión',
  ver: 'Ver',
  verificar_documento: 'Verificar documento',
  verificar_pago: 'Verificar pago',
}

/** `['ventas', 'Ventas', ['crear', 'anular']]` → el módulo ya armado. */
function modulo(valor: string, etiqueta: string, acciones: string[]): ModuloAuditable {
  return {
    valor,
    etiqueta,
    acciones: acciones
      .map((accion) => ({
        valor: `${valor}:${accion}`,
        etiqueta: ETIQUETAS[accion] ?? accion,
      }))
      .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
  }
}

/**
 * Los módulos, en orden alfabético.
 *
 * `auth` no está en la matriz de permisos —entrar y salir no se decide por
 * permiso— pero sí deja filas, así que acá figura como «Sesión». Sin él, los
 * intentos de login fallidos no serían filtrables, y son la consulta de
 * seguridad más usada después de los denegados.
 */
export const MODULOS_AUDITABLES: ModuloAuditable[] = [
  modulo('auditoria', 'Auditoría', ['ver']),
  modulo('auth', 'Sesión', ['sign-in', 'sign-out', 'change-password', 'rate-limit']),
  modulo('bases', 'Bases', ['descartar', 'prestar', 'registrar', 'retirar', 'ver']),
  modulo('botellones', 'Botellones', [
    'descartar',
    'entregar',
    'recibir_retorno',
    'registrar',
    'ver',
  ]),
  modulo('clientes', 'Clientes', [
    'crear',
    'editar',
    'habilitar_credito',
    'ver',
    'verificar_documento',
  ]),
  modulo('cobros', 'Cobros', ['registrar', 'ver']),
  modulo('compras', 'Compras', ['crear', 'recibir']),
  modulo('configuracion', 'Configuración', ['editar', 'equivalencias', 'ver']),
  modulo('insumos', 'Insumos', ['ajustar', 'ver']),
  modulo('produccion', 'Producción', ['registrar_cierre', 'ver']),
  modulo('productos', 'Productos', [
    'crear',
    'desactivar',
    'editar',
    'editar_precios',
    'reactivar',
    'ver',
  ]),
  modulo('proveedores', 'Proveedores', ['crear', 'editar', 'ver']),
  modulo('reportes', 'Reportes', ['descargar_pdf', 'financieros', 'operativos']),
  modulo('rutas', 'Rutas', ['abrir', 'cerrar_con_faltante', 'rendir', 'ver']),
  modulo('stock', 'Stock', ['ajustar', 'cargar_ruta', 'descartar', 'ver']),
  modulo('tanques', 'Tanques', ['ajustar', 'registrar_reposicion', 'ver']),
  modulo('usuarios', 'Usuarios', ['crear', 'editar', 'restablecer-password', 'ver']),
  modulo('ventas', 'Ventas', [
    'anular',
    'anular_verificada',
    'corregir',
    'crear',
    'crear_retroactiva',
    'gestionar_cuentas_pendientes',
    'precio_manual',
    'verificar_pago',
    'ver',
  ]),
]

/** El módulo al que pertenece una acción canónica, o `undefined` si no existe. */
export function moduloDeLaAccion(action: string | undefined): string | undefined {
  if (!action) return undefined

  return MODULOS_AUDITABLES.find((m) => m.acciones.some((a) => a.valor === action))?.valor
}
