import { Umbrales } from '@/components/alertas/umbrales'
import { SelloDeHora } from '@/components/ui/sello-de-hora'
import { apiServerFetch } from '@/lib/api-server'
import type { Parametro } from '@/lib/api-types'

/**
 * Alertas — M12.
 *
 * Los umbrales que deciden cuándo el sistema avisa. `RN-STK-11`: el número
 * correcto depende de la rotación real, y esa se mide usando el sistema — así
 * que moverlo no puede exigir un despliegue.
 */
export default async function AlertasPage() {
  const parametros = await apiServerFetch<Parametro[]>('/parametros')

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="aq-titulo-pantalla text-principal">Alertas</h1>
        <p className="text-[15px] text-secundario">
          Cuándo avisa el sistema. Un aviso que llega tarde no sirve; uno que llega demasiado
          pronto enseña a ignorarlo, que es peor.
        </p>
      </header>

      <Umbrales parametros={parametros} />

      {/*
        Cambiar un umbral queda en la bitácora con el valor anterior. Decirlo acá
        no es una advertencia: es para que quien lo mueva sepa que después va a
        poder explicar por qué.
      */}
      <p className="text-[13px] text-tenue">
        Cada cambio queda registrado en la auditoría, con el valor anterior y el nuevo.
      </p>

      <SelloDeHora leidoEn={new Date()} />
    </div>
  )
}
