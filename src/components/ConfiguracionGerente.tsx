import { ArrowDown, ArrowUp, Settings } from 'lucide-react'
import { useApp } from '../state/AppContext'
import AccesoCRM from '../crm/AccesoCRM'

/**
 * Configuración del Gerente. Por ahora: el orden de los proyectos, que es el
 * orden en que todo el equipo los ve en la lista al cargar una tarea.
 */
export default function ConfiguracionGerente() {
  const { projects, reordenarProyectos } = useApp()

  const mover = (i: number, delta: -1 | 1) => {
    const j = i + delta
    if (j < 0 || j >= projects.length) return
    const ids = projects.map((p) => p.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reordenarProyectos(ids)
  }

  return (
    <>
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-slate-100">
          <Settings size={15} className="text-slate-500" />
        </span>
        <div>
          <h3 className="leading-tight font-extrabold text-slate-700">Configuración · Orden de los proyectos</h3>
          <p className="text-[11px] font-semibold text-slate-400">
            Es el orden en que todo el equipo ve los proyectos en la lista al cargar una tarea. El primero sale
            elegido por defecto.
          </p>
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
        {projects.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-5 text-right text-xs font-extrabold text-slate-300">{i + 1}</span>
            <span className="size-3.5 shrink-0 rounded-md" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-600">{p.name}</span>
            <button
              onClick={() => mover(i, -1)}
              disabled={i === 0}
              title="Subir"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ArrowUp size={15} />
            </button>
            <button
              onClick={() => mover(i, 1)}
              disabled={i === projects.length - 1}
              title="Bajar"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ArrowDown size={15} />
            </button>
          </div>
        ))}
        {projects.length === 0 && (
          <p className="py-5 text-center text-sm font-semibold text-slate-300">Todavía no hay proyectos.</p>
        )}
      </div>
    </section>
    <AccesoCRM />
    </>
  )
}
