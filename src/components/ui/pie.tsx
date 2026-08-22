/**
 * Pie del sistema. Visible siempre, en cualquier pantalla.
 *
 * Está en el armazón y no dentro del contenido: el `<main>` es lo único que
 * scrollea, así que el pie no se va con el scroll ni hay que llegar al final de
 * una tabla de mil filas para verlo.
 */
export function Pie() {
  const anio = new Date().getFullYear()

  return (
    <footer
      style={{ gridArea: 'pie' }}
      /*
        Misma lámina que el menú, y mismo ritmo de márgenes, para que el pie sea
        parte del ecosistema y no una barra pegada abajo.

        Los márgenes horizontales son los mismos que el padding del contenido
        —24 px en escritorio— así que los bordes del pie caen exactamente donde
        caen los de las tarjetas. Antes estaba a 12 px y quedaba 12 px más ancho
        que todo lo demás: la clase de desalineación que no se sabe nombrar pero
        se ve.
      */
      className="aq-panel-marca mx-4 mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 text-[13px] text-secundario sm:mx-6 sm:px-5"
    >
      <p>© {anio} Aquazaku. Todos los derechos reservados.</p>

      <p>
        Hecho con <span aria-label="cariño">💚</span> por{' '}
        <a
          href="https://maoacr.com"
          target="_blank"
          // `noopener` para que el sitio destino no pueda tocar esta pestaña.
          rel="noopener noreferrer"
          className="rounded-sm font-medium text-accion underline-offset-4 hover:underline"
        >
          @maoacr
        </a>
      </p>
    </footer>
  )
}
