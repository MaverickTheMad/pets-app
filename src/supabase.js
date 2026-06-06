import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// All Pets data lives in the `pets` schema of the shared reilly-home project.
// With db.schema set, no .from() call needs the schema prefix.
export const supabase = createClient(url, key, { db: { schema: 'pets' } })

// One bucket for both pet photos and documents — under the pet-docs/ prefix.
export const DOCS_BUCKET = 'pet-docs'
