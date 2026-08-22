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
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-sutil bg-tarjeta px-4 py-2.5 text-[13px] text-secundario sm:px-6"
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
