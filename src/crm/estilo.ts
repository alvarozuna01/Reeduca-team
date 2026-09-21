/* ---- CRM: la paleta y la tipografía del CRM de la planilla ("Lu · Venta") ---- */

export const LU = {
  brand: '#6E93D2',
  brand2: '#5DADEA',
  grad: 'linear-gradient(135deg,#6E93D2 0%,#5DADEA 100%)',
  titulo: '#3F5A86',
  txt: '#3A4655',
  muted: '#8A94A6',
  linea: '#E6E8EA',
  venc: '#C63A2B',
  sem: '#F39221',
  ok: '#48A859',
  none: '#AEB6C2',
  accent: '#5DADEA',
  fondo: '#F4F7FB',
  fuente: "'Comfortaa', 'Poppins', system-ui, sans-serif",
}

/** Un color por etapa del embudo (los mismos de la planilla). */
const ETAPA_COLOR: Record<string, string> = {
  'CONTACTO INICIAL': '#AED6F1',
  'EN SEGUIMIENTO': '#A3E4D7',
  'LLEVAR PROPUESTA FÍSICA': '#F9E79F',
  'P.FÍSICA ENTREGADA': '#F5CBA7',
  'PROPUESTA ENVIADA': '#D2B4DE',
  'EN REVISIÓN/AJUSTE': '#F5B7B1',
  'CERRADO-GANADO': '#ABEBC6',
  'CERRADO-NO GANADO': '#D5DBDB',
}
export const etapaColor = (etapa: string) => ETAPA_COLOR[etapa.trim().toUpperCase()] ?? '#E5E8EA'

/** Curricular azul, Extracurricular verde, sin definir gris. */
export function modalidadColor(m: string) {
  if (m === 'Curricular') return { texto: '#2E6FB0', fondo: '#EAF2FB' }
  if (m === 'Extracurricular') return { texto: '#16A085', fondo: '#E6F6F2' }
  return { texto: '#8A8F98', fondo: '#F4F5F7' }
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** '2026-11-02' → '2 nov 2026' */
export function fechaTexto(iso: string | null) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso ?? ''
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`
}

/** Primer nombre de cada responsable: "Luciana, Malena". */
export const nombresCortos = (ids: string[], users: { id: string; name: string }[]) =>
  ids
    .map((id) => users.find((u) => u.id === id)?.name.split(' ')[0])
    .filter(Boolean)
    .join(', ')

/** Tipo de dato al arrastrar una acción de una institución a otra. */
export const ARRASTRE_ACCION = 'application/x-reeduca-accion'
