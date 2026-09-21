import { TIPOS_ACCION } from './tipos'

const GRUPOS = [
  { id: 'nuestro', label: 'Contacto nuestro' },
  { id: 'lnr', label: 'LNR (aparte de ventas)' },
  { id: 'respuesta', label: 'Respuesta del colegio' },
] as const

/** Las opciones del tipo de acción, agrupadas como en la planilla (para un <select>). */
export default function OpcionesTipo({ actual }: { actual: string }) {
  return (
    <>
      {!TIPOS_ACCION.some((t) => t.id === actual) && <option value={actual}>{actual || '—'}</option>}
      {GRUPOS.map((g) => (
        <optgroup key={g.id} label={g.label}>
          {TIPOS_ACCION.filter((t) => t.grupo === g.id).map((t) => (
            <option key={t.id} value={t.id}>
              {t.icono} {t.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
