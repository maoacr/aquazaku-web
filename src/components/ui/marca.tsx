/**
 * Isotipo de Aquazaku: tres gotas, azul → aqua → verde.
 *
 * Redibujado como SVG desde `claude-design/disenos/assets/aquazaku-isotipo.png`,
 * que pesa 9,7 MB — un header no manda diez megas para pintar 28 píxeles.
 *
 * Las tres ondas de adentro se dejan solo en la gota del medio. A 28 px, nueve
 * ondas son ruido gris: el ojo lee «tres gotas con algo adentro», que es lo que
 * tiene que leer.
 *
 * El orden de los colores no es decorativo — es de dónde sale el gradiente de
 * marca, y por eso la línea del header repite la misma secuencia: el agua que
 * entra azul y sale potable.
 */
export function Isotipo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 32"
      className={className}
      role="img"
      aria-label="Aquazaku"
      fill="none"
    >
      <Gota x={0} color="var(--aq-primaria-600)" />
      <Gota x={12} color="var(--aq-acento-500)" ondas />
      <Gota x={24} color="var(--aq-exito-500)" />
    </svg>
  )
}

function Gota({ x, color, ondas = false }: { x: number; color: string; ondas?: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {/* Gota: punta arriba, cuerpo redondo abajo. */}
      <path
        d="M10 1 C10 1 19 12.5 19 19 A9 9 0 0 1 1 19 C1 12.5 10 1 10 1 Z"
        fill={color}
      />
      {ondas ? (
        <g stroke="var(--aq-neutro-0)" strokeWidth="1.6" strokeLinecap="round" opacity=".92">
          <path d="M5 17.5c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0" />
          <path d="M5 21.5c1.7-1.6 3.3-1.6 5 0s3.3 1.6 5 0" />
        </g>
      ) : null}
    </g>
  )
}

/** Isotipo + nombre. El nombre se oculta donde no entra, el isotipo nunca. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Isotipo />
      <span
        className={`text-[17px] font-semibold tracking-tight text-principal ${
          compacta ? 'sr-only sm:not-sr-only' : ''
        }`}
      >
        Aquazaku
      </span>
    </span>
  )
}
