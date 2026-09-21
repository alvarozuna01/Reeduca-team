import { Handshake } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { Avatar } from '../components/Avatar'
import { useCrm } from './contexto'

/**
 * Quién tiene acceso al CRM. Lo administran los Gerentes; el candado es real
 * (la base de datos no le muestra nada del CRM a quien no esté en la lista).
 */
export default function AccesoCRM() {
  const { users, currentUser, isAdmin } = useApp()
  const { accesos, darAcceso, quitarAcceso } = useCrm()
  const con = (id: string) => accesos.some((a) => a.userId === id)

  const cambiar = (id: string, nombre: string) => {
    if (!con(id)) return darAcceso(id)
    if (id === currentUser?.id && !confirm('Si te quitás el acceso, dejás de ver el CRM. ¿Seguro?')) return
    if (id !== currentUser?.id && !confirm(`¿Quitarle el acceso al CRM a ${nombre}?`)) return
    quitarAcceso(id)
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-blue-50">
          <Handshake size={15} className="text-blue-600" />
        </span>
        <div>
          <h3 className="leading-tight font-extrabold text-slate-700">Configuración · Acceso al CRM</h3>
          <p className="text-[11px] font-semibold text-slate-400">
            Solo estas personas ven la pestaña CRM y sus acciones en la Agenda. Los demás no pueden ver nada del CRM,
            ni siquiera por fuera de la pantalla.
          </p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-extrabold text-blue-700">
          {users.filter((u) => con(u.id)).length} con acceso
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((u) => {
          const activo = con(u.id)
          return (
            <button
              key={u.id}
              disabled={!isAdmin}
              onClick={() => cambiar(u.id, u.name)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed ${
                activo ? 'border-blue-200 bg-blue-50/60' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <Avatar user={u} size={28} />
              <span className={`min-w-0 flex-1 truncate text-sm font-bold ${activo ? 'text-slate-700' : 'text-slate-400'}`}>{u.name}</span>
              <span
                className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                  activo ? 'justify-end bg-blue-600' : 'justify-start bg-slate-200'
                }`}
              >
                <span className="size-4 rounded-full bg-white shadow-sm" />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
