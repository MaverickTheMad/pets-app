import { useCallback, useEffect, useState } from 'react'
import './App.css'
import { supabase } from './supabase.js'
import { PawMark, IconBell, IconPaw, IconDoc } from './components/Icons.jsx'
import RemindersTab from './tabs/RemindersTab.jsx'
import PetsTab from './tabs/PetsTab.jsx'
import DocsTab from './tabs/DocsTab.jsx'

const TABS = [
  { id: 'reminders', label: 'Reminders', Icon: IconBell },
  { id: 'pets',      label: 'Pets',      Icon: IconPaw  },
  { id: 'docs',      label: 'Documents', Icon: IconDoc  },
]

export default function App() {
  const [tab, setTab] = useState('reminders')
  const [theme, setTheme] = useState(
    () => localStorage.getItem('pets_theme') || 'auto',
  )
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Theme handling: auto (system) or forced light/dark.
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    if (theme === 'dark') root.classList.add('theme-dark')
    if (theme === 'light') root.classList.add('theme-light')
    localStorage.setItem('pets_theme', theme)
  }, [theme])

  const loadPets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: true })
      if (error) throw error
      setPets(data || [])
      setError('')
    } catch (e) {
      setError(e.message || 'Could not load pets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPets() }, [loadPets])

  const cycleTheme = () =>
    setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))
  const themeIcon = theme === 'auto' ? '🌗' : theme === 'light' ? '☀️' : '🌙'

  if (loading) {
    return (
      <div className="app">
        <div className="empty full">
          <div className="big">⏳</div>
          <p>Loading&hellip;</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <div className="empty full">
          <div className="big">⚠️</div>
          <h3>Couldn&rsquo;t load</h3>
          <p>{error}</p>
          <button className="btn primary" onClick={loadPets}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-head">
        <div className="wordmark">
          <PawMark size={26} />
          <span className="grove-name">Pets</span>
        </div>
        <div className="head-actions">
          <button className="icon-btn" onClick={cycleTheme} aria-label="Theme">
            {themeIcon}
          </button>
        </div>
      </header>

      <main className="app-main">
        {tab === 'reminders' && (
          <RemindersTab pets={pets} onJump={setTab} />
        )}
        {tab === 'pets' && (
          <PetsTab pets={pets} reloadPets={loadPets} />
        )}
        {tab === 'docs' && (
          <DocsTab pets={pets} />
        )}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <t.Icon size={22} />
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
