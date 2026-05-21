import { useState, useEffect, useCallback } from 'react'
import { supabase, DOCS_BUCKET } from '../supabase'
import Sheet from '../components/Sheet.jsx'
import {
  SPECIES, COMMON_VACCINES, speciesMeta, ageFromBirthday, fmtDate, fmtMoney,
  relativeDays, daysUntil, todayStr,
} from '../constants'

export default function PetsTab({ pets, reloadPets }) {
  const [openPet, setOpenPet] = useState(null)
  const [editing, setEditing] = useState(false)

  return (
    <>
      <div className="btn-row" style={{ marginBottom: 8 }}>
        <button className="btn primary block" onClick={() => setEditing('new')}>+ Add a pet</button>
      </div>

      {pets.length === 0 ? (
        <div className="empty">
          <div className="big">🐾</div>
          <p>No pets yet — add your first furry family member.</p>
        </div>
      ) : (
        pets.map((p) => {
          const meta = speciesMeta(p.species)
          return (
            <div className="card tap" key={p.id} onClick={() => setOpenPet(p)}>
              <div className="row" style={{ padding: 0, borderBottom: 'none' }}>
                {p.photo_url
                  ? <img src={p.photo_url} className="avatar lg" alt={p.name} />
                  : <div className="avatar lg">{meta.icon}</div>}
                <div className="grow">
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 22 }}>{p.name}</div>
                  <div className="sub">
                    {meta.label}{p.breed ? ` · ${p.breed}` : ''}
                    {p.birthday ? ` · ${ageFromBirthday(p.birthday)}${p.birthday_estimated ? ' (est.)' : ''}` : ''}
                  </div>
                </div>
                <span className="faint" style={{ fontSize: 22 }}>›</span>
              </div>
            </div>
          )
        })
      )}

      {openPet && (
        <PetDetail
          pet={openPet}
          onClose={() => setOpenPet(null)}
          onEdit={() => { setEditing(openPet); setOpenPet(null) }}
          reloadPets={reloadPets}
        />
      )}

      {editing && (
        <PetEditor
          pet={editing === 'new' ? null : editing}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); reloadPets() }}
        />
      )}
    </>
  )
}

/* ============================================================
   PET DETAIL — profile + all sub-records
   ============================================================ */
