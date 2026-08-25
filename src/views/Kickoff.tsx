import { Rocket } from 'lucide-react'

/**
 * Kickoff semanal (Módulo C). Esta pantalla está detrás de la llave
 * FEATURE_KICKOFF: solo la ven los usuarios con la llave prendida.
 * Fase 2: placeholder. La maqueta llega en la Fase 3.
 */
export default function Kickoff() {
  return (
    <div className="grid h-full place-items-center p-6 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50">
          <Rocket size={26} className="text-blue-600" />
        </span>
        <p className="mt-4 text-lg font-black text-slate-700">Kickoff semanal</p>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          En construcción. Solo vos ves esta pestaña: está detrás de la llave beta.
        </p>
      </div>
    </div>
  )
}
