import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when both env vars are present. The UI shows setup help when false. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// Only construct the client when configured so the app can still render a
// friendly "add your Supabase keys" screen instead of throwing on boot.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null
