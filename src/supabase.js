import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// All Pets data lives in the "pets" schema of the shared reilly.live
// Supabase project. No .from() calls need to change.
export const supabase = createClient(url, key, { db: { schema: 'pets' } })
export const DOCS_BUCKET = 'pet-docs'
