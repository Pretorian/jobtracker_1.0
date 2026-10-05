'use client'

import { useEffect, useRef, useState } from 'react'

// Dev-only overlay toggle for a11y.css (https://github.com/ffoodd/a11y.css).
// The stylesheets are copied from node_modules into public/a11y/ by `npm run a11y:sync`.
// Each level is cumulative: warnings include errors, the full build adds obsoletes + advice.
const LEVELS = [
  { id: 'off', label: 'Off', file: null },
  { id: 'errors', label: 'Errors only', file: '/a11y/a11y-en_error.css' },
  { id: 'warnings', label: 'Errors + warnings', file: '/a11y/a11y-en_warning.css' },
  { id: 'obsoletes', label: '+ obsolete markup', file: '/a11y/a11y-en_obsolete.css' },
  { id: 'all', label: 'Everything (incl. advice)', file: '/a11y/a11y-en.css' },
]

const STORAGE_KEY = 'a11y-audit-level'
const LINK_ID = 'a11y-css-audit'

export default function A11yAudit() {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState('off')
  const panelRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && LEVELS.some((l) => l.id === saved)) setLevel(saved)
  }, [])

  useEffect(() => {
    const def = LEVELS.find((l) => l.id === level)
    let link = document.getElementById(LINK_ID)
    if (!def?.file) {
      link?.remove()
    } else {
      if (!link) {
        link = document.createElement('link')
        link.id = LINK_ID
        link.rel = 'stylesheet'
        document.head.appendChild(link)
      }
      if (link.getAttribute('href') !== def.file) link.setAttribute('href', def.file)
    }
    window.localStorage.setItem(STORAGE_KEY, level)
  }, [level])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    const onClick = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (process.env.NODE_ENV === 'production') return null

  const active = level !== 'off'

  return (
    <div className="a11y-audit">
      <button
        ref={btnRef}
        type="button"
        className={`a11y-audit__toggle${active ? ' a11y-audit__toggle--active' : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="a11y-audit-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden="true">♿</span> a11y.css
        {active && <span className="a11y-audit__badge">{LEVELS.find((l) => l.id === level)?.label}</span>}
      </button>

      <div ref={panelRef} id="a11y-audit-panel" className="a11y-audit__panel" hidden={!open}>
        <fieldset className="a11y-audit__fieldset">
          <legend className="a11y-audit__legend">Accessibility audit overlay</legend>
          {LEVELS.map((l) => (
            <label key={l.id} className="a11y-audit__option">
              <input
                type="radio"
                name="a11y-audit-level"
                value={l.id}
                checked={level === l.id}
                onChange={() => setLevel(l.id)}
              />
              {l.label}
            </label>
          ))}
        </fieldset>
        <p className="a11y-audit__hint">
          Flagged elements get a coloured outline; hover them to read the message. The counter in the
          top-left corner sums up issues on the page.
        </p>
      </div>
    </div>
  )
}
