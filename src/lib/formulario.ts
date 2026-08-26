/**
 * El estado que devuelve toda Server Action de una pantalla.
 *
 * ── Por qué es UNO solo y no uno por módulo ─────────────────────────────────
 *
 * Estaba declarado cuatro veces —stock, productos, usuarios, insumos— y las
 * cuatro copias no eran iguales: dos tenían `token` y dos no. Esa diferencia no
 * fue una decisión, fue deriva, y tuvo una consecuencia concreta: los
 * formularios sin token no podían limpiar sus campos ni avisar dos éxitos
 * seguidos, porque no había con qué distinguir «se envió de nuevo» de «no pasó
 * nada».
 *
 * Con una sola definición, un formulario nuevo nace con las tres piezas.
 *
 * Este archivo NO lleva `'use client'`: lo importan las Server Actions. La
 * plomería de React vive en `formulario-cliente.ts`.
 */
export interface EstadoDeFormulario {
  /**
   * Se queda en pantalla, junto al campo. **Nunca es un toast**: un error que
   * desaparece obliga a recordar qué decía mientras se corrige.
   */
  error?: string

  /** Se va como toast. Es una confirmación, no algo que haya que volver a leer. */
  ok?: string

  /**
   * Identifica **esta** operación exitosa. Cambia siempre, aunque el mensaje
   * se repita.
   *
   * De acá se DERIVAN dos cosas sin `useEffect`: la limpieza de los campos y el
   * disparo del aviso. Sincronizar cualquiera de las dos con un efecto dispara
   * renders en cascada, y el dato ya estaba ahí.
   *
   * Con ERROR no hay token, así que lo escrito se conserva: hacer reescribir un
   * motivo por un error de cantidad castiga a quien ya pensó la explicación.
   */
  token?: string
}

/** Un éxito, con el token que dispara la limpieza y el aviso. */
export function exito(mensaje: string): EstadoDeFormulario {
  return { ok: mensaje, token: crypto.randomUUID() }
}
