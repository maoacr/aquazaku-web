/**
 * Índice de `/modulos`.
 *
 * Existe para que entrar a `/modulos` a mano no dé 404 mientras sus hijos
 * (`/modulos/usuarios`, `/modulos/auditoria`) llegan en Task 13. No lista los
 * módulos: eso ya lo hace el sidebar, que es el que sabe los roles.
 */
export default function ModulosPage() {
  return (
    <div>
      <h1 className="aq-titulo-pantalla text-principal">Módulos</h1>
      <p className="mt-2 text-sm text-tenue">Elija un módulo del menú lateral.</p>
    </div>
  )
}
