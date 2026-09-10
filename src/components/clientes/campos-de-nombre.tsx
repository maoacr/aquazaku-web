'use client'

/**
 * Cómo se nombra a un cliente — RN-CLI-17.
 *
 * ── El formulario cambia con el tipo de cliente, y tiene que hacerlo ─────────
 *
 * «Panadería del Centro» no tiene primer nombre ni apellidos. Un formulario que
 * le pida «apellidos» a un negocio obliga a inventar un dato — y lo que pasa de
 * verdad es que alguien escribe «Panadería» en «primer nombre» y «del Centro»
 * en «apellidos», y ahí el dato quedó peor que antes.
 *
 * Así que hay una sola pregunta que decide todo lo demás: ¿es una persona o un
 * negocio? De ahí sale qué campos se muestran, y `api/` valida exactamente lo
 * mismo con un CHECK en la base detrás.
 *
 * ── Por qué un componente y no los campos escritos en cada formulario ───────
 *
 * Porque son dos: el alta completa y el alta rápida del mostrador. Dos copias
 * de las mismas etiquetas se separan solas — es exactamente lo que este
 * proyecto ya vivió con los campos de formulario, y por lo que existe
 * `.aq-campo`.
 *
 * ── Los dos modos de cableado ───────────────────────────────────────────────
 *
 * Con `onCambio` es controlado y NO emite `name`. Ese es el modo del alta
 * rápida, que vive dentro de un `<dialog>` que a su vez cuelga del formulario
 * de la venta: ahí un campo con `name` viajaría en el `FormData` de la venta.
 *
 * Sin `onCambio` es un formulario normal y emite `name`, que es lo que el resto
 * del sistema usa.
 */

export interface Nombre {
  nombreLibre: string
  primerNombre: string
  segundoNombre: string
  apellidos: string
  apodo: string
}

export const NOMBRE_VACIO: Nombre = {
  nombreLibre: '',
  primerNombre: '',
  segundoNombre: '',
  apellidos: '',
  apodo: '',
}

/** Lo que viaja a `api/`: sin las cadenas vacías, que la base rechaza. */
export function soloLoEscrito(n: Nombre): Partial<Nombre> {
  return Object.fromEntries(
    Object.entries(n)
      .map(([campo, valor]) => [campo, valor.trim()])
      .filter(([, valor]) => valor !== ''),
  )
}

/** Si falta lo mínimo para que `api/` lo acepte. Adelanta el rechazo, no lo reemplaza. */
export function faltaElNombre(tipo: 'residencial' | 'comercial', n: Nombre): boolean {
  return tipo === 'comercial'
    ? n.nombreLibre.trim() === ''
    : n.primerNombre.trim() === '' || n.apellidos.trim() === ''
}

export function CamposDeNombre({
  tipo,
  valor,
  onCambio,
}: {
  tipo: 'residencial' | 'comercial'
  /** El estado, en modo controlado. */
  valor?: Nombre
  /** Presente = controlado y sin `name`. Ausente = formulario normal. */
  onCambio?: (n: Nombre) => void
}) {
  const controlado = onCambio !== undefined
  const v = valor ?? NOMBRE_VACIO

  const campo = (nombre: keyof Nombre) =>
    controlado
      ? { value: v[nombre], onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCambio({ ...v, [nombre]: e.target.value }) }
      : { name: nombre }

  if (tipo === 'comercial') {
    return (
      <label className="aq-etiqueta-campo sm:col-span-2">
        <span>Nombre del negocio</span>
        <input
          {...campo('nombreLibre')}
          autoComplete="off"
          placeholder="Panadería del Centro"
          className="aq-campo"
        />
        <span className="mt-1 font-normal normal-case text-[13px] text-tenue">
          Como aparece en el letrero. Un negocio no lleva apellidos.
        </span>
      </label>
    )
  }

  return (
    <>
      <label className="aq-etiqueta-campo">
        <span>Primer nombre</span>
        <input {...campo('primerNombre')} autoComplete="off" placeholder="Rosa" className="aq-campo" />
      </label>

      <label className="aq-etiqueta-campo">
        <span>
          Segundo nombre <span className="font-normal normal-case">(opcional)</span>
        </span>
        <input {...campo('segundoNombre')} autoComplete="off" placeholder="Elena" className="aq-campo" />
      </label>

      <label className="aq-etiqueta-campo sm:col-span-2">
        <span>Apellidos</span>
        <input
          {...campo('apellidos')}
          autoComplete="off"
          placeholder="Padilla Gómez"
          className="aq-campo"
        />
      </label>

      {/*
        El apodo NO es un adorno.

        En Campo de la Cruz a la gente se la ubica por el apodo: quien atiende el
        mostrador escucha «vengo de parte de la Cuca» mucho antes que un
        apellido. Sin este campo, ese dato se metía dentro del nombre —«Rosa (la
        de la esquina)»— y ensuciaba el nombre que va en una factura.
      */}
      <label className="aq-etiqueta-campo sm:col-span-2">
        <span>
          Apodo <span className="font-normal normal-case">(opcional)</span>
        </span>
        <input {...campo('apodo')} autoComplete="off" placeholder="Doña Rosa" className="aq-campo" />
        <span className="mt-1 font-normal normal-case text-[13px] text-tenue">
          Como la conocen. Sirve para encontrarla; no sale en la factura.
        </span>
      </label>
    </>
  )
}
