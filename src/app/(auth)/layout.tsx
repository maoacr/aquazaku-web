import { LogoCompleto } from '@/components/ui/marca'

/**
 * Layout de las pantallas SIN sesión: login y recuperación de contraseña.
 *
 * Es el complemento de `(app)/layout.tsx`. Ese exige sesión y redirige a
 * `/login`; este no puede exigirla, porque es donde se entra. Tenerlos
 * separados es justamente para qué sirven los route groups: dos layouts
 * distintos sobre el mismo nivel de URL.
 *
 * ── Es LA superficie de marca del sistema (D3) ──────────────────────────────
 *
 * El gradiente de marca va acá y en ningún otro lado. Adentro de la app compite
 * con las cifras; acá no hay cifras, hay una puerta. Es el único momento en que
 * alguien mira Aquazaku y no está tratando de hacer otra cosa.
 *
 * ── Por qué el vidrio recién funciona en esta pantalla ──────────────────────
 *
 * Una lámina de vidrio no se ve por ser translúcida: se ve por lo que deja
 * pasar. Sobre un gris plano, `backdrop-filter` desenfoca un gris plano y el
 * resultado es un rectángulo gris con opacidad.
 *
 * Por eso los dos orbes de abajo. Están desenfocados a propósito y no se leen
 * como formas — son manchas de color que la lámina refracta, y son lo que hace
 * que el panel parezca vidrio y no plástico.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden p-6">
      {/* El gradiente de marca: las tres hondas del isotipo, en diagonal. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20"
        style={{ background: 'var(--aq-gradiente-marca)' }}
      />

      {/*
        Los orbes. `blur-3xl` los deja como luz y no como círculos, y el
        `mix-blend-screen` los suma al gradiente en vez de taparlo.
      */}
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -left-24 -top-24 size-[28rem] rounded-full opacity-45 mix-blend-screen blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--aq-marca-azul-media), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-20 size-[32rem] rounded-full opacity-40 mix-blend-screen blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--aq-marca-verde-media), transparent 70%)' }}
        />
        <div
          className="absolute left-1/2 top-1/3 size-[24rem] -translate-x-1/2 rounded-full opacity-30 mix-blend-screen blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--aq-marca-aqua-media), transparent 70%)' }}
        />
      </div>

      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/*
          El lockup completo, que es el arte real de la marca. Acá es grande y
          protagonista, que es exactamente donde tiene sentido usarlo: en la
          cabecera, a 28 px, su wordmark con extrusión se embarra.
        */}
        <LogoCompleto className="w-44 drop-shadow-2xl" />

        {/*
          El panel. `text-principal` adentro y no un color fijo: la lámina se
          adapta al tema —clara en modo claro, ahumada en oscuro— y el texto
          tiene que seguirla.
        */}
        <div className="aq-vidrio aq-vidrio-panel w-full rounded-2xl p-6 text-principal">{children}</div>
      </div>
    </div>
  )
}
