import type { User } from '../types'

/** Minúsculas y sin tildes, para comparar nombres como los escribe la gente. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export interface Mencion {
  inicio: number // índice de la @
  fin: number // índice justo después del nombre
  user: User
}

const esLetra = (c: string | undefined) => !!c && /[\p{L}\p{N}]/u.test(c)

/**
 * Encuentra las menciones "@Nombre" de un texto. Las menciones se guardan como
 * texto plano (lo que se ve es lo que se guarda), así que se reconocen por nombre:
 * primero el nombre completo —el más largo gana, "@Luciana Gomez" antes que
 * "@Luciana"— y si no, el primer nombre cuando es único en el equipo ("@Malena").
 * Una @ pegada a una letra (un email) no cuenta.
 */
export function encontrarMenciones(texto: string, users: User[]): Mencion[] {
  if (!texto.includes('@')) return []

  const completos = users
    .map((u) => ({ u, nombre: u.name.trim() }))
    .filter((c) => c.nombre)
    .sort((a, b) => b.nombre.length - a.nombre.length)

  const conteoPrimero = new Map<string, number>()
  for (const c of completos) {
    const p = normalizar(c.nombre.split(/\s+/)[0])
    conteoPrimero.set(p, (conteoPrimero.get(p) ?? 0) + 1)
  }
  const primeros = completos
    .map((c) => ({ u: c.u, nombre: c.nombre.split(/\s+/)[0] }))
    .filter((c) => c.nombre !== c.u.name.trim() && conteoPrimero.get(normalizar(c.nombre)) === 1)
    .sort((a, b) => b.nombre.length - a.nombre.length)

  const coincide = (i: number, nombre: string) =>
    normalizar(texto.slice(i + 1, i + 1 + nombre.length)) === normalizar(nombre) &&
    !esLetra(texto[i + 1 + nombre.length])

  const res: Mencion[] = []
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== '@' || esLetra(texto[i - 1])) continue
    const c = completos.find((x) => coincide(i, x.nombre)) ?? primeros.find((x) => coincide(i, x.nombre))
    if (!c) continue
    res.push({ inicio: i, fin: i + 1 + c.nombre.length, user: c.u })
    i += c.nombre.length
  }
  return res
}

/** ¿Este texto menciona a esta persona? */
export const mencionaA = (texto: string | null | undefined, userId: string, users: User[]) =>
  !!texto && encontrarMenciones(texto, users).some((m) => m.user.id === userId)