function PetDetail({ pet, onClose, onEdit, reloadPets }) {
  const meta = speciesMeta(pet.species)
  const [data, setData] = useState({ weights: [], vax: [], meds: [], conds: [], visits: [] })
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState(null) // which add-sheet is open

  const load = useCallback(async () => {
    const [weights, vax, meds, conds, visits] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('pet_id', pet.id).order('weighed_on', { ascending: false }),
      supabase.from('vaccinations').select('*').eq('pet_id', pet.id).order('next_due', { ascending: true, nullsFirst: false }),
      supabase.from('medications').select('*').eq('pet_id', pet.id).order('active', { ascending: false }),
      supabase.from('conditions').select('*').eq('pet_id', pet.id),
      supabase.from('vet_visits').select('*').eq('pet_id', pet.id).order('visit_date', { ascending: false }),
    ])
    setData({
      weights: weights.data || [], vax: vax.data || [], meds: meds.data || [],
      conds: conds.data || [], visits: visits.data || [],
    })
    setLoading(false)
  }, [pet.id])

  useEffect(() => { load() }, [load])

  const del = async (table, id) => {
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  const latestWeight = data.weights[0]
  const allergies = data.conds.filter((c) => c.kind === 'allergy')
  const conditions = data.conds.filter((c) => c.kind === 'condition')

  return (
    <Sheet onClose={onClose}>
      {/* header */}
      <div className="row" style={{ borderBottom: 'none', paddingTop: 0 }}>
        {pet.photo_url
          ? <img src={pet.photo_url} className="avatar lg" alt={pet.name} />
          : <div className="avatar lg">{meta.icon}</div>}
        <div className="grow">
          <div style={{ fontFamily: 'var(--serif)', fontSize: 26 }}>{pet.name}</div>
          <div className="sub">
            {meta.label}{pet.breed ? ` · ${pet.breed}` : ''}
            {pet.sex ? ` · ${pet.sex}` : ''}{pet.fixed ? ' · fixed' : ''}
          </div>
        </div>
        <button className="btn sm ghost" onClick={onEdit}>Edit</button>
      </div>

      {/* quick facts */}
      <div className="card">
        {pet.birthday && (
          <div className="kv"><span className="k">Age</span>
            <span>{ageFromBirthday(pet.birthday)}{pet.birthday_estimated ? ' (est.)' : ''} · {fmtDate(pet.birthday)}</span></div>
        )}
        {pet.adoption_date && <div className="kv"><span className="k">Adopted</span><span>{fmtDate(pet.adoption_date)}</span></div>}
        {pet.color && <div className="kv"><span className="k">Color / markings</span><span>{pet.color}</span></div>}
        {latestWeight && <div className="kv"><span className="k">Weight</span><span>{latestWeight.weight_lbs} lbs · {fmtDate(latestWeight.weighed_on)}</span></div>}
        {pet.microchip && <div className="kv"><span className="k">Microchip</span><span>{pet.microchip}</span></div>}
        {pet.vet_name && <div className="kv"><span className="k">Vet</span><span>{pet.vet_name}</span></div>}
        {pet.vet_phone && <div className="kv"><span className="k">Vet phone</span><a href={`tel:${pet.vet_phone}`}>{pet.vet_phone}</a></div>}
        {(pet.food_brand || pet.food_amount) && (
          <div className="kv"><span className="k">Food</span><span>{[pet.food_brand, pet.food_amount].filter(Boolean).join(' · ')}</span></div>
        )}
        {pet.notes && <><div className="divider" /><div className="muted" style={{ fontSize: 14 }}>{pet.notes}</div></>}
      </div>

      {loading ? <div className="loading">Loading records&hellip;</div> : (
        <>
          {/* allergies/conditions */}
          {(allergies.length > 0 || conditions.length > 0) && (
            <div className="card">
              {allergies.length > 0 && (
                <div style={{ marginBottom: conditions.length ? 10 : 0 }}>
                  <div className="sub" style={{ marginBottom: 6 }}>Allergies</div>
                  <div className="chip-row">
                    {allergies.map((a) => (
                      <span key={a.id} className="badge red" onClick={() => del('conditions', a.id)}>{a.name} ✕</span>
                    ))}
                  </div>
                </div>
              )}
              {conditions.length > 0 && (
                <>
                  <div className="sub" style={{ marginBottom: 6 }}>Conditions</div>
                  <div className="chip-row">
                    {conditions.map((c) => (
                      <span key={c.id} className="badge amber" onClick={() => del('conditions', c.id)}>{c.name} ✕</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <SubSection title="Vaccinations" onAdd={() => setSub('vax')}>
            {data.vax.length === 0 ? <Empty text="No vaccines logged" /> : data.vax.map((v) => {
              const d = daysUntil(v.next_due)
              const bcls = d == null ? 'gray' : d < 0 ? 'red' : d <= 30 ? 'amber' : 'green'
              return (
                <div className="row" key={v.id}>
                  <div className="grow">
                    <div className="title">{v.name}</div>
                    <div className="sub">
                      {v.date_given ? `Given ${fmtDate(v.date_given)}` : 'No date'}
                      {v.next_due ? ` · due ${fmtDate(v.next_due)}` : ''}
                    </div>
                  </div>
                  {v.next_due && <span className={`badge ${bcls}`}>{relativeDays(v.next_due)}</span>}
                  <button className="row-icon-btn" onClick={() => del('vaccinations', v.id)}>✕</button>
                </div>
              )
            })}
          </SubSection>

          <SubSection title="Medications" onAdd={() => setSub('med')}>
            {data.meds.length === 0 ? <Empty text="No medications" /> : data.meds.map((m) => (
              <div className="row" key={m.id}>
                <div className="grow">
                  <div className="title">{m.name} {!m.active && <span className="badge gray">inactive</span>}</div>
                  <div className="sub">
                    {[m.dose, m.frequency].filter(Boolean).join(' · ')}
                    {m.refill_due ? ` · refill ${fmtDate(m.refill_due)}` : ''}
                  </div>
                </div>
                <button className="row-icon-btn" onClick={() => del('medications', m.id)}>✕</button>
              </div>
            ))}
          </SubSection>

          <SubSection title="Vet visits" onAdd={() => setSub('visit')}>
            {data.visits.length === 0 ? <Empty text="No visits logged" /> : data.visits.map((v) => (
              <div className="row" key={v.id}>
                <div className="grow">
                  <div className="title">{v.reason || 'Visit'}</div>
                  <div className="sub">{fmtDate(v.visit_date)}{v.vet ? ` · ${v.vet}` : ''}</div>
                </div>
                {v.cost != null && <span className="badge sage">{fmtMoney(v.cost)}</span>}
                <button className="row-icon-btn" onClick={() => del('vet_visits', v.id)}>✕</button>
              </div>
            ))}
          </SubSection>

          <SubSection title="Weight log" onAdd={() => setSub('weight')}>
            {data.weights.length === 0 ? <Empty text="No weights yet" /> : (
              <>
                <WeightSparkline weights={data.weights} />
                {data.weights.slice(0, 6).map((w) => (
                  <div className="row" key={w.id}>
                    <div className="grow">
                      <div className="title">{w.weight_lbs} lbs</div>
                      <div className="sub">{fmtDate(w.weighed_on)}{w.notes ? ` · ${w.notes}` : ''}</div>
                    </div>
                    <button className="row-icon-btn" onClick={() => del('weight_logs', w.id)}>✕</button>
                  </div>
                ))}
              </>
            )}
          </SubSection>

          <SubSection title="Allergy / condition" onAdd={() => setSub('cond')} compact />
        </>
      )}

      {sub && (
        <AddRecord
          kind={sub} pet={pet}
          onClose={() => setSub(null)}
          onSaved={() => { setSub(null); load() }}
        />
      )}
    </Sheet>
  )
}

const Empty = ({ text }) => <div className="faint" style={{ padding: '10px 0', fontSize: 14 }}>{text}</div>

function SubSection({ title, onAdd, children, compact }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 4px 8px' }}>
        <div className="section-title" style={{ margin: 0 }}>{title}</div>
        <button className="btn sm ghost" onClick={onAdd}>+ Add</button>
      </div>
      {!compact && <div className="card" style={{ padding: '4px 16px' }}>{children}</div>}
    </>
  )
}

// Tiny inline SVG sparkline of weight over time
function WeightSparkline({ weights }) {
  if (weights.length < 2) return null
  const pts = [...weights].reverse() // oldest → newest
  const vals = pts.map((w) => Number(w.weight_lbs))
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const W = 280, H = 48, pad = 4
  const coords = pts.map((w, i) => {
    const x = pad + (i / (pts.length - 1)) * (W - pad * 2)
    const y = H - pad - ((Number(w.weight_lbs) - min) / range) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <div style={{ padding: '8px 0 4px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 48 }}>
        <polyline points={coords} fill="none" stroke="var(--sage)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="faint center" style={{ fontSize: 12 }}>{min} – {max} lbs</div>
    </div>
  )
}

/* ============================================================
   ADD RECORD — one sheet handles vax / med / visit / weight / cond
   ============================================================ */
function AddRecord({ kind, pet, onClose, onSaved }) {
  const [f, setF] = useState({
    name: '', date_given: todayStr(), next_due: '', dose: '', frequency: '',
    refill_due: '', reason: '', visit_date: todayStr(), vet: pet.vet_name || '',
    cost: '', weight_lbs: '', weighed_on: todayStr(), kindSel: 'allergy', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const titles = { vax: 'Add vaccination', med: 'Add medication', visit: 'Add vet visit', weight: 'Add weight', cond: 'Add allergy / condition' }

  const save = async () => {
    setSaving(true)
    try {
      if (kind === 'vax') {
        await supabase.from('vaccinations').insert({
          pet_id: pet.id, name: f.name.trim(), date_given: f.date_given || null,
          next_due: f.next_due || null, notes: f.notes || null,
        })
      } else if (kind === 'med') {
        await supabase.from('medications').insert({
          pet_id: pet.id, name: f.name.trim(), dose: f.dose || null, frequency: f.frequency || null,
          refill_due: f.refill_due || null, notes: f.notes || null,
        })
      } else if (kind === 'visit') {
        await supabase.from('vet_visits').insert({
          pet_id: pet.id, reason: f.reason || null, visit_date: f.visit_date,
          vet: f.vet || null, cost: f.cost ? Number(f.cost) : null, notes: f.notes || null,
        })
      } else if (kind === 'weight') {
        await supabase.from('weight_logs').insert({
          pet_id: pet.id, weight_lbs: Number(f.weight_lbs), weighed_on: f.weighed_on, notes: f.notes || null,
        })
      } else if (kind === 'cond') {
        await supabase.from('conditions').insert({
          pet_id: pet.id, kind: f.kindSel, name: f.name.trim(), notes: f.notes || null,
        })
      }
      onSaved()
    } catch (e) {
      console.error(e); setSaving(false)
    }
  }

  const valid =
    (kind === 'vax' && f.name.trim()) ||
    (kind === 'med' && f.name.trim()) ||
    (kind === 'visit') ||
    (kind === 'weight' && f.weight_lbs) ||
    (kind === 'cond' && f.name.trim())

  return (
    <Sheet title={titles[kind]} onClose={onClose}>
      {kind === 'vax' && (
        <>
          <div className="field">
            <label>Vaccine</label>
            <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Rabies" />
            <div className="chip-row" style={{ marginTop: 8 }}>
              {(COMMON_VACCINES[pet.species] || []).map((v) => (
                <button key={v} className={`chip ${f.name === v ? 'on' : ''}`} onClick={() => set('name', v)}>{v}</button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <div className="field"><label>Date given</label>
              <input className="input" type="date" value={f.date_given} onChange={(e) => set('date_given', e.target.value)} /></div>
            <div className="field"><label>Next due</label>
              <input className="input" type="date" value={f.next_due} onChange={(e) => set('next_due', e.target.value)} /></div>
          </div>
        </>
      )}

      {kind === 'med' && (
        <>
          <div className="field"><label>Medication</label>
            <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Apoquel" /></div>
          <div className="field-row">
            <div className="field"><label>Dose</label>
              <input className="input" value={f.dose} onChange={(e) => set('dose', e.target.value)} placeholder="50mg" /></div>
            <div className="field"><label>Frequency</label>
              <input className="input" value={f.frequency} onChange={(e) => set('frequency', e.target.value)} placeholder="1x daily" /></div>
          </div>
          <div className="field"><label>Refill due</label>
            <input className="input" type="date" value={f.refill_due} onChange={(e) => set('refill_due', e.target.value)} /></div>
        </>
      )}

      {kind === 'visit' && (
        <>
          <div className="field"><label>Reason</label>
            <input className="input" value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="Annual checkup" /></div>
          <div className="field-row">
            <div className="field"><label>Date</label>
              <input className="input" type="date" value={f.visit_date} onChange={(e) => set('visit_date', e.target.value)} /></div>
            <div className="field"><label>Cost</label>
              <input className="input" type="number" inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} placeholder="0.00" /></div>
          </div>
          <div className="field"><label>Vet / clinic</label>
            <input className="input" value={f.vet} onChange={(e) => set('vet', e.target.value)} /></div>
        </>
      )}

      {kind === 'weight' && (
        <div className="field-row">
          <div className="field"><label>Weight (lbs)</label>
            <input className="input" type="number" inputMode="decimal" value={f.weight_lbs} onChange={(e) => set('weight_lbs', e.target.value)} /></div>
          <div className="field"><label>Date</label>
            <input className="input" type="date" value={f.weighed_on} onChange={(e) => set('weighed_on', e.target.value)} /></div>
        </div>
      )}

      {kind === 'cond' && (
        <>
          <div className="field">
            <label>Type</label>
            <div className="chip-row">
              <button className={`chip ${f.kindSel === 'allergy' ? 'on' : ''}`} onClick={() => set('kindSel', 'allergy')}>Allergy</button>
              <button className={`chip ${f.kindSel === 'condition' ? 'on' : ''}`} onClick={() => set('kindSel', 'condition')}>Condition</button>
            </div>
          </div>
          <div className="field"><label>Name</label>
            <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Chicken, or Arthritis" /></div>
        </>
      )}

      <div className="field"><label>Notes</label>
        <textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>

      <button className="btn primary block" disabled={saving || !valid} onClick={save}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </Sheet>
  )
}

/* ============================================================
   PET EDITOR — create / edit profile (with photo upload)
   ============================================================ */
function PetEditor({ pet, onClose, onSaved }) {
  const [f, setF] = useState({
    name: pet?.name || '', species: pet?.species || 'dog', breed: pet?.breed || '',
    sex: pet?.sex || '', fixed: pet?.fixed || false, birthday: pet?.birthday || '',
    birthday_estimated: pet?.birthday_estimated || false, adoption_date: pet?.adoption_date || '',
    color: pet?.color || '', microchip: pet?.microchip || '', photo_url: pet?.photo_url || '',
    vet_name: pet?.vet_name || '', vet_phone: pet?.vet_phone || '', vet_address: pet?.vet_address || '',
    food_brand: pet?.food_brand || '', food_amount: pet?.food_amount || '', notes: pet?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `photos/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from(DOCS_BUCKET).getPublicUrl(path)
      set('photo_url', data.publicUrl)
    } catch (err) {
      console.error(err); alert('Photo upload failed — check the pet-docs bucket exists.')
    }
    setUploading(false)
  }

  const save = async () => {
    if (!f.name.trim()) return
    setSaving(true)
    const payload = { ...f, name: f.name.trim(), birthday: f.birthday || null, adoption_date: f.adoption_date || null }
    if (pet) await supabase.from('pets').update(payload).eq('id', pet.id)
    else await supabase.from('pets').insert(payload)
    onSaved()
  }

  const archive = async () => {
    if (!pet) return
    if (!confirm(`Archive ${pet.name}? They'll be hidden but records are kept.`)) return
    await supabase.from('pets').update({ archived: true }).eq('id', pet.id)
    onSaved()
  }

  return (
    <Sheet title={pet ? `Edit ${pet.name}` : 'Add a pet'} onClose={onClose}>
      <div className="center" style={{ marginBottom: 12 }}>
        {f.photo_url
          ? <img src={f.photo_url} className="avatar lg" alt="" style={{ margin: '0 auto' }} />
          : <div className="avatar lg" style={{ margin: '0 auto' }}>{speciesMeta(f.species).icon}</div>}
        <div className="spacer" />
        <label className="btn sm ghost" style={{ display: 'inline-flex' }}>
          {uploading ? 'Uploading…' : f.photo_url ? 'Change photo' : 'Add photo'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPhoto} />
        </label>
      </div>

      <div className="field"><label>Name</label>
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>

      <div className="field">
        <label>Species</label>
        <div className="chip-row">
          {SPECIES.map((s) => (
            <button key={s.value} className={`chip ${f.species === s.value ? 'on' : ''}`} onClick={() => set('species', s.value)}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <div className="field"><label>Breed</label>
          <input className="input" value={f.breed} onChange={(e) => set('breed', e.target.value)} /></div>
        <div className="field"><label>Sex</label>
          <select className="select" value={f.sex} onChange={(e) => set('sex', e.target.value)}>
            <option value="">—</option><option value="male">Male</option><option value="female">Female</option>
          </select></div>
      </div>

      <div className="field-row">
        <div className="field"><label>Birthday</label>
          <input className="input" type="date" value={f.birthday} onChange={(e) => set('birthday', e.target.value)} /></div>
        <div className="field"><label>Adopted</label>
          <input className="input" type="date" value={f.adoption_date} onChange={(e) => set('adoption_date', e.target.value)} /></div>
      </div>

      <div className="field" style={{ display: 'flex', gap: 18 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
          <input type="checkbox" checked={f.fixed} onChange={(e) => set('fixed', e.target.checked)} /> Spayed / neutered
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: 0 }}>
          <input type="checkbox" checked={f.birthday_estimated} onChange={(e) => set('birthday_estimated', e.target.checked)} /> Age estimated
        </label>
      </div>

      <div className="field"><label>Color / markings</label>
        <input className="input" value={f.color} onChange={(e) => set('color', e.target.value)} /></div>
      <div className="field"><label>Microchip #</label>
        <input className="input" value={f.microchip} onChange={(e) => set('microchip', e.target.value)} /></div>

      <div className="divider" />
      <div className="field"><label>Vet / clinic</label>
        <input className="input" value={f.vet_name} onChange={(e) => set('vet_name', e.target.value)} /></div>
      <div className="field-row">
        <div className="field"><label>Vet phone</label>
          <input className="input" type="tel" value={f.vet_phone} onChange={(e) => set('vet_phone', e.target.value)} /></div>
      </div>

      <div className="divider" />
      <div className="field-row">
        <div className="field"><label>Food brand</label>
          <input className="input" value={f.food_brand} onChange={(e) => set('food_brand', e.target.value)} /></div>
        <div className="field"><label>Amount / schedule</label>
          <input className="input" value={f.food_amount} onChange={(e) => set('food_amount', e.target.value)} placeholder="1 cup 2x/day" /></div>
      </div>
      <div className="field"><label>Notes</label>
        <textarea className="textarea" value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>

      <button className="btn primary block" disabled={saving || !f.name.trim()} onClick={save}>
        {saving ? 'Saving…' : pet ? 'Save changes' : 'Add pet'}
      </button>
      {pet && <><div className="spacer" /><button className="btn danger block" onClick={archive}>Archive {pet.name}</button></>}
    </Sheet>
  )
}
