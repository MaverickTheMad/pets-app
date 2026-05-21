import { useState, useEffect, useCallback } from 'react'
import { supabase, DOCS_BUCKET } from '../supabase'
import Sheet from '../components/Sheet.jsx'
import { DOC_TYPES, speciesMeta, fmtDate, fmtMoney, todayStr } from '../constants'

export default function DocsTab({ pets }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')   // 'all' | pet.id | 'household'
  const [adding, setAdding] = useState(false)

  const petById = (id) => pets.find((p) => p.id === id)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('documents').select('*').order('doc_date', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const del = async (doc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return
    await supabase.from('documents').delete().eq('id', doc.id)
    load()
  }

  const shown = docs.filter((d) =>
    filter === 'all' ? true : filter === 'household' ? !d.pet_id : d.pet_id === filter)

  const typeLabel = (v) => DOC_TYPES.find((t) => t.value === v)?.label || 'Other'

  // Receipt/invoice total for the current filter
  const total = shown
    .filter((d) => ['receipt', 'invoice'].includes(d.doc_type) && d.amount != null)
    .reduce((s, d) => s + Number(d.amount), 0)

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 10 }}>
        <button className="btn primary block" onClick={() => setAdding(true)}>+ Add document</button>
      </div>

      <div className="chip-row" style={{ marginBottom: 4 }}>
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All</button>
        {pets.map((p) => (
          <button key={p.id} className={`chip ${filter === p.id ? 'on' : ''}`} onClick={() => setFilter(p.id)}>
            {speciesMeta(p.species).icon} {p.name}
          </button>
        ))}
        <button className={`chip ${filter === 'household' ? 'on' : ''}`} onClick={() => setFilter('household')}>Household</button>
      </div>

      {total > 0 && (
        <div className="kv" style={{ padding: '8px 4px 4px' }}>
          <span className="k">Receipts total{filter !== 'all' ? ' (filtered)' : ''}</span>
          <span style={{ fontWeight: 600 }}>{fmtMoney(total)}</span>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading&hellip;</div>
      ) : shown.length === 0 ? (
        <div className="empty">
          <div className="big">📄</div>
          <p>No documents yet. Upload vet receipts, invoices, lab results, or adoption papers.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {shown.map((d) => {
            const pet = petById(d.pet_id)
            return (
              <div className="row" key={d.id}>
                <div className="grow">
                  <div className="title">{d.title}</div>
                  <div className="sub">
                    {pet ? `${pet.name} · ` : 'Household · '}{typeLabel(d.doc_type)} · {fmtDate(d.doc_date)}
                    {d.amount != null ? ` · ${fmtMoney(d.amount)}` : ''}
                  </div>
                </div>
                {d.file_url && (
                  <a className="btn sm ghost" href={d.file_url} target="_blank" rel="noreferrer">Open</a>
                )}
                <button className="row-icon-btn" onClick={() => del(d)}>✕</button>
              </div>
            )
          })}
        </div>
      )}

      {adding && (
        <AddDoc pets={pets} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}
    </>
  )
}

function AddDoc({ pets, onClose, onSaved }) {
  const [f, setF] = useState({
    pet_id: '', title: '', doc_type: 'receipt', doc_date: todayStr(), amount: '', notes: '', file_url: '',
  })
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const upload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setFileName(file.name)
    try {
      const safe = file.name.replace(/[^\w.\-]/g, '_')
      const path = `docs/${Date.now()}-${safe}`
      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path)
      set('file_url', data.publicUrl)
      if (!f.title) set('title', file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      console.error(err); alert('Upload failed — make sure the pet-docs bucket exists and is public.')
    }
    setUploading(false)
  }

  const save = async () => {
    if (!f.title.trim()) return
    setSaving(true)
    await supabase.from('documents').insert({
      pet_id: f.pet_id || null,
      title: f.title.trim(),
      doc_type: f.doc_type,
      doc_date: f.doc_date,
      amount: f.amount ? Number(f.amount) : null,
      file_url: f.file_url || null,
      notes: f.notes || null,
    })
    onSaved()
  }

  const showAmount = ['receipt', 'invoice'].includes(f.doc_type)

  return (
    <Sheet title="Add document" onClose={onClose}>
      <div className="field">
        <label>File</label>
        <label className="btn ghost block" style={{ justifyContent: 'flex-start' }}>
          {uploading ? 'Uploading…' : f.file_url ? `✓ ${fileName}` : '📎 Choose file (PDF or photo)'}
          <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={upload} />
        </label>
        <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>Optional — you can log a record without a file.</div>
      </div>

      <div className="field"><label>Title</label>
        <input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Annual checkup invoice" /></div>

      <div className="field-row">
        <div className="field"><label>Pet</label>
          <select className="select" value={f.pet_id} onChange={(e) => set('pet_id', e.target.value)}>
            <option value="">Household / general</option>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
        <div className="field"><label>Type</label>
          <select className="select" value={f.doc_type} onChange={(e) => set('doc_type', e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select></div>
      </div>

      <div className="field-row">
        <div className="field"><label>Date</label>
          <input className="input" type="date" value={f.doc_date} onChange={(e) => set('doc_date', e.target.value)} /></div>
        {showAmount && (
          <div className="field"><label>Amount</label>
            <input className="input" type="number" inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" /></div>
        )}
      </div>

      <div className="field"><label>Notes</label>
        <textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>

      <button className="btn primary block" disabled={saving || uploading || !f.title.trim()} onClick={save}>
        {saving ? 'Saving…' : 'Save document'}
      </button>
    </Sheet>
  )
}
