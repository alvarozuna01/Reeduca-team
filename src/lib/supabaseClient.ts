import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Cliente de Supabase, o null si la app corre en modo demo (sin .env). */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
