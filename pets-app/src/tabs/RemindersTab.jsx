import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import Sheet from '../components/Sheet.jsx'
import {
  daysUntil, relativeDays, fmtDate, todayStr, speciesMeta, UPCOMING_WINDOW_DAYS,
} from '../constants'

// Severity bucket from days-until value
function bucket(days) {
  if (days == null) return 'none'
  if (days < 0) return 'overdue'
  if (days <= 7) return 'soon'
  if (days <= UPCOMING_WINDOW_DAYS) return 'upcoming'
  return 'later'
}
const BADGE = { overdue: 'red', soon: 'amber', upcoming: 'sage', later: 'gray' }

export default function RemindersTab({ pets, onJump }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  const petById = (id) => pets.find((p) => p.id === id)

  const load = useCallback(async () => {
    setLoading(true)
    const petIds = pets.map((p) => p.id)
    if (petIds.length === 0) { setItems([]); setLoading(false); return }

    const [vax, meds, rem] = await Promise.all([
      supabase.from('vaccinations').select('*').in('pet_id', petIds).not('next_due', 'is', null),
      supabase.from('medications').select('*').in('pet_id', petIds).eq('active', true).not('refill_due', 'is', null),
      supabase.from('reminders').select('*').in('pet_id', petIds).eq('done', false),
    ])

    const all = []
    ;(vax.data || []).forEach((v) =>
      all.push({ key: 'vax-' + v.id, kind: 'Vaccine', label: v.name, due: v.next_due, pet_id: v.pet_id, icon: '💉' }))
    ;(meds.data || []).forEach((m) =>
      all.push({ key: 'med-' + m.id, kind: 'Med refill', label: m.name, due: m.refill_due, pet_id: m.pet_id, icon: '💊' }))
    ;(rem.data || []).forEach((r) =>
      all.push({ key: 'rem-' + r.id, kind: 'Reminder', label: r.title, due: r.due_date, pet_id: r.pet_id, icon: '🔔', remId: r.id }))

    all.sort((a, b) => (a.due || '').localeCompare(b.due || ''))
    setItems(all)
    setLoading(false)
  }, [pets])

  useEffect(() => { load() }, [load])

  const markDone = async (remId) => {
    await supabase.from('reminders').update({ done: true }).eq('id', remId)
    load()
  }

  if (pets.length === 0) {
    return (
      <div className="empty">
        <div className="big">🐾</div>
        <p>No pets yet. Add Ren &amp; Mav&rsquo;s pets in the <b>Pets</b> tab to start tracking.</p>
        <div className="spacer" />
        <button className="btn primary" onClick={() => onJump('pets')}>Go to Pets</button>
      </div>
    )
  }

  const overdue = items.filter((i) => bucket(daysUntil(i.due)) === 'overdue')
  const soon = items.filter((i) => bucket(daysUntil(i.due)) === 'soon')
  const upcoming = items.filter((i) => bucket(daysUntil(i.due)) === 'upcoming')
  const later = items.filter((i) => bucket(daysUntil(i.due)) === 'later')

  const Group = ({ title, list }) =>
    list.length === 0 ? null : (
      <>
        <div className="section-title">{title}</div>
        <div className="card" style={{ padding: '4px 16px' }}>
          {list.map((it) => {
            const pet = petById(it.pet_id)
            const b = bucket(daysUntil(it.due))
            return (
              <div className="row" key={it.key}>
                <div className="avatar" aria-hidden>
                  {pet?.photo_url
                    ? <img src={pet.photo_url} className="avatar" alt="" />
                    : speciesMeta(pet?.species).icon}
                </div>
                <div className="grow">
                  <div className="title">{it.label}</div>
                  <div className="sub">
                    {pet?.name} · {it.kind} · {fmtDate(it.due)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className={`badge ${BADGE[b]}`}>{relativeDays(it.due)}</span>
                  {it.remId && (
                    <button className="btn sm ghost" onClick={() => markDone(it.remId)}>Done</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </>
    )

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 4 }}>
        <button className="btn primary block" onClick={() => setAdding(true)}>+ Add reminder</button>
      </div>

      {loading ? (
        <div className="loading">Loading&hellip;</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="big">✓</div>
          <p>All caught up — nothing due.</p>
        </div>
      ) : (
        <>
          <Group title="Overdue" list={overdue} />
          <Group title="This week" list={soon} />
          <Group title={`Next ${UPCOMING_WINDOW_DAYS} days`} list={upcoming} />
          <Group title="Later" list={later} />
        </>
      )}

      {adding && (
        <AddReminder pets={pets} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />
      )}
    </>
  )
}

function AddReminder({ pets, onClose, onSaved }) {
  const [petId, setPetId] = useState(pets[0]?.id || '')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(todayStr())
  const [repeat, setRepeat] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    await supabase.from('reminders').insert({
      pet_id: petId || null,
      title: title.trim(),
      due_date: due,
      repeat_days: repeat ? Number(repeat) : null,
    })
    onSaved()
  }

  const QUICK = [
    { label: 'Flea / tick (monthly)', repeat: 30 },
    { label: 'Heartworm (monthly)', repeat: 30 },
    { label: 'Nail trim', repeat: 42 },
    { label: 'Grooming', repeat: 56 },
  ]

  return (
    <Sheet title="Add reminder" onClose={onClose}>
      <div className="field">
        <label>Pet</label>
        <select className="select" value={petId} onChange={(e) => setPetId(e.target.value)}>
          {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label>What</label>
        <input className="input" value={title} placeholder="e.g. Flea & tick dose"
          onChange={(e) => setTitle(e.target.value)} />
        <div className="chip-row" style={{ marginTop: 8 }}>
          {QUICK.map((q) => (
            <button key={q.label} className="chip"
              onClick={() => { setTitle(q.label.split(' (')[0]); setRepeat(String(q.repeat)) }}>
              {q.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Due date</label>
          <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="field">
          <label>Repeat every (days)</label>
          <input className="input" type="number" inputMode="numeric" value={repeat}
            placeholder="optional" onChange={(e) => setRepeat(e.target.value)} />
        </div>
      </div>
      <button className="btn primary block" disabled={saving || !title.trim()} onClick={save}>
        {saving ? 'Saving…' : 'Save reminder'}
      </button>
    </Sheet>
  )
}
