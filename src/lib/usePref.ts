import { useState } from 'react'

/** Preferencia booleana que se recuerda en este navegador (ej: ocultar completadas). */
export function usePref(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const storageKey = 'reeduca-pref-' + key
  const [value, setValue] = useState<boolean>(() => {
    const saved = localStorage.getItem(storageKey)
    return saved === null ? initial : saved === '1'
  })
  const set = (v: boolean) => {
    setValue(v)
    localStorage.setItem(storageKey, v ? '1' : '0')
  }
  return [value, set]
}
