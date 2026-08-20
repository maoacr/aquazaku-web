import { VistaDeAuditoria } from '@/components/auditoria/vista-auditoria'
import { unoSolo } from '@/lib/query'

/**
 * Auditoría del `contador`.
 *
 * Vive dentro del route group `(app)` —que no agrega segmento a la URL— para
 * heredar el guard de sesión y el shell. Una página de auditoría colgando de la
 * raíz sería una pantalla sin autenticar.
 *
 * Renderiza la misma vista que la del admin: los dos ven lo mismo y el alcance
 * lo decide `api/`. Duplicar el contenido crearía dos pantallas que se
 * desincronizan; lo único propio de cada rol es la ruta por la que se entra.
 */
export default async function AuditoriaContadorPage({
  searchParams,
}: PageProps<'/contador/auditoria'>) {
  const params = await searchParams

  return (
    <VistaDeAuditoria
      ruta="/contador/auditoria"
      filtros={{
        action: unoSolo(params.action),
        resource: unoSolo(params.resource),
        result: unoSolo(params.result),
        userId: unoSolo(params.userId),
        desde: unoSolo(params.desde),
        hasta: unoSolo(params.hasta),
        cursor: unoSolo(params.cursor),
      }}
    />
  )
}
