import Image from 'next/image'

/**
 * La marca de Aquazaku.
 *
 * ── Se usa el arte real, no una versión redibujada ──────────────────────────
 *
 * El original pesa entre 3 y 13 MB, y la primera reacción fue redibujar el
 * isotipo como SVG para no mandar eso a un navegador. Era resolver el problema
 * equivocado: el peso se arregla **optimizando**, no dibujando de nuevo.
 *
 * Ese mismo arte a 240 px de ancho en WebP pesa **11 KB** —de 9,7 MB— y es la
 * marca de verdad, con su bisel, su cavidad y sus ondas. Un SVG redibujado a
 * mano nunca iba a llegar a eso, y encima lo iba a parecer.
 *
 * Cada pieza en el tamaño en que se usa:
 *
 *   `isotipo.webp`        240 px — la cabecera lo pinta a 37, sobra para 3x
 *   `gota.webp`           512 px — la gota sola, para usos chicos y cuadrados
 *   `logo-completo.webp`  900 px — el lockup, para la pantalla de acceso
 *   `wordmark.webp`       900 px — solo el nombre
 *
 * `alt=""` y `aria-hidden` en el isotipo cuando va acompañado del nombre: si no,
 * un lector de pantalla dice "Aquazaku" dos veces seguidas.
 */
export function Isotipo({
  className = 'h-7 w-[2.3rem]',
  decorativo = false,
}: {
  className?: string
  decorativo?: boolean
}) {
  return (
    <Image
      src="/marca/isotipo.webp"
      alt={decorativo ? '' : 'Aquazaku'}
      aria-hidden={decorativo || undefined}
      width={240}
      height={161}
      // `priority`: es lo primero que se ve de la marca y vive en la cabecera,
      // así que no puede entrar tarde y correr el layout.
      priority
      className={className}
    />
  )
}

/** La gota sola. Para donde el espacio es cuadrado y tres gotas no entran. */
export function Gota({ className = 'size-8' }: { className?: string }) {
  return (
    <Image
      src="/marca/gota.webp"
      alt=""
      aria-hidden
      width={512}
      height={752}
      className={className}
    />
  )
}

/**
 * El lockup completo: las tres gotas con el nombre debajo.
 *
 * Va donde la marca es la protagonista y hay lugar —la pantalla de acceso—, no
 * en el chrome de la app. Es la regla D3 del sistema: la marca aparece en
 * superficies de marca, nunca detrás de datos.
 */
export function LogoCompleto({ className = 'w-64' }: { className?: string }) {
  return (
    <Image
      src="/marca/logo-completo.webp"
      alt="Aquazaku"
      width={900}
      height={900}
      priority
      className={className}
    />
  )
}

/**
 * Isotipo + nombre, para la cabecera.
 *
 * El nombre va en texto y no en el wordmark de la marca: el wordmark tiene su
 * extrusión 3D y sus tonos oscuros del lado izquierdo, que a 17 px se embarran
 * y sobre fondo oscuro desaparecen. El texto con el gradiente de la cinta —la
 * misma secuencia del isotipo— se lee en los dos modos y a cualquier tamaño.
 *
 * Así funcionan los sistemas de marca de verdad: el lockup manda donde es
 * grande, y el chrome usa isotipo + texto.
 */
export function Marca({
  compacta = false,
  sobreOscuro = false,
}: {
  compacta?: boolean
  /**
   * Si la marca se apoya sobre una superficie oscura de marca.
   *
   * No se detecta solo, y no puede: el panel del menú es oscuro en los DOS
   * modos, así que ni el tema ni una media query lo saben. Lo sabe quien la
   * coloca.
   *
   * Cambia la cinta por su versión clara. Medido, la parada azul de la cinta
   * normal da 3,89:1 sobre el panel — las primeras letras quedan bajo AA sin
   * que se vea como un error, solo como un logo apagado.
   */
  sobreOscuro?: boolean
}) {
  return (
    <span className="flex items-center gap-2.5">
      <Isotipo className="h-7 w-auto shrink-0" decorativo />
      <span
        className={`bg-clip-text text-[17px] font-semibold tracking-tight text-transparent ${
          compacta ? 'sr-only sm:not-sr-only' : ''
        }`}
        style={{
          // `--aq-gradiente-nombre` ya sigue al tema. `sobreOscuro` fuerza la
          // versión clara para el panel de marca, que es oscuro en los DOS
          // modos y por lo tanto ninguna media query lo puede saber.
          backgroundImage: sobreOscuro
            ? 'var(--aq-gradiente-cinta-clara)'
            : 'var(--aq-gradiente-nombre)',
        }}
      >
        Aquazaku
      </span>
    </span>
  )
}
