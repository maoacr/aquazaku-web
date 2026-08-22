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

        `my-3 mr-3` sin margen izquierdo: el pie vive en la columna del
        contenido, y el menú ya aporta su propio margen derecho. Sumar otro
        abriría un hueco de 24 px justo ahí y rompería la alineación con la
        cabecera y el contenido, que arrancan en el borde de la columna.

        En teléfono no hay columna de menú, así que ahí lleva margen en los dos
        lados.
      */
      className="aq-panel-marca m-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl px-4 py-2.5 text-[13px] text-secundario sm:ml-0 sm:px-6"
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
