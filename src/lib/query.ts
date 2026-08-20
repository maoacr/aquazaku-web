/**
 * Un query param puede llegar repetido (`?a=1&a=2`), y entonces Next lo entrega
 * como array. Casi todos los filtros esperan un solo valor.
 *
 * Se toma el primero en vez de rechazar: un usuario que arma la URL a mano o un
 * link mal copiado no deberían romper una pantalla de consulta.
 */
export function unoSolo(valor: string | string[] | undefined): string | undefined {
  if (Array.isArray(valor)) return valor[0]
  return valor
}
