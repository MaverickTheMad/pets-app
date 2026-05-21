import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'
import RemindersTab from './tabs/RemindersTab.jsx'
import PetsTab from './tabs/PetsTab.jsx'
import DocsTab from './tabs/DocsTab.jsx'

const TABS = [
  { id: 'reminders', label: 'Reminders', icon: '🔔' },
  { id: 'pets',      label: 'Pets',      icon: '🐾' },
  { id: 'docs',      label: 'Documents', icon: '📄' },
]

export default function App() {
  const [tab, setTab] = useState('reminders')
  const [theme, setTheme] = useState(() => localStorage.getItem('pets_theme') || 'auto')
  const [pets, setPets] = useState([])
  const [loading, setLoading] = useState(true)

  // theme handling
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    if (theme === 'dark') root.classList.add('theme-dark')
    if (theme === 'light') root.classList.add('theme-light')
    localStorage.setItem('pets_theme', theme)
  }, [theme])

  const cycleTheme = () =>
    setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'))

  const loadPets = useCallback(async () => {
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: true })
    if (!error) setPets(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadPets() }, [loadPets])

  const themeIcon = theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ren <span className="amp">&amp;</span> Mav&rsquo;s Pets</h1>
        <button className="theme-toggle" onClick={cycleTheme} aria-label="Toggle theme">
          {themeIcon}
        </button>
      </header>

      <div className="content">
        {loading ? (
          <div className="loading">Loading&hellip;</div>
        ) : tab === 'reminders' ? (
          <RemindersTab pets={pets} onJump={setTab} />
        ) : tab === 'pets' ? (
          <PetsTab pets={pets} reloadPets={loadPets} />
        ) : (
          <DocsTab pets={pets} />
        )}
      </div>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="ic">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
