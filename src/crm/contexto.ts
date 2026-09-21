import { createContext, useContext } from 'react'
import type { CrmAccion, CrmContacto, CrmDB, CrmInstitucion, CrmOportunidad } from './tipos'

export interface CrmCtx extends CrmDB {
  cargando: boolean
  /** ¿El usuario actual está en la lista de acceso al CRM? */
  tieneAcceso: boolean
  guardarInstitucion: (i: CrmInstitucion, detalle?: string) => void
  guardarOportunidad: (o: CrmOportunidad, detalle?: string) => void
  guardarContacto: (c: CrmContacto) => void
  borrarContacto: (c: CrmContacto) => void
  /** Guarda y anota en la bitácora qué cambió. */
  guardarAccion: (a: CrmAccion) => void
  borrarAccion: (a: CrmAccion) => void
  darAcceso: (userId: string) => void
  quitarAcceso: (userId: string) => void
  /** Ventanas que se abren desde cualquier pantalla (también desde la Agenda). */
  abrirAccion: (a: CrmAccion | NuevaAccion) => void
  abrirFicha: (institucionId: string) => void
  abrirNuevaInstitucion: () => void
}

/** Datos para arrancar una acción nueva (la ventana completa el resto). */
export interface NuevaAccion {
  nueva: true
  institucionId: string
  oportunidadId?: string | null
  esLnr?: boolean
  fecha?: string | null
}

export const CrmContexto = createContext<CrmCtx | null>(null)

export function useCrm(): CrmCtx {
  const ctx = useContext(CrmContexto)
  if (!ctx) throw new Error('useCrm debe usarse dentro de <CrmProvider>')
  return ctx
}
