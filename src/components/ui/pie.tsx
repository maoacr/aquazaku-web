/**
 * Los créditos del sistema: derechos reservados y autoría.
 *
 * Se usan en dos lugares y en ninguno a la vez. En escritorio y tablet van en el
 * pie —una franja propia del armazón—; en teléfono el pie lo ocupa la barra de
 * navegación, así que se mudan al fondo del cajón.
 *
 * El texto vive acá, en un solo lugar, para que las dos versiones no puedan
 * divergir. Ya pasó con la marca: dos instancias con estilos distintos que había
 * que acordarse de tocar juntas.
 */
export function Creditos() {
  const anio = new Date().getFullYear()

  return (
    // Los créditos son el texto más callado de la pantalla: `tenue`, no
    // `secundario`. Antes compartían color con el subtítulo del tablero y con
    // los rótulos de sección, y no hay razón — nadie viene a leer esto.
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-tenue">
      <p>© {anio} Aquazaku. Todos los derechos reservados.</p>

      <p>
        Hecho con <span aria-label="cariño">💚</span> por{' '}
        <a
          href="https://maoacr.com"
          target="_blank"
          // `noopener` para que el sitio destino no pueda tocar esta pestaña.
          rel="noopener noreferrer"
          /*
            `text-accion-suave` y no `text-accion`: el azul de acción es el de
            los botones, y acá le daba a un enlace de autoría el mismo peso que
            a «Guardar». Este es el celeste de la gota de la marca.
          */
          className="rounded-sm font-medium text-accion-suave underline-offset-4 hover:underline"
        >
          @maoacr
        </a>
      </p>
    </div>
  )
}

/**
 * El pie del armazón. **Solo en tablet y escritorio.**
 *
 * Está en el armazón y no dentro del contenido: el `<main>` es lo único que
 * scrollea, así que el pie no se va con el scroll ni hay que llegar al final de
 * una tabla de mil filas para verlo.
 *
 * En teléfono no existe: esa fila del grid la ocupa la barra de navegación, que
 * es lo que hace falta ahí abajo. Los créditos no desaparecen — se mudan al
 * fondo del cajón.
 */
export function Pie() {
  return (
    <footer
      style={{ gridArea: 'pie' }}
      /*
        Misma lámina que el menú, para que el pie sea parte del ecosistema y no
        una barra pegada abajo.

        NO lleva márgenes propios: la separación con el borde de la pantalla la
        pone el canal del armazón. Los tenía —24 px a los lados y 12 abajo— y
        eran la razón de que el pie no cerrara con el menú ni con el contenido.
        El único padding que queda es el interno, que sí es suyo.
      */
      /*
        `aq-panel-banda` corrige la geometría de la luz. El brillo del vidrio se
        mide en porcentaje del elemento, así que sobre una caja ancha y baja la
        misma regla que en el menú da una raya fina en vez de un resplandor: el
        pie se veía plano al lado del panel lateral sin que ninguna variable
        fuera distinta.
      */
      className="aq-panel-marca aq-panel-banda hidden rounded-xl px-5 py-2.5 sm:block"
    >
      <Creditos />
    </footer>
  )
}
