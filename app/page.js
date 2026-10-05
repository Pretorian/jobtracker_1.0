'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import JobTracker from '@/components/JobTracker'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api'

const STAT_DEFS = [
  { key: 'total', label: 'Tracked', color: '#E2E8F0' },
  { key: 'applied', label: 'Applied', color: '#60A5FA' },
  { key: 'interviews', label: 'Interviews', color: '#A78BFA' },
  { key: 'offers', label: 'Offers', color: '#34D399' },
]

export default function Home() {
  const router = useRouter()
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({ total: 0, applied: 0, interviews: 0, offers: 0 })
  const [menuOpen, setMenuOpen] = useState(false)

  const menuRef = useRef(null)
  const menuBtnRef = useRef(null)

  useEffect(() => {
    checkAuth()
  }, [])

  // Close the user menu on Escape and outside click; restore focus to its trigger.
  useEffect(() => {
    if (!menuOpen) return

    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        menuBtnRef.current?.focus()
      }
    }
    const onClick = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [menuOpen])

  const checkAuth = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setAuthenticated(true)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      router.push('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading application"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#030A14',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            aria-hidden="true"
            style={{
              width: '50px',
              height: '50px',
              border: '4px solid #1A2E45',
              borderTop: '4px solid #3B82F6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: '#94A3B8' }}>Loading…</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (!authenticated) {
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="app-header" role="banner">
        <div className="app-header__brand">
          <a href="/" className="app-header__logo" aria-label="Job Tracker home">
            <span style={{ fontSize: 18, fontWeight: 800, color: '#E2E8F0', letterSpacing: '-0.02em' }}>Job</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#3B82F6', letterSpacing: '-0.02em' }}>Tracker</span>
            <span
              className="app-header__version"
              aria-label="version 2.0.0 beta 4"
              style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, fontFamily: "'DM Mono', monospace", marginLeft: 6 }}
            >
              v1.0.0-beta.7
            </span>
          </a>

          <dl
            id="app-stats"
            className="app-header__stats"
            aria-label="Job tracking statistics"
            aria-live="polite"
            aria-atomic="false"
          >
            {STAT_DEFS.map((s) => (
              <div key={s.key} className="app-header__stat">
                <dt className="app-header__stat-label">{s.label}</dt>
                <dd className="app-header__stat-val" style={{ color: s.color }}>
                  {stats[s.key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="app-header__user">
          <span className="app-header__welcome">
            Signed in as&nbsp;<strong>{user?.username}</strong>
          </span>
          <a href="/settings" className="app-header__link">
            Settings
          </a>
          <button type="button" onClick={handleLogout} className="app-header__logout">
            Logout
          </button>

          {/* Mobile-only menu trigger */}
          <button
            ref={menuBtnRef}
            type="button"
            className="app-header__menu-btn"
            aria-label={menuOpen ? 'Close user menu' : 'Open user menu'}
            aria-haspopup="menu"
            aria-controls="app-user-menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        <div
          ref={menuRef}
          id="app-user-menu"
          className="app-header__menu"
          role="menu"
          aria-label="Account menu"
          hidden={!menuOpen}
        >
          <div className="app-header__menu-user" role="presentation">
            Signed in as <strong>{user?.username}</strong>
          </div>
          <a href="/settings" className="app-header__menu-link" role="menuitem">
            <span aria-hidden="true">⚙️&nbsp;</span>Settings
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="app-header__menu-link app-header__menu-link--danger"
            role="menuitem"
          >
            <span aria-hidden="true">↩&nbsp;</span>Logout
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <JobTracker onStatsChange={setStats} />
      </div>
    </div>
  )
}
