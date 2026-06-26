import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  // Surfaces a clear message instead of a cryptic network error during setup.
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
}

export const supabase = createClient(url, key)

export const FUNCTIONS_URL = `${url}/functions/v1`
