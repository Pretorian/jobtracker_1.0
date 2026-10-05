'use client'

import { useState, useEffect, useCallback } from "react"

// ─── API helpers ──────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api'

async function fetchJobs() {
  const res = await fetch(`${API_BASE}/jobs`, {
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch jobs')
  return res.json()
}

async function parseJob(urlOrText) {
  const res = await fetch(`${API_BASE}/jobs/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: urlOrText }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to parse job')
  return res.json()
}

async function createJob(jobData) {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jobData),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to create job')
  return res.json()
}

async function updateJob(id, updates) {
  const res = await fetch(`${API_BASE}/jobs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to update job')
  return res.json()
}

async function deleteJob(id) {
  const res = await fetch(`${API_BASE}/jobs/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to delete job')
  return res.json()
}

async function generateResume(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/resume`, {
    method: 'POST',
    credentials: 'include'
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to generate resume')
  return data
}

async function generateOptimizedResume(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/resume/optimized`, { method: 'POST', credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to generate optimized resume')
  return data
}

async function generateCoverLetter(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cover-letter`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to generate cover letter')
  return res.json()
}

async function autoApplyPreview(jobId, userData = null) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/auto-apply/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userData }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to generate auto-apply preview')
  return res.json()
}

async function autoApply(jobId, userData = null, fieldMapping = null) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/auto-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userData, fieldMapping, autoSubmit: false, dryRun: false }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to auto-apply')
  return res.json()
}

async function batchAutoApply(jobIds, autoSubmit = false, userData = null) {
  const res = await fetch(`${API_BASE}/jobs/batch-auto-apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobIds, autoSubmit, userData }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to run batch auto-apply')
  return res.json()
}

async function reevaluateFit(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/reevaluate`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to re-evaluate fit')
  return res.json()
}

async function getGapAnalysis(jobId, { refresh = false } = {}) {
  const url = `${API_BASE}/jobs/${jobId}/gap-analysis${refresh ? '?refresh=true' : ''}`
  const res = await fetch(url, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to get gap analysis')
  return res.json()
}

async function compareResumes(jobId1, jobId2) {
  const res = await fetch(`${API_BASE}/jobs/compare-resumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId1, jobId2 }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to compare resumes')
  return res.json()
}

async function getJobDocuments(jobId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/documents`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch documents')
  return res.json()
}

async function deleteResumeVersion(jobId, versionId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/documents/resume/${versionId}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to delete resume version')
  return res.json()
}

async function deleteCoverLetterVersion(jobId, versionId) {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/documents/cover-letter/${versionId}`, {
    method: 'DELETE',
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to delete cover letter version')
  return res.json()
}

async function previewDocument(filePath) {
  const res = await fetch(`${API_BASE}/jobs/preview?path=${encodeURIComponent(filePath)}`, { credentials: 'include' })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.error || `Preview failed (HTTP ${res.status})`)
  }
  return res.json()
}

async function diffDocument(filePath) {
  const res = await fetch(`${API_BASE}/jobs/diff?path=${encodeURIComponent(filePath)}`, { credentials: 'include' })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.error || `Diff failed (HTTP ${res.status})`)
  }
  return data
}

async function getSuggestedRoles() {
  const res = await fetch(`${API_BASE}/resume/suggest-roles`, { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to get role suggestions')
  return res.json()
}

async function getAnalytics() {
  const res = await fetch(`${API_BASE}/jobs/analytics/overview`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to get analytics')
  return res.json()
}

async function exportCSV() {
  window.open(`${API_BASE}/jobs/analytics/export?format=csv`, '_blank')
}

async function runAutoSearch(criteria) {
  const res = await fetch(`${API_BASE}/search/auto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(criteria)
  })
  if (!res.ok) throw new Error('Failed to run auto-search')
  return res.json()
}

async function importSelectedJobs(jobs) {
  const res = await fetch(`${API_BASE}/search/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs })
  })
  if (!res.ok) throw new Error('Failed to import jobs')
  return res.json()
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUSES = [
  { key: "saved",      label: "Saved",       color: "#6B7280", bg: "#1F2937" },
  { key: "applied",    label: "Applied",     color: "#3B82F6", bg: "#1E3A5F" },
  { key: "screening",  label: "Screening",   color: "#F59E0B", bg: "#3D2E05" },
  { key: "interview",  label: "Interview",   color: "#8B5CF6", bg: "#2D1B6B" },
  { key: "offer",      label: "Offer",       color: "#10B981", bg: "#0A3D2E" },
  { key: "rejected",   label: "Rejected",    color: "#EF4444", bg: "#3D1515" },
  { key: "withdrawn",  label: "Withdrawn",   color: "#9CA3AF", bg: "#1A1A1A" },
]

const statusMap = Object.fromEntries(STATUSES.map(s => [s.key, s]))

function daysAgo(dateStr) {
  if (!dateStr) return null
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "Today"
  if (d === 1) return "Yesterday"
  return `${d}d ago`
}

function needsFollowUp(job) {
  if (!["applied", "screening"].includes(job.status)) return false
  if (!job.appliedDate) return false
  const diff = Math.floor((Date.now() - new Date(job.appliedDate).getTime()) / 86400000)
  return diff >= 7 && !job.lastContact
}

// ─── Components ───────────────────────────────────────────────────────────────

function FitBadge({ score }) {
  const color = score >= 80 ? "#10B981" : score >= 60 ? "#F59E0B" : "#EF4444"
  const label = score >= 80 ? "Strong Fit" : score >= 60 ? "Good Fit" : "Stretch"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, color, fontFamily: "monospace"
      }}>{score}</div>
      <span style={{ fontSize: 11, color, fontWeight: 600, letterSpacing: "0.05em" }}>{label}</span>
    </div>
  )
}

function StatusPill({ status, small }) {
  const s = statusMap[status] || statusMap.saved
  return (
    <span style={{
      display: "inline-block",
      padding: small ? "2px 8px" : "4px 12px",
      borderRadius: 20,
      fontSize: small ? 10 : 12,
      fontWeight: 700,
      letterSpacing: "0.06em",
      color: s.color,
      background: s.bg,
      border: `1px solid ${s.color}33`,
      textTransform: "uppercase"
    }}>{s.label}</span>
  )
}

function SkillTag({ skill }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 9px", borderRadius: 4,
      background: "#0F1923", border: "1px solid #2A3F54",
      fontSize: 11, color: "#7DD3FC", fontFamily: "'DM Mono', monospace"
    }}>{skill}</span>
  )
}

function JobCard({ job, onSelect, selected, onReparse, onReevaluate, onStatusChange, batchMode = false, batchSelected = false, onBatchToggle }) {
  const urgent = needsFollowUp(job)
  const [swipeStart, setSwipeStart] = useState(null)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState(null)

  const statusOrder = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]
  const currentIndex = statusOrder.indexOf(job.status)

  const handleReparse = async (e) => {
    e.stopPropagation() // Prevent card selection
    if (!job.url) {
      alert("This job has no URL to reparse.")
      return
    }
    if (onReparse) {
      await onReparse(job.id, job.url)
    }
  }

  const handleReevaluate = async (e) => {
    e.stopPropagation() // Prevent card selection
    if (onReevaluate) {
      await onReevaluate(job.id)
    }
  }

  const handleSwipeStart = (e) => {
    // Don't start swipe if clicking on buttons
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
      return
    }

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
    setSwipeStart(clientX)
    setSwipeOffset(0)
    setSwipeDirection(null)
  }

  const handleSwipeMove = (e) => {
    if (swipeStart === null) return

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX
    const offset = clientX - swipeStart
    setSwipeOffset(offset)

    // Determine direction and next status
    if (Math.abs(offset) > 20) {
      if (offset > 0) {
        // Swipe right - next status
        const nextIndex = Math.min(currentIndex + 1, statusOrder.length - 1)
        setSwipeDirection({ direction: 'right', status: statusOrder[nextIndex] })
      } else {
        // Swipe left - previous status
        const prevIndex = Math.max(currentIndex - 1, 0)
        setSwipeDirection({ direction: 'left', status: statusOrder[prevIndex] })
      }
    } else {
      setSwipeDirection(null)
    }
  }

  const handleSwipeEnd = async () => {
    if (swipeStart === null) return

    // Threshold for triggering status change
    if (Math.abs(swipeOffset) > 80 && swipeDirection) {
      // Status change!
      if (onStatusChange && swipeDirection.status !== job.status) {
        await onStatusChange(job.id, swipeDirection.status)
      }
    }

    // Reset
    setSwipeStart(null)
    setSwipeOffset(0)
    setSwipeDirection(null)
  }

  const nextStatusInfo = swipeDirection ? statusMap[swipeDirection.status] : null

  return (
    <div
      role="listitem"
      tabIndex={0}
      aria-label={`Job: ${job.title} at ${job.company}, fit score ${job.fitScore || 0}`}
      aria-selected={selected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(job)
        }
      }}
      onMouseDown={handleSwipeStart}
      onMouseMove={handleSwipeMove}
      onMouseUp={handleSwipeEnd}
      onMouseLeave={handleSwipeEnd}
      onTouchStart={handleSwipeStart}
      onTouchMove={handleSwipeMove}
      onTouchEnd={handleSwipeEnd}
      style={{
        background: selected ? "#0D2035" : "#0A1628",
        border: `1px solid ${selected ? "#3B82F6" : urgent ? "#F59E0B44" : "#1A2E45"}`,
        borderRadius: 12,
        padding: "16px 18px",
        cursor: swipeStart !== null ? "grabbing" : "pointer",
        transition: swipeStart !== null ? "none" : "all 0.15s",
        position: "relative",
        overflow: "visible",
        outline: "2px solid transparent",
        outlineOffset: "2px",
        transform: `translateX(${Math.max(-100, Math.min(100, swipeOffset * 0.3))}px)`,
        userSelect: "none"
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid #3B82F6"
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "2px solid transparent"
      }}
    >
      {/* Swipe indicator */}
      {swipeDirection && Math.abs(swipeOffset) > 40 && (
        <div style={{
          position: "absolute",
          top: "50%",
          [swipeDirection.direction === 'right' ? 'left' : 'right']: 8,
          transform: "translateY(-50%)",
          background: nextStatusInfo.bg,
          border: `1px solid ${nextStatusInfo.color}`,
          borderRadius: 6,
          padding: "4px 12px",
          fontSize: 10,
          fontWeight: 700,
          color: nextStatusInfo.color,
          letterSpacing: "0.06em",
          pointerEvents: "none",
          zIndex: 10,
          opacity: Math.min(1, Math.abs(swipeOffset) / 80)
        }}>
          {swipeDirection.direction === 'right' ? '→' : '←'} {nextStatusInfo.label.toUpperCase()}
        </div>
      )}
      <div onClick={() => !batchMode && onSelect(job)}>
        {/* Batch selection checkbox */}
        {batchMode && (
          <div style={{
            position: "absolute", top: 12, left: 12, zIndex: 20
          }}>
            <label
              htmlFor={`batch-select-${job.id}`}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                width: 24,
                height: 24,
                background: batchSelected ? "#1E3A8A" : "#0A1628",
                border: `2px solid ${batchSelected ? "#60A5FA" : "#3B82F6"}`,
                borderRadius: 6
              }}
            >
              <input
                id={`batch-select-${job.id}`}
                type="checkbox"
                checked={batchSelected}
                aria-label={`Select ${job.title} at ${job.company} for batch auto-apply`}
                onChange={(e) => {
                  e.stopPropagation()
                  if (onBatchToggle) onBatchToggle(job.id)
                }}
                style={{
                  margin: 0,
                  cursor: "pointer",
                  width: 16,
                  height: 16,
                  accentColor: "#60A5FA"
                }}
              />
            </label>
          </div>
        )}
        {urgent && (
          <div style={{
            position: "absolute", top: 0, right: 0,
            background: "#F59E0B", color: "#000", fontSize: 9,
            fontWeight: 800, padding: "3px 10px",
            borderBottomLeftRadius: 8, letterSpacing: "0.1em"
          }}>FOLLOW UP</div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingLeft: batchMode ? 32 : 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginBottom: 2 }}>{job.title}</div>
            <div style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>{job.company}</div>
          </div>
          <FitBadge score={job.fitScore || 0} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusPill status={job.status} small />
            <button type="button"
              onClick={handleReparse}
              aria-label={job.url ? `Reparse ${job.title} at ${job.company} from URL` : `Cannot reparse ${job.title} - no URL saved`}
              title={job.url ? "Reparse job from URL" : "No URL to reparse"}
              style={{
                padding: "3px 6px",
                background: job.url ? "#0A1A2E" : "#1A1A1A",
                border: `1px solid ${job.url ? "#8B5CF6" : "#374151"}`,
                borderRadius: 4,
                color: job.url ? "#8B5CF6" : "#64748B",
                fontSize: 11,
                cursor: job.url ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                gap: 2,
                lineHeight: 1,
                opacity: job.url ? 1 : 0.5
              }}
            >
              <span aria-hidden="true">🔄</span>
            </button>
            <button type="button"
              onClick={handleReevaluate}
              aria-label={`Re-evaluate fit score for ${job.title} at ${job.company}`}
              title="Re-evaluate fit score"
              style={{
                padding: "3px 6px",
                background: "#0A2E1A",
                border: "1px solid #10B981",
                borderRadius: 4,
                color: "#10B981",
                fontSize: 11,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 2,
                lineHeight: 1
              }}
            >
              <span aria-hidden="true">⭐</span>
            </button>
          </div>
          <span style={{ fontSize: 11, color: "#374151" }}>{daysAgo(job.appliedDate || job.savedDate)}</span>
        </div>
      </div>
    </div>
  )
}

function AddJobModal({ onClose, onAdd }) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState("")

  const handleParse = async () => {
    if (!input.trim()) return
    setLoading(true)
    setError("")
    try {
      const result = await parseJob(input.trim())
      setParsed(result)
    } catch (e) {
      setError("Parsing failed: " + e.message)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      const job = {
        ...parsed,
        url: input.trim().startsWith("http") ? input.trim() : null,
      }
      await onAdd(job)
      onClose()
    } catch (e) {
      setError("Failed to save: " + e.message)
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed", inset: 0, background: "#000000CC", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-job-title"
        style={{
          background: "#0A1628", border: "1px solid #1A2E45", borderRadius: 16,
          padding: 32, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 id="add-job-title" style={{ color: "#E2E8F0", fontSize: 18, fontWeight: 700, margin: 0 }}>Add Job Posting</h2>
          <button type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer" }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {!parsed ? (
          <>
            <label htmlFor="job-input" style={{ display: "block", color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: "0.08em" }}>
              JOB URL OR PASTE JOB DESCRIPTION
            </label>
            <textarea
              id="job-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="https://careers.company.com/job/... or paste the full job description text here"
              aria-describedby={error ? "job-input-error" : undefined}
              aria-invalid={!!error}
              style={{
                width: "100%", minHeight: 140, background: "#060F1A",
                border: "1px solid #1A2E45", borderRadius: 8, padding: "12px 14px",
                color: "#E2E8F0", fontSize: 13, fontFamily: "inherit",
                resize: "vertical", outline: "none", boxSizing: "border-box"
              }}
            />
            {error && (
              <div
                id="job-input-error"
                role="alert"
                aria-live="polite"
                style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}
              >
                {error}
              </div>
            )}
            <button type="button"
              onClick={handleParse}
              disabled={loading || !input.trim()}
              aria-busy={loading}
              aria-label={loading ? "Analyzing job with AI, please wait" : "Parse job description"}
              style={{
                marginTop: 16, width: "100%", padding: "12px",
                background: loading ? "#1A2E45" : "#1D4ED8",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer",
                transition: "background 0.2s",
                opacity: (loading || !input.trim()) ? 0.6 : 1
              }}
            >
              {loading ? "⚙ Analyzing with AI..." : "→ Parse Job Description"}
            </button>
          </>
        ) : (
          <>
            <div style={{ background: "#060F1A", borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0" }}>{parsed.title}</div>
                  <div style={{ fontSize: 14, color: "#3B82F6", fontWeight: 600 }}>{parsed.company}</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{parsed.location} · {parsed.type}</div>
                  {parsed.salary && <div style={{ fontSize: 12, color: "#10B981", marginTop: 4 }}>{parsed.salary}</div>}
                </div>
                <FitBadge score={parsed.fitScore || 0} />
              </div>
              <p style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>{parsed.summary}</p>
              <div style={{ background: "#0A1A2E", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>FIT ANALYSIS: </span>
                <span style={{ fontSize: 12, color: "#CBD5E1" }}>{parsed.fitReason}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(parsed.keySkills || []).map(s => <SkillTag key={s} skill={s} />)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button"
                onClick={() => setParsed(null)}
                aria-label="Go back to input new job description"
                style={{
                  flex: 1, padding: "10px", background: "none", border: "1px solid #1A2E45",
                  color: "#94A3B8", borderRadius: 8, fontSize: 13, cursor: "pointer"
                }}
              >
                ← Re-parse
              </button>
              <button type="button"
                onClick={handleSave}
                aria-label={`Save ${parsed.title} at ${parsed.company} to job tracker`}
                style={{
                  flex: 2, padding: "10px", background: "#1D4ED8", color: "#fff",
                  border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
                }}
              >
                + Save to Tracker
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function JobDetail({ job, onUpdate, onDelete, onReparse, onGapAnalysis }) {
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(job.notes || "")
  const [status, setStatus] = useState(job.status)
  const [appliedDate, setAppliedDate] = useState(job.appliedDate || "")
  const [lastContact, setLastContact] = useState(job.lastContact || "")
  const [generatingResume, setGeneratingResume] = useState(false)
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)
  const [generatingOptimizedResume, setGeneratingOptimizedResume] = useState(false)
  const [reparsing, setReparsing] = useState(false)
  const [analyzingGap, setAnalyzingGap] = useState(false)
  const [showAutoApplyModal, setShowAutoApplyModal] = useState(false)
  const [documents, setDocuments] = useState(null)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [previewModal, setPreviewModal] = useState(null) // { title, html, filePath }
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [diffModal, setDiffModal] = useState(null) // { title, diff, stats, identical }
  const [loadingDiff, setLoadingDiff] = useState(false)

  useEffect(() => {
    setNotes(job.notes || "")
    setStatus(job.status)
    setAppliedDate(job.appliedDate || "")
    setLastContact(job.lastContact || "")
    loadDocuments()
  }, [job.id])

  const loadDocuments = async () => {
    setLoadingDocuments(true)
    try {
      const docs = await getJobDocuments(job.id)
      setDocuments(docs)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
    setLoadingDocuments(false)
  }

  const handleSave = async () => {
    try {
      await onUpdate(job.id, { notes, status, appliedDate, lastContact })
      setEditing(false)
    } catch (e) {
      alert("Failed to save: " + e.message)
    }
  }

  const handleGenerateResume = async () => {
    setGeneratingResume(true)
    try {
      const result = await generateResume(job.id)
      window.open(result.url, '_blank')
      await loadDocuments() // Reload documents to show new version
    } catch (e) {
      alert("Failed to generate resume: " + e.message)
    }
    setGeneratingResume(false)
  }

  const handleGenerateCoverLetter = async () => {
    setGeneratingCoverLetter(true)
    try {
      const result = await generateCoverLetter(job.id)
      window.open(result.url, '_blank')
      await loadDocuments() // Reload documents to show new version
    } catch (e) {
      alert("Failed to generate cover letter: " + e.message)
    }
    setGeneratingCoverLetter(false)
  }

  const handleGenerateOptimizedResume = async () => {
    setGeneratingOptimizedResume(true)
    try {
      const result = await generateOptimizedResume(job.id)
      window.open(result.url, '_blank')
      await loadDocuments() // Reload documents to show new version
    } catch (e) {
      alert("Failed to generate optimized resume: " + e.message)
    }
    setGeneratingOptimizedResume(false)
  }

  const handleDeleteDocument = async (type, versionId) => {
    if (!confirm(`Are you sure you want to delete this ${type} version?`)) return

    try {
      if (type === 'resume') {
        await deleteResumeVersion(job.id, versionId)
      } else {
        await deleteCoverLetterVersion(job.id, versionId)
      }
      await loadDocuments()
    } catch (error) {
      alert(`Failed to delete ${type}: ${error.message}`)
    }
  }

  const handlePreviewDocument = async (filePath, title) => {
    setLoadingPreview(true)
    try {
      const result = await previewDocument(filePath)
      setPreviewModal({
        title,
        html: result.html,
        filePath
      })
    } catch (error) {
      alert(`Failed to preview document: ${error.message}`)
    }
    setLoadingPreview(false)
  }

  const handleDiffDocument = async (filePath, title) => {
    setLoadingDiff(true)
    try {
      const result = await diffDocument(filePath)
      setDiffModal({ title, diff: result.diff, stats: result.stats, identical: result.identical })
    } catch (error) {
      alert(`Failed to diff document: ${error.message}`)
    }
    setLoadingDiff(false)
  }

  const handleReparse = async () => {
    if (!job.url) {
      alert("This job has no URL to reparse. Please add the job description manually.")
      return
    }

    if (!confirm(`Reparse job from URL?\n\nThis will refresh the job details, fit score, and skills by re-scraping and analyzing:\n${job.url}`)) {
      return
    }

    setReparsing(true)
    try {
      await onReparse(job.id, job.url)
    } catch (e) {
      alert("Failed to reparse: " + e.message)
    }
    setReparsing(false)
  }

  const handleGapAnalysis = async () => {
    setAnalyzingGap(true)
    try {
      await onGapAnalysis(job.id)
    } catch (e) {
      alert("Failed to generate gap analysis: " + e.message)
    }
    setAnalyzingGap(false)
  }

  return (
    <div style={{ padding: "24px 28px", height: "100%", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ color: "#E2E8F0", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>{job.title}</h2>
            <div style={{ fontSize: 16, color: "#3B82F6", fontWeight: 600, marginBottom: 6 }}>{job.company}</div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {job.location && <span style={{ fontSize: 12, color: "#64748B" }}>📍 {job.location}</span>}
              {job.type && <span style={{ fontSize: 12, color: "#64748B" }}>💼 {job.type}</span>}
              {job.salary && <span style={{ fontSize: 12, color: "#10B981" }}>💰 {job.salary}</span>}
            </div>
          </div>
          <FitBadge score={job.fitScore || 0} />
        </div>
      </div>

      {/* Status & dates */}
      <div style={{ background: "#060F1A", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label
              htmlFor={`status-${job.id}`}
              style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}
            >
              STATUS
            </label>
            <select
              id={`status-${job.id}`}
              value={status}
              onChange={e => { setStatus(e.target.value); setEditing(true); }}
              aria-label={`Change status for ${job.title} at ${job.company}`}
              style={{
                width: "100%", background: "#0A1628", border: "1px solid #1A2E45",
                borderRadius: 6, padding: "8px 10px", color: "#E2E8F0", fontSize: 13
              }}
            >
              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <div
              id={`added-date-label-${job.id}`}
              style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}
            >
              ADDED DATE
              <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>(when parsed)</span>
            </div>
            <div
              aria-labelledby={`added-date-label-${job.id}`}
              role="text"
              style={{ padding: "8px 10px", color: "#64748B", fontSize: 13, background: "#0A1628", border: "1px solid #1A2E45", borderRadius: 6 }}
            >
              {job.savedDate || "—"}
            </div>
          </div>
          <div>
            <label
              htmlFor={`applied-date-${job.id}`}
              style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}
            >
              APPLIED DATE
              <span style={{ fontSize: 9, fontWeight: 400, marginLeft: 4, opacity: 0.7 }}>(when you applied)</span>
            </label>
            <input
              id={`applied-date-${job.id}`}
              type="date"
              value={appliedDate}
              onChange={e => { setAppliedDate(e.target.value); setEditing(true); }}
              placeholder="Set after applying"
              aria-label={`Set applied date for ${job.title} at ${job.company}`}
              style={{
                width: "100%", background: "#0A1628", border: "1px solid #1A2E45",
                borderRadius: 6, padding: "8px 10px", color: "#E2E8F0", fontSize: 13,
                boxSizing: "border-box"
              }}
            />
          </div>
          <div>
            <label
              htmlFor={`last-contact-${job.id}`}
              style={{ display: "block", fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}
            >
              LAST CONTACT
            </label>
            <input
              id={`last-contact-${job.id}`}
              type="date"
              value={lastContact}
              onChange={e => { setLastContact(e.target.value); setEditing(true); }}
              aria-label={`Set last contact date for ${job.title} at ${job.company}`}
              style={{
                width: "100%", background: "#0A1628", border: "1px solid #1A2E45",
                borderRadius: 6, padding: "8px 10px", color: "#E2E8F0", fontSize: 13,
                boxSizing: "border-box"
              }}
            />
          </div>
        </div>
        {needsFollowUp(job) && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#3D2E05", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{ fontSize: 12, color: "#F59E0B", fontWeight: 600 }}>No response in 7+ days — consider following up</span>
          </div>
        )}
      </div>

      {/* Summary */}
      {job.summary && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>ROLE SUMMARY</div>
          <p style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{job.summary}</p>
        </div>
      )}

      {/* Fit analysis */}
      {job.fitReason && (
        <div style={{ background: "#0A1A2E", borderRadius: 8, padding: "12px 16px", marginBottom: 20, borderLeft: "3px solid #3B82F6" }}>
          <div style={{ fontSize: 11, color: "#3B82F6", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>FIT ANALYSIS</div>
          <p style={{ color: "#CBD5E1", fontSize: 13, margin: 0, lineHeight: 1.6 }}>{job.fitReason}</p>
        </div>
      )}

      {/* Skills */}
      {job.keySkills?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>KEY SKILLS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {job.keySkills.map(s => <SkillTag key={s} skill={s} />)}
          </div>
        </div>
      )}

      {/* URL */}
      {job.url && (
        <div style={{ marginBottom: 20 }}>
          <a href={job.url} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 12, color: "#3B82F6", textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 4
          }}>🔗 View Original Posting ↗<span className="sr-only"> (opens in new tab)</span></a>
        </div>
      )}

      {/* Notes */}
      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor={`notes-${job.id}`}
          style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8, display: "block" }}
        >
          NOTES
        </label>
        <textarea
          id={`notes-${job.id}`}
          value={notes}
          onChange={e => { setNotes(e.target.value); setEditing(true); }}
          placeholder="Interview notes, contacts, follow-up actions..."
          aria-label={`Notes for ${job.title} at ${job.company}`}
          style={{
            width: "100%", minHeight: 120, background: "#060F1A",
            border: "1px solid #1A2E45", borderRadius: 8, padding: "12px 14px",
            color: "#E2E8F0", fontSize: 13, fontFamily: "inherit",
            resize: "vertical", outline: "none", boxSizing: "border-box"
          }}
        />
      </div>

      {/* Status updates live region */}
      {(reparsing || generatingResume || generatingOptimizedResume || analyzingGap) && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ padding: "10px 14px", background: "#0A1A2E", borderRadius: 8, marginBottom: 16, color: "#7DD3FC", fontSize: 12 }}
        >
          {reparsing && "Reparsing job from URL, please wait..."}
          {generatingResume && "Generating tailored resume, please wait..."}
          {generatingOptimizedResume && "Generating 100% match optimized resume, please wait..."}
          {analyzingGap && "Analyzing gaps for 100% match, please wait..."}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {editing && (
          <button type="button"
            onClick={handleSave}
            aria-label={`Save changes to ${job.title} at ${job.company}`}
            style={{
              flex: 1, padding: "11px", background: "#1D4ED8", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
            }}
          >
            Save Changes
          </button>
        )}
        {job.url && (
          <button type="button"
            onClick={handleReparse}
            disabled={reparsing}
            aria-label={`Reparse ${job.title} at ${job.company} from URL`}
            aria-busy={reparsing}
            style={{
              padding: "11px 18px", background: "#0A1A2E", border: "1px solid #8B5CF6",
              color: "#8B5CF6", borderRadius: 8, fontSize: 13, cursor: reparsing ? "wait" : "pointer",
              opacity: reparsing ? 0.6 : 1
            }}
          >
            <span aria-hidden="true">🔄</span> {reparsing ? "Reparsing..." : "Reparse Job"}
          </button>
        )}
        <button type="button"
          onClick={handleGenerateResume}
          disabled={generatingResume}
          aria-label={`Generate tailored resume for ${job.title} at ${job.company}`}
          aria-busy={generatingResume}
          style={{
            padding: "11px 18px", background: "#0A3D2E", border: "1px solid #10B981",
            color: "#10B981", borderRadius: 8, fontSize: 13, cursor: generatingResume ? "wait" : "pointer",
            opacity: generatingResume ? 0.6 : 1
          }}
        >
          <span aria-hidden="true">📄</span> {generatingResume ? "Generating..." : "Generate Resume"}
        </button>
        <button type="button"
          onClick={handleGenerateCoverLetter}
          disabled={generatingCoverLetter}
          aria-label={`Generate cover letter for ${job.title} at ${job.company}`}
          aria-busy={generatingCoverLetter}
          style={{
            padding: "11px 18px", background: "#1A0A2E", border: "1px solid #8B5CF6",
            color: "#8B5CF6", borderRadius: 8, fontSize: 13, cursor: generatingCoverLetter ? "wait" : "pointer",
            opacity: generatingCoverLetter ? 0.6 : 1
          }}
        >
          <span aria-hidden="true">✉️</span> {generatingCoverLetter ? "Generating..." : "Generate Cover Letter"}
        </button>
        <button type="button"
          onClick={handleGenerateOptimizedResume}
          disabled={generatingOptimizedResume}
          aria-label={`Generate 100% match optimized resume for ${job.title} at ${job.company}`}
          aria-busy={generatingOptimizedResume}
          style={{
            padding: "11px 18px", background: "#0A2E1A", border: "1px solid #10B981",
            color: "#10B981", borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: generatingOptimizedResume ? "wait" : "pointer",
            opacity: generatingOptimizedResume ? 0.6 : 1
          }}
        >
          <span aria-hidden="true">🎯</span> {generatingOptimizedResume ? "Generating..." : "100% Match Resume"}
        </button>
        <button type="button"
          onClick={handleGapAnalysis}
          disabled={analyzingGap}
          aria-label={`Analyze gaps for 100% match for ${job.title} at ${job.company}`}
          aria-busy={analyzingGap}
          style={{
            padding: "11px 18px", background: "#0A1A2E", border: "1px solid #F59E0B",
            color: "#F59E0B", borderRadius: 8, fontSize: 13, cursor: analyzingGap ? "wait" : "pointer",
            opacity: analyzingGap ? 0.6 : 1
          }}
        >
          <span aria-hidden="true">🎯</span> {analyzingGap ? "Analyzing..." : "Gap Analysis"}
        </button>
      </div>

      {/* Auto Apply Section */}
      {job.url && (
        <div style={{ marginTop: 20, padding: 20, background: "#0A1628", borderRadius: 8, border: "1px solid #1E3A5F" }}>
          <h3 style={{ color: "#F0F4F8", fontSize: 14, fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true">🤖</span> Auto-Apply
          </h3>
          <p style={{ color: "#94A3B8", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Automatically generate tailored resume and cover letter, analyze the application form, and fill it out for you.
          </p>
          <button type="button"
            onClick={() => setShowAutoApplyModal(true)}
            disabled={!job.url}
            style={{
              padding: "12px 20px", background: "#1E3A8A", border: "1px solid #3B82F6",
              color: "#60A5FA", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: job.url ? "pointer" : "not-allowed",
              opacity: job.url ? 1 : 0.5
            }}
          >
            <span aria-hidden="true">🚀</span> Start Auto-Apply
          </button>
        </div>
      )}

      {/* Documents Section */}
      <div style={{ marginTop: 20, padding: 20, background: "#0A1628", borderRadius: 8, border: "1px solid #1E3A5F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ color: "#F0F4F8", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <span aria-hidden="true">📁</span> Generated Documents
          </h3>
          <button type="button"
            onClick={() => setShowDocuments(!showDocuments)}
            aria-expanded={showDocuments}
            style={{
              background: "none", border: "none", color: "#60A5FA",
              cursor: "pointer", fontSize: 12, fontWeight: 600
            }}
          >
            {showDocuments ? "Hide" : "Show"} ({documents?.stats?.resumeCount || 0} resumes, {documents?.stats?.coverLetterCount || 0} cover letters)
          </button>
        </div>

        {showDocuments && documents && (
          <div style={{ marginTop: 16 }}>
            {/* Resumes */}
            {documents.resumes && documents.resumes.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Resumes ({documents.resumes.length} {documents.resumes.length === 1 ? 'version' : 'versions'})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {documents.resumes.map((resume, index) => (
                    <div key={resume.id} style={{
                      background: "#0F172A", border: "1px solid #1E293B",
                      borderRadius: 6, padding: 12, display: "flex",
                      justifyContent: "space-between", alignItems: "center"
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            background: index === 0 ? "#1E3A8A" : "#1E293B",
                            color: index === 0 ? "#60A5FA" : "#64748B",
                            padding: "2px 8px", borderRadius: 4, fontSize: 10,
                            fontWeight: 700, letterSpacing: "0.05em"
                          }}>
                            V{resume.version} {index === 0 && '(Latest)'}
                          </span>
                          {resume.type && resume.type !== 'standard' && (
                            <span style={{
                              background: "#0A2E1A", color: "#10B981",
                              padding: "2px 8px", borderRadius: 4, fontSize: 10,
                              fontWeight: 600
                            }}>
                              {resume.type === 'optimized' ? '100% Match' : resume.type}
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#94A3B8", fontSize: 11 }}>
                          {new Date(resume.createdAt).toLocaleString()}
                          {resume.fileSize && ` • ${(resume.fileSize / 1024).toFixed(1)} KB`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button"
                          onClick={() => handlePreviewDocument(
                            resume.filePath,
                            `Resume V${resume.version} - ${job.title} at ${job.company}`
                          )}
                          disabled={loadingPreview}
                          style={{
                            padding: "6px 12px", background: "#1E3A8A",
                            border: "1px solid #3B82F6", color: "#60A5FA",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            cursor: loadingPreview ? "wait" : "pointer"
                          }}
                        >
                          Preview
                        </button>
                        <button type="button"
                          onClick={() => handleDiffDocument(
                            resume.filePath,
                            `Changes vs Master — Resume V${resume.version}`
                          )}
                          disabled={loadingDiff}
                          style={{
                            padding: "6px 12px", background: "#3A2A1E",
                            border: "1px solid #F59E0B", color: "#FBBF24",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            cursor: loadingDiff ? "wait" : "pointer"
                          }}
                        >
                          Diff vs Master
                        </button>
                        <a
                          href={resume.filePath.replace('/Users/x/work/job-tracker/public', '')}
                          download
                          style={{
                            padding: "6px 12px", background: "#0A2E1A",
                            border: "1px solid #10B981", color: "#10B981",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            textDecoration: "none", cursor: "pointer"
                          }}
                        >
                          Download
                        </a>
                        <button type="button"
                          onClick={() => handleDeleteDocument('resume', resume.id)}
                          style={{
                            padding: "6px 12px", background: "none",
                            border: "1px solid #3D1515", color: "#EF4444",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cover Letters */}
            {documents.coverLetters && documents.coverLetters.length > 0 && (
              <div>
                <h4 style={{ color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Cover Letters ({documents.coverLetters.length} {documents.coverLetters.length === 1 ? 'version' : 'versions'})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {documents.coverLetters.map((letter, index) => (
                    <div key={letter.id} style={{
                      background: "#0F172A", border: "1px solid #1E293B",
                      borderRadius: 6, padding: 12, display: "flex",
                      justifyContent: "space-between", alignItems: "center"
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{
                            background: index === 0 ? "#1A0A2E" : "#1E293B",
                            color: index === 0 ? "#8B5CF6" : "#64748B",
                            padding: "2px 8px", borderRadius: 4, fontSize: 10,
                            fontWeight: 700, letterSpacing: "0.05em"
                          }}>
                            V{letter.version} {index === 0 && '(Latest)'}
                          </span>
                        </div>
                        <div style={{ color: "#94A3B8", fontSize: 11 }}>
                          {new Date(letter.createdAt).toLocaleString()}
                          {letter.fileSize && ` • ${(letter.fileSize / 1024).toFixed(1)} KB`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button"
                          onClick={() => handlePreviewDocument(
                            letter.filePath,
                            `Cover Letter V${letter.version} - ${job.title} at ${job.company}`
                          )}
                          disabled={loadingPreview}
                          style={{
                            padding: "6px 12px", background: "#1A0A2E",
                            border: "1px solid #8B5CF6", color: "#8B5CF6",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            cursor: loadingPreview ? "wait" : "pointer"
                          }}
                        >
                          Preview
                        </button>
                        <a
                          href={letter.filePath.replace('/Users/x/work/job-tracker/public', '')}
                          download
                          style={{
                            padding: "6px 12px", background: "#0A2E1A",
                            border: "1px solid #10B981", color: "#10B981",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            textDecoration: "none", cursor: "pointer"
                          }}
                        >
                          Download
                        </a>
                        <button type="button"
                          onClick={() => handleDeleteDocument('cover-letter', letter.id)}
                          style={{
                            padding: "6px 12px", background: "none",
                            border: "1px solid #3D1515", color: "#EF4444",
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            cursor: "pointer"
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(!documents.resumes || documents.resumes.length === 0) && (!documents.coverLetters || documents.coverLetters.length === 0) && (
              <div style={{ textAlign: "center", padding: "20px", color: "#64748B", fontSize: 12 }}>
                No documents generated yet. Use the buttons above to generate a resume or cover letter.
              </div>
            )}
          </div>
        )}

        {loadingDocuments && (
          <div style={{ textAlign: "center", padding: "20px", color: "#94A3B8", fontSize: 12 }}>
            Loading documents...
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button type="button"
          onClick={() => onDelete(job.id)}
          aria-label={`Delete ${job.title} at ${job.company} from tracker`}
          style={{
            padding: "11px 18px", background: "none", border: "1px solid #3D1515",
            color: "#EF4444", borderRadius: 8, fontSize: 13, cursor: "pointer"
          }}
        >
          Delete
        </button>
      </div>

      {/* Auto Apply Modal */}
      {showAutoApplyModal && (
        <AutoApplyModal
          job={job}
          onClose={() => setShowAutoApplyModal(false)}
        />
      )}

      {/* Document Preview Modal */}
      {previewModal && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewModal(null)
          }}
          style={{
            position: "fixed", inset: 0, background: "#000000DD", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}
        >
          <div style={{
            background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12,
            maxWidth: "900px", width: "100%", maxHeight: "90vh", display: "flex",
            flexDirection: "column", overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid #1E293B",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <h3 style={{ color: "#F1F5F9", fontSize: 16, fontWeight: 600, margin: 0 }}>
                {previewModal.title}
              </h3>
              <div style={{ display: "flex", gap: 12 }}>
                <a
                  href={previewModal.filePath}
                  download
                  style={{
                    padding: "8px 16px", background: "#1E3A8A",
                    border: "1px solid #3B82F6", color: "#60A5FA",
                    borderRadius: 6, fontSize: 12, fontWeight: 600,
                    textDecoration: "none", cursor: "pointer"
                  }}
                >
                  Download
                </a>
                <button type="button"
                  onClick={() => setPreviewModal(null)}
                  style={{
                    padding: "8px 16px", background: "none",
                    border: "1px solid #475569", color: "#94A3B8",
                    borderRadius: 6, fontSize: 12, fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{
              padding: "24px", overflow: "auto", flex: 1,
              background: "#FFFFFF", color: "#000000"
            }}>
              <div
                dangerouslySetInnerHTML={{ __html: previewModal.html }}
                style={{
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  lineHeight: 1.6,
                  maxWidth: '100%'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Master-vs-Generated Diff Modal */}
      {diffModal && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDiffModal(null)
          }}
          style={{
            position: "fixed", inset: 0, background: "#000000DD", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          }}
        >
          <div style={{
            background: "#0F172A", border: "1px solid #1E293B", borderRadius: 12,
            maxWidth: "900px", width: "100%", maxHeight: "90vh", display: "flex",
            flexDirection: "column", overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 24px", borderBottom: "1px solid #1E293B",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div>
                <h3 style={{ color: "#F1F5F9", fontSize: 16, fontWeight: 600, margin: 0 }}>
                  {diffModal.title}
                </h3>
                <div style={{ color: "#94A3B8", fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: "#10B981" }}>+{diffModal.stats.added} added</span>
                  {"  "}
                  <span style={{ color: "#EF4444" }}>−{diffModal.stats.removed} removed</span>
                  {"  "}
                  <span>{diffModal.stats.unchanged} unchanged</span>
                </div>
              </div>
              <button type="button"
                onClick={() => setDiffModal(null)}
                style={{
                  padding: "8px 16px", background: "none",
                  border: "1px solid #475569", color: "#94A3B8",
                  borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: "16px 24px", overflow: "auto", flex: 1, background: "#0B1220" }}>
              {diffModal.identical ? (
                <div style={{ color: "#F59E0B", fontSize: 13, padding: 12 }}>
                  ⚠️ This resume is identical to the master template — no changes were applied.
                </div>
              ) : (
                <div style={{ fontFamily: "'DM Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.7 }}>
                  {diffModal.diff.map((line, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "1px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word",
                        background: line.type === "added" ? "#0A2E1A"
                          : line.type === "removed" ? "#3A1515" : "transparent",
                        color: line.type === "added" ? "#86EFAC"
                          : line.type === "removed" ? "#FCA5A5" : "#94A3B8",
                        borderLeft: `3px solid ${line.type === "added" ? "#10B981"
                          : line.type === "removed" ? "#EF4444" : "transparent"}`
                      }}
                    >
                      <span style={{ userSelect: "none", opacity: 0.7, marginRight: 8 }}>
                        {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                      </span>
                      {line.value}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GapAnalysisModal({ analysis, onClose, onGenerateOptimizedResume, onRerun }) {
  const [generating, setGenerating] = useState(false)
  const [rerunning, setRerunning] = useState(false)

  if (!analysis) return null

  const meta = analysis._meta || {}

  const handleGenerateResume = async () => {
    setGenerating(true)
    try {
      if (onGenerateOptimizedResume) {
        await onGenerateOptimizedResume()
      }
    } catch (error) {
      alert("Failed to generate optimized resume: " + error.message)
    }
    setGenerating(false)
  }

  const handleRerun = async () => {
    if (!onRerun) return
    setRerunning(true)
    try {
      await onRerun()
    } catch (error) {
      alert("Failed to rerun gap analysis: " + error.message)
    }
    setRerunning(false)
  }

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed", inset: 0, background: "#000000DD", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gap-analysis-title"
        style={{
          background: "#0A1628", border: "1px solid #1A2E45", borderRadius: 16,
          padding: 32, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 id="gap-analysis-title" style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 700, margin: 0 }}>
              🎯 Gap Analysis for 100% Match
            </h2>
            {meta.generatedAt && (
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>
                {meta.cached ? "📦 Cached" : "✨ Freshly generated"} · {new Date(meta.generatedAt).toLocaleString()}
              </div>
            )}
          </div>
          <button type="button"
            onClick={onClose}
            aria-label="Close gap analysis"
            style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer" }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Score Progress */}
        <div style={{ background: "#060F1A", borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>CURRENT FIT</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#3B82F6" }}>{analysis.currentScore}%</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>TARGET</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "#10B981" }}>{analysis.targetScore}%</div>
            </div>
          </div>
          <div style={{ background: "#1A2E45", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ background: "#3B82F6", height: "100%", width: `${analysis.currentScore}%`, transition: "width 0.5s" }}></div>
          </div>
        </div>

        {/* Overall Assessment */}
        {analysis.overallAssessment && (
          <div style={{ background: "#0A1A2E", borderRadius: 10, padding: 16, marginBottom: 20, borderLeft: "3px solid #3B82F6" }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>OVERALL ASSESSMENT</div>
            <div style={{ color: "#CBD5E1", fontSize: 13, lineHeight: 1.6 }}>{analysis.overallAssessment}</div>
          </div>
        )}

        {/* Matching Qualifications */}
        {analysis.matchingQualifications && analysis.matchingQualifications.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>✓ MATCHING QUALIFICATIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {analysis.matchingQualifications.map((match, i) => (
                <div key={i} style={{
                  background: "#0A2E1A", border: "1px solid #10B981",
                  borderRadius: 8, padding: 12
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      padding: "2px 6px", borderRadius: 3,
                      background: match.strength === 'high' ? '#10B981' : match.strength === 'medium' ? '#F59E0B' : '#64748B',
                      color: '#000'
                    }}>
                      {match.strength?.toUpperCase() || 'MATCH'}
                    </span>
                    <div style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>{match.requirement}</div>
                  </div>
                  <div style={{ color: "#94A3B8", fontSize: 12, lineHeight: 1.5 }}>{match.match}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Skills */}
        {analysis.missingSkills && analysis.missingSkills.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>✗ MISSING SKILLS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {analysis.missingSkills.map((item, i) => {
                const skill = typeof item === 'string' ? item : item.skill;
                const importance = typeof item === 'object' ? item.importance : null;
                const canLearn = typeof item === 'object' ? item.canLearn : null;

                return (
                  <div key={i} style={{
                    background: "#1A0F0F", border: "1px solid #3D1515",
                    borderRadius: 6, padding: 10, display: "flex",
                    alignItems: "center", justifyContent: "space-between"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#EF4444", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{skill}</div>
                      {importance && (
                        <div style={{ fontSize: 10, color: "#64748B" }}>
                          Importance: <span style={{
                            color: importance === 'critical' ? '#EF4444' : importance === 'important' ? '#F59E0B' : '#64748B',
                            fontWeight: 600
                          }}>{importance}</span>
                        </div>
                      )}
                    </div>
                    {canLearn !== null && (
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        padding: "3px 8px", borderRadius: 4,
                        background: canLearn ? '#0A2E1A' : '#1A0F0F',
                        color: canLearn ? '#10B981' : '#64748B',
                        border: `1px solid ${canLearn ? '#10B981' : '#3D1515'}`
                      }}>
                        {canLearn ? 'LEARNABLE' : 'REQUIRES EXP'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Experience Gaps */}
        {analysis.experienceGaps && analysis.experienceGaps.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>⚠ EXPERIENCE GAPS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {analysis.experienceGaps.map((item, i) => {
                const gap = typeof item === 'string' ? item : item.gap;
                const severity = typeof item === 'object' ? item.severity : null;
                const workaround = typeof item === 'object' ? item.workaround : null;

                return (
                  <div key={i} style={{
                    background: "#1A1406", border: "1px solid #3D2E0F",
                    borderRadius: 6, padding: 10
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {severity && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
                          padding: "2px 6px", borderRadius: 3,
                          background: severity === 'high' ? '#EF4444' : severity === 'medium' ? '#F59E0B' : '#64748B',
                          color: '#000'
                        }}>
                          {severity.toUpperCase()}
                        </span>
                      )}
                      <div style={{ color: "#F59E0B", fontSize: 12, fontWeight: 600 }}>{gap}</div>
                    </div>
                    {workaround && (
                      <div style={{ color: "#94A3B8", fontSize: 11, lineHeight: 1.5, marginTop: 4 }}>
                        <span style={{ color: "#64748B", fontWeight: 600 }}>→</span> {workaround}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Certifications */}
        {analysis.certifications && analysis.certifications.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>RECOMMENDED CERTIFICATIONS</div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#94A3B8", fontSize: 13, lineHeight: 1.7 }}>
              {analysis.certifications.map((cert, i) => (
                <li key={i}>{cert}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>💡 ACTION PLAN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {analysis.recommendations.map((item, i) => {
                const action = typeof item === 'string' ? item : item.action;
                const impact = typeof item === 'object' ? item.impact : null;
                const timeframe = typeof item === 'object' ? item.timeframe : null;

                return (
                  <div key={i} style={{
                    background: "#0A1A2E", border: "1px solid #1E3A8A",
                    borderRadius: 8, padding: 12, position: "relative", paddingLeft: 32
                  }}>
                    <div style={{
                      position: "absolute", left: 12, top: 12,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "#1E3A8A", color: "#60A5FA",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ color: "#E2E8F0", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{action}</div>
                    {impact && (
                      <div style={{ color: "#94A3B8", fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: "#10B981", fontWeight: 600 }}>Impact:</span> {impact}
                      </div>
                    )}
                    {timeframe && (
                      <div style={{ color: "#94A3B8", fontSize: 11 }}>
                        <span style={{ color: "#7DD3FC", fontWeight: 600 }}>Timeframe:</span> {timeframe}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Timeline & Priority */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {analysis.timeline && (
            <div style={{ background: "#0A1A2E", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>TIMELINE</div>
              <div style={{ fontSize: 14, color: "#7DD3FC", fontWeight: 600 }}>{analysis.timeline}</div>
            </div>
          )}
          {analysis.priority && (
            <div style={{ background: "#0A1A2E", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>PRIORITY</div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: analysis.priority === 'high' ? '#EF4444' : analysis.priority === 'medium' ? '#F59E0B' : '#10B981'
              }}>{analysis.priority.toUpperCase()}</div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button"
            onClick={handleGenerateResume}
            disabled={generating}
            aria-label="Generate 100% match optimized resume"
            aria-busy={generating}
            style={{
              flex: 1, padding: "12px", background: generating ? "#1A2E45" : "#10B981",
              color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: generating ? "wait" : "pointer", opacity: generating ? 0.6 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8
            }}
          >
            <span aria-hidden="true">🎯</span>
            {generating ? "Generating..." : "Generate 100% Match Resume"}
          </button>
          <button type="button"
            onClick={handleRerun}
            disabled={rerunning}
            aria-label="Rerun gap analysis"
            aria-busy={rerunning}
            title="Regenerate the analysis from scratch (e.g. after updating the role or your resume)"
            style={{
              padding: "12px 16px", background: "none", border: "1px solid #1A2E45",
              color: rerunning ? "#64748B" : "#7DD3FC", borderRadius: 8, fontSize: 14,
              cursor: rerunning ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            <span aria-hidden="true">🔄</span>
            {rerunning ? "Rerunning..." : "Rerun"}
          </button>
          <button type="button"
            onClick={onClose}
            aria-label="Close gap analysis"
            style={{
              padding: "12px 20px", background: "none", border: "1px solid #1A2E45",
              color: "#94A3B8", borderRadius: 8, fontSize: 14, cursor: "pointer"
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function ResumeComparisonModal({ comparison, onClose }) {
  if (!comparison) return null

  const priorityColor = comparison.priority === 'high' ? '#EF4444' : comparison.priority === 'medium' ? '#F59E0B' : '#10B981'

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed", inset: 0, background: "#000000DD", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-title"
        style={{
          background: "#0A1628", border: "1px solid #1A2E45", borderRadius: 16,
          padding: 32, width: "100%", maxWidth: 800, maxHeight: "90vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 id="comparison-title" style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 700, margin: 0 }}>
            ⚖️ Resume Comparison
          </h2>
          <button type="button"
            onClick={onClose}
            aria-label="Close comparison"
            style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer" }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Overview */}
        <div style={{ background: "#060F1A", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>OVERVIEW</div>
          <p style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{comparison.overview}</p>
        </div>

        {/* Job Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div style={{ background: "#0A1A2E", borderRadius: 8, padding: 16, border: "1px solid #1E40AF" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#3B82F6", marginBottom: 4 }}>{comparison.job1.title}</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{comparison.job1.company}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#3B82F6" }}>{comparison.job1.fitScore || 0}%</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>Current Fit</div>
            </div>
          </div>
          <div style={{ background: "#0A1A2E", borderRadius: 8, padding: 16, border: "1px solid #7C3AED" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#8B5CF6", marginBottom: 4 }}>{comparison.job2.title}</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{comparison.job2.company}</div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#8B5CF6" }}>{comparison.job2.fitScore || 0}%</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>Current Fit</div>
            </div>
          </div>
        </div>

        {/* Strengths & Weaknesses */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>JOB 1 STRENGTHS</div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#94A3B8", fontSize: 12, lineHeight: 1.7 }}>
              {comparison.job1Strengths?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
            <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, letterSpacing: "0.1em", marginTop: 12, marginBottom: 8 }}>WEAKNESSES</div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#94A3B8", fontSize: 12, lineHeight: 1.7 }}>
              {comparison.job1Weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>JOB 2 STRENGTHS</div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#94A3B8", fontSize: 12, lineHeight: 1.7 }}>
              {comparison.job2Strengths?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
            <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 700, letterSpacing: "0.1em", marginTop: 12, marginBottom: 8 }}>WEAKNESSES</div>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#94A3B8", fontSize: 12, lineHeight: 1.7 }}>
              {comparison.job2Weaknesses?.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>

        {/* Skills Comparison */}
        {comparison.skillsComparison && (
          <div style={{ background: "#060F1A", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>SKILLS COMPARISON</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "#3B82F6", fontWeight: 600, marginBottom: 6 }}>Unique to Job 1</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {comparison.skillsComparison.uniqueToJob1?.map((skill, i) => (
                    <span key={i} style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 4,
                      background: "#1E3A5F", border: "1px solid #3B82F6",
                      fontSize: 10, color: "#3B82F6", fontFamily: "'DM Mono', monospace"
                    }}>{skill}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 600, marginBottom: 6 }}>Unique to Job 2</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {comparison.skillsComparison.uniqueToJob2?.map((skill, i) => (
                    <span key={i} style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 4,
                      background: "#2D1B6B", border: "1px solid #8B5CF6",
                      fontSize: 10, color: "#8B5CF6", fontFamily: "'DM Mono', monospace"
                    }}>{skill}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#10B981", fontWeight: 600, marginBottom: 6 }}>Shared Skills</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {comparison.skillsComparison.shared?.map((skill, i) => (
                <span key={i} style={{
                  display: "inline-block", padding: "2px 8px", borderRadius: 4,
                  background: "#0A3D2E", border: "1px solid #10B981",
                  fontSize: 10, color: "#10B981", fontFamily: "'DM Mono', monospace"
                }}>{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Resume Strategy */}
        {comparison.resumeStrategy && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#0A1A2E", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#3B82F6", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>RESUME STRATEGY - JOB 1</div>
              <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>{comparison.resumeStrategy.job1}</p>
            </div>
            <div style={{ background: "#0A1A2E", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>RESUME STRATEGY - JOB 2</div>
              <p style={{ fontSize: 11, color: "#94A3B8", margin: 0, lineHeight: 1.6 }}>{comparison.resumeStrategy.job2}</p>
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div style={{ background: "#060F1A", borderRadius: 10, padding: 16, marginBottom: 20, border: `2px solid ${priorityColor}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: priorityColor, fontWeight: 700, letterSpacing: "0.1em" }}>RECOMMENDATION</div>
            <span style={{
              display: "inline-block", padding: "2px 8px", borderRadius: 4,
              background: `${priorityColor}22`, border: `1px solid ${priorityColor}`,
              fontSize: 10, color: priorityColor, fontWeight: 700
            }}>{comparison.priority?.toUpperCase()} PRIORITY</span>
          </div>
          <p style={{ color: "#E2E8F0", fontSize: 13, margin: 0, lineHeight: 1.7, fontWeight: 500 }}>{comparison.recommendation}</p>
        </div>

        <button type="button"
          onClick={onClose}
          style={{
            width: "100%", padding: "12px", background: "#1D4ED8", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

function RoleSuggestionsModal({ suggestions, onClose }) {
  if (!suggestions) return null

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: "fixed", inset: 0, background: "#000000DD", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestions-title"
        style={{
          background: "#0A1628", border: "1px solid #1A2E45", borderRadius: 16,
          padding: 32, width: "100%", maxWidth: 900, maxHeight: "90vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 id="suggestions-title" style={{ color: "#E2E8F0", fontSize: 20, fontWeight: 700, margin: 0 }}>
            💼 Ideal Roles for Your Profile
          </h2>
          <button type="button"
            onClick={onClose}
            aria-label="Close role suggestions"
            style={{ background: "none", border: "none", color: "#64748B", fontSize: 20, cursor: "pointer" }}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Profile Summary */}
        <div style={{ background: "#060F1A", borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>YOUR PROFILE</div>
          <p style={{ color: "#94A3B8", fontSize: 13, lineHeight: 1.7, margin: 0 }}>{suggestions.profileSummary}</p>
        </div>

        {/* Skills to Highlight */}
        {suggestions.skillsToHighlight && suggestions.skillsToHighlight.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>KEY SKILLS TO HIGHLIGHT</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggestions.skillsToHighlight.map((skill, i) => (
                <span key={i} style={{
                  display: "inline-block", padding: "4px 10px", borderRadius: 4,
                  background: "#0A3D2E", border: "1px solid #10B981",
                  fontSize: 11, color: "#10B981", fontFamily: "'DM Mono', monospace", fontWeight: 600
                }}>{skill}</span>
              ))}
            </div>
          </div>
        )}

        {/* Ideal Roles */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#3B82F6", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 12 }}>100% MATCH ROLES</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {suggestions.idealRoles?.map((role, i) => (
              <div key={i} style={{ background: "#060F1A", borderRadius: 10, padding: 16, border: "1px solid #1A2E45" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0" }}>{role.title}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{role.level?.toUpperCase()} • {role.industries?.join(', ')}</div>
                  </div>
                  {role.salaryRange && (
                    <div style={{ fontSize: 11, color: "#10B981", fontWeight: 600 }}>💰 {role.salaryRange}</div>
                  )}
                </div>
                <p style={{ fontSize: 12, color: "#94A3B8", margin: "8px 0", lineHeight: 1.6 }}>{role.whyPerfectFit}</p>
                {role.keyResponsibilities && role.keyResponsibilities.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, marginBottom: 4 }}>Key Responsibilities:</div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: "#94A3B8", fontSize: 11, lineHeight: 1.6 }}>
                      {role.keyResponsibilities.slice(0, 3).map((resp, j) => <li key={j}>{resp}</li>)}
                    </ul>
                  </div>
                )}
                {role.growthPotential && (
                  <div style={{ marginTop: 10, padding: "8px 12px", background: "#0A1A2E", borderRadius: 6 }}>
                    <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 600, marginBottom: 2 }}>Growth Potential:</div>
                    <div style={{ fontSize: 11, color: "#CBD5E1" }}>{role.growthPotential}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Career Paths */}
        {suggestions.careerPaths && suggestions.careerPaths.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#F59E0B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>CAREER PATHS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suggestions.careerPaths.map((path, i) => (
                <div key={i} style={{ background: "#0A1A2E", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", marginBottom: 4 }}>{path.path}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 4 }}>{path.description}</div>
                  <div style={{ fontSize: 10, color: "#64748B" }}>Timeline: {path.timeline}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Demand */}
        {suggestions.marketDemand && (
          <div style={{ background: "#060F1A", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 8 }}>MARKET DEMAND</div>
            <p style={{ color: "#94A3B8", fontSize: 12, margin: 0, lineHeight: 1.7 }}>{suggestions.marketDemand}</p>
          </div>
        )}

        <button type="button"
          onClick={onClose}
          style={{
            width: "100%", padding: "12px", background: "#1D4ED8", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Auto Apply Modal ─────────────────────────────────────────────────────────
// Build editable review rows by joining the analyzed form fields (labels/required)
// with the auto-mapped values returned by the preview.
function buildFieldRows(preview) {
  const mapping = preview?.fieldMapping || {}
  const formFields = preview?.formData?.fields || []
  const byName = {}
  formFields.forEach((f) => { if (f?.name) byName[f.name] = f })
  return Object.entries(mapping).map(([name, value]) => {
    const f = byName[name] || {}
    return {
      name,
      label: f.label || name,
      required: !!f.required,
      type: f.type || 'text',
      value: value == null ? '' : String(value)
    }
  })
}

function AutoApplyModal({ job, onClose }) {
  const [step, setStep] = useState('preview') // preview, review, filling, complete
  const [preview, setPreview] = useState(null)
  const [fieldRows, setFieldRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadPreview = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await autoApplyPreview(job.id)
      setPreview(result)
      setFieldRows(buildFieldRows(result))

      // Auto-open generated documents for review
      if (result.files?.resume) {
        const resumeUrl = result.files.resume.replace('/Users/x/work/job-tracker/public', '')
        window.open(resumeUrl, '_blank')
      }
      if (result.files?.coverLetter) {
        const coverLetterUrl = result.files.coverLetter.replace('/Users/x/work/job-tracker/public', '')
        window.open(coverLetterUrl, '_blank')
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  // Load preview on mount
  useEffect(() => {
    loadPreview()
  }, [])

  const updateFieldValue = (name, value) => {
    setFieldRows((rows) => rows.map((r) => (r.name === name ? { ...r, value } : r)))
  }

  const handleStartAutoApply = async () => {
    setStep('filling')
    setLoading(true)
    setError(null)
    try {
      // Send the values exactly as the user verified/edited them
      const fieldMapping = Object.fromEntries(fieldRows.map((r) => [r.name, r.value]))
      await autoApply(job.id, null, fieldMapping)
      setStep('complete')
    } catch (err) {
      setError(err.message)
      setStep('review')
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.9)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-apply-title"
    >
      <div style={{
        maxWidth: 900, width: "100%", background: "#0D1B2A",
        borderRadius: 12, border: "1px solid #1E3A5F", maxHeight: "90vh",
        overflow: "auto"
      }}>
        {/* Header */}
        <div style={{
          padding: 24, borderBottom: "1px solid #1E3A5F",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <h2 id="auto-apply-title" style={{
            fontSize: 20, fontWeight: 700, color: "#F0F4F8", margin: 0
          }}>
            🤖 Auto-Apply to {job.company}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" style={{
            background: "none", border: "none", color: "#94A3B8",
            cursor: "pointer", fontSize: 24
          }}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {loading && step === 'preview' && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <div style={{ color: "#F0F4F8", fontSize: 16, marginBottom: 8 }}>Preparing Auto-Apply...</div>
              <div style={{ color: "#94A3B8", fontSize: 14 }}>Generating documents and analyzing form</div>
            </div>
          )}

          {error && (
            <div style={{
              background: "#3D1515", border: "1px solid #EF4444",
              borderRadius: 8, padding: 16, marginBottom: 20
            }}>
              <div style={{ color: "#FCA5A5", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                ❌ Error
              </div>
              <div style={{ color: "#FCA5A5", fontSize: 13 }}>{error}</div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && preview && !loading && (
            <>
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ color: "#F0F4F8", fontSize: 16, marginBottom: 12 }}>
                  📋 Auto-Apply Preview
                </h3>
                <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.6 }}>
                  Review the generated documents below. When ready, click "Review Fields" to see and verify
                  every value before it's entered into the application form.
                </p>
              </div>

              {/* Stats */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24
              }}>
                <div style={{
                  background: "#0F172A", border: "1px solid #1E293B",
                  borderRadius: 8, padding: 16, textAlign: "center"
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10B981" }}>✓</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Resume Generated</div>
                </div>
                <div style={{
                  background: "#0F172A", border: "1px solid #1E293B",
                  borderRadius: 8, padding: 16, textAlign: "center"
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#10B981" }}>✓</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Cover Letter Generated</div>
                </div>
                <div style={{
                  background: "#0F172A", border: "1px solid #1E293B",
                  borderRadius: 8, padding: 16, textAlign: "center"
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#3B82F6" }}>{preview.estimatedFields || 0}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 4 }}>Fields to Fill</div>
                </div>
              </div>

              {/* Documents */}
              <div style={{
                background: "#0F172A", border: "1px solid #1E293B",
                borderRadius: 8, padding: 16, marginBottom: 20
              }}>
                <h4 style={{ color: "#F0F4F8", fontSize: 14, marginBottom: 12 }}>
                  📄 Generated Documents
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {preview.files?.resume && (
                    <a
                      href={preview.files.resume.replace('/Users/x/work/job-tracker/public', '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#60A5FA", fontSize: 13, textDecoration: "none",
                        display: "flex", alignItems: "center", gap: 8
                      }}
                    >
                      <span aria-hidden="true">📄</span> Tailored Resume<span className="sr-only"> (opens in new tab)</span>
                    </a>
                  )}
                  {preview.files?.coverLetter && (
                    <a
                      href={preview.files.coverLetter.replace('/Users/x/work/job-tracker/public', '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#60A5FA", fontSize: 13, textDecoration: "none",
                        display: "flex", alignItems: "center", gap: 8
                      }}
                    >
                      <span aria-hidden="true">✉️</span> Cover Letter<span className="sr-only"> (opens in new tab)</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button"
                  onClick={() => setStep('review')}
                  style={{
                    flex: 1, padding: 14, background: "#1E3A8A", border: "1px solid #3B82F6",
                    color: "#60A5FA", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  📝 Review Fields →
                </button>
                <button type="button"
                  onClick={onClose}
                  style={{
                    padding: 14, background: "none", border: "1px solid #64748B",
                    color: "#94A3B8", borderRadius: 8, fontSize: 14, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Review Step — verify/edit every field before filling */}
          {step === 'review' && (
            <>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ color: "#F0F4F8", fontSize: 16, marginBottom: 8 }}>
                  🔍 Verify Field Values
                </h3>
                <p style={{ color: "#94A3B8", fontSize: 14, lineHeight: 1.6 }}>
                  These are the values that will be entered into the application form. Edit anything that
                  looks wrong, or clear a value to leave that field blank. Nothing is submitted automatically —
                  you'll still review and submit in the browser.
                </p>
              </div>

              {fieldRows.length === 0 ? (
                <div style={{
                  background: "#0A1628", border: "1px solid #1E3A5F",
                  borderRadius: 8, padding: 16, marginBottom: 20, color: "#F59E0B", fontSize: 13
                }}>
                  ⚠️ No form fields could be auto-detected for this page. You can still open it and fill
                  the form in the browser, where your resume and cover letter will be available.
                </div>
              ) : (
                <div style={{
                  background: "#0F172A", border: "1px solid #1E293B",
                  borderRadius: 8, padding: 16, marginBottom: 20,
                  maxHeight: "45vh", overflow: "auto"
                }}>
                  {fieldRows.map((row, rowIndex) => (
                    <div key={row.name} style={{ marginBottom: 14 }}>
                      <label htmlFor={`auto-apply-field-${rowIndex}`} style={{
                        display: "block", color: "#CBD5E1", fontSize: 12,
                        fontWeight: 600, marginBottom: 4
                      }}>
                        {row.label}
                        {row.required && <span style={{ color: "#F87171", marginLeft: 4 }}>*</span>}
                      </label>
                      {row.type === 'textarea' ? (
                        <textarea
                          id={`auto-apply-field-${rowIndex}`}
                          value={row.value}
                          onChange={(e) => updateFieldValue(row.name, e.target.value)}
                          rows={3}
                          style={{
                            width: "100%", padding: 10, background: "#0A1628",
                            border: "1px solid #1E3A5F", borderRadius: 6,
                            color: "#F0F4F8", fontSize: 13, resize: "vertical"
                          }}
                        />
                      ) : (
                        <input
                          id={`auto-apply-field-${rowIndex}`}
                          type="text"
                          value={row.value}
                          onChange={(e) => updateFieldValue(row.name, e.target.value)}
                          style={{
                            width: "100%", padding: 10, background: "#0A1628",
                            border: "1px solid #1E3A5F", borderRadius: 6,
                            color: "#F0F4F8", fontSize: 13
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button"
                  onClick={handleStartAutoApply}
                  style={{
                    flex: 1, padding: 14, background: "#1E3A8A", border: "1px solid #3B82F6",
                    color: "#60A5FA", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  🚀 Fill Application
                </button>
                <button type="button"
                  onClick={() => setStep('preview')}
                  style={{
                    padding: 14, background: "none", border: "1px solid #64748B",
                    color: "#94A3B8", borderRadius: 8, fontSize: 14, cursor: "pointer"
                  }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}

          {/* Filling Step */}
          {step === 'filling' && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔄</div>
              <div style={{ color: "#F0F4F8", fontSize: 16, marginBottom: 8 }}>Filling Application...</div>
              <div style={{ color: "#94A3B8", fontSize: 14, marginBottom: 20 }}>
                A browser window will open. Please review the filled form and submit manually.
              </div>
              <div style={{
                background: "#0A1628", border: "1px solid #1E3A5F",
                borderRadius: 8, padding: 16
              }}>
                <div style={{ color: "#F59E0B", fontSize: 13, lineHeight: 1.6 }}>
                  ⚠️ Important: For your safety, auto-apply will NOT submit the form automatically.
                  Please review all filled information and submit manually.
                </div>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ color: "#F0F4F8", fontSize: 16, marginBottom: 8 }}>Form Filled Successfully!</div>
              <div style={{ color: "#94A3B8", fontSize: 14, marginBottom: 20 }}>
                Please review the information in the browser window and submit when ready.
              </div>
              <button type="button"
                onClick={onClose}
                style={{
                  padding: 14, background: "#0A3D2E", border: "1px solid #10B981",
                  color: "#10B981", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer"
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Analytics Dashboard ──────────────────────────────────────────────────────
function AnalyticsDashboard({ analytics, onClose, onExport }) {
  if (!analytics) return null

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.9)", zIndex: 9999,
      overflow: "auto", padding: 20
    }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-title"
    >
      <div style={{
        maxWidth: 1200, margin: "0 auto", background: "#0D1B2A",
        borderRadius: 12, border: "1px solid #1E3A5F"
      }}>
        {/* Header */}
        <div style={{
          padding: 24, borderBottom: "1px solid #1E3A5F",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <h2 id="analytics-title" style={{
            fontSize: 24, fontWeight: 700, color: "#F0F4F8", margin: 0
          }}>
            📊 Application Analytics
          </h2>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button"
              onClick={onExport}
              style={{
                padding: "8px 16px", background: "#0A3D2E", border: "1px solid #10B981",
                color: "#10B981", borderRadius: 6, fontSize: 13, cursor: "pointer"
              }}
            >
              📥 Export CSV
            </button>
            <button type="button" onClick={onClose} style={{
              background: "none", border: "1px solid #64748B",
              color: "#94A3B8", borderRadius: 6, padding: "8px 16px",
              cursor: "pointer", fontSize: 16
            }}>
              ✕ Close
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Overview Stats */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16, marginBottom: 32
          }}>
            <StatCard
              label="Total Applications"
              value={analytics.total}
              color="#3B82F6"
            />
            <StatCard
              label="Active"
              value={analytics.active}
              color="#10B981"
            />
            <StatCard
              label="Avg Fit Score"
              value={`${analytics.avgFitScore}%`}
              color="#F59E0B"
            />
            <StatCard
              label="Response Rate"
              value={`${analytics.responseRate}%`}
              color="#8B5CF6"
            />
          </div>

          {/* Conversion Rates */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#F0F4F8", marginBottom: 16 }}>
              Conversion Funnel
            </h3>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 16
            }}>
              <ConversionCard
                label="Application → Interview"
                rate={analytics.conversionRates.applicationToInterview}
              />
              <ConversionCard
                label="Interview → Offer"
                rate={analytics.conversionRates.interviewToOffer}
              />
              <ConversionCard
                label="Application → Offer"
                rate={analytics.conversionRates.applicationToOffer}
              />
            </div>
          </div>

          {/* Status Breakdown */}
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#F0F4F8", marginBottom: 16 }}>
              Applications by Status
            </h3>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12
            }}>
              {analytics.statusCounts.map(sc => (
                <div key={sc.status} style={{
                  background: "#0F172A", border: "1px solid #1E293B",
                  borderRadius: 8, padding: 16
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: getStatusColor(sc.status), marginBottom: 4 }}>
                    {sc.count}
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "capitalize" }}>
                    {sc.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Average Time in Status */}
          {analytics.avgTimeInStatus && analytics.avgTimeInStatus.length > 0 && (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: "#F0F4F8", marginBottom: 16 }}>
                Average Time in Each Status
              </h3>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: 12
              }}>
                {analytics.avgTimeInStatus.map((item, i) => (
                  <div key={i} style={{
                    background: "#0F172A", border: "1px solid #1E293B",
                    borderRadius: 8, padding: 16
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#3B82F6", marginBottom: 4 }}>
                      {Math.round(item.avg_days)} days
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", textTransform: "capitalize" }}>
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: "#0F172A", border: "1px solid #1E293B",
      borderRadius: 8, padding: 20
    }}>
      <div style={{ fontSize: 32, fontWeight: 700, color, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, color: "#94A3B8" }}>
        {label}
      </div>
    </div>
  )
}

function ConversionCard({ label, rate }) {
  const rateNum = parseFloat(rate)
  const color = rateNum >= 20 ? "#10B981" : rateNum >= 10 ? "#F59E0B" : "#EF4444"

  return (
    <div style={{
      background: "#0F172A", border: `1px solid ${color}40`,
      borderRadius: 8, padding: 20
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 8 }}>
        {rate}%
      </div>
      <div style={{ fontSize: 13, color: "#94A3B8" }}>
        {label}
      </div>
    </div>
  )
}

// ─── Auto Search Modal ────────────────────────────────────────────────────────
function AutoSearchModal({ onClose, onSearch }) {
  const [keywords, setKeywords] = useState('Software Engineer')
  const [location, setLocation] = useState('Remote')
  const [threshold, setThreshold] = useState(70)
  const [autoImport, setAutoImport] = useState(false)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState(null)
  const [selectedJobs, setSelectedJobs] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [searchTimestamp, setSearchTimestamp] = useState(null)
  const [archivedJobs, setArchivedJobs] = useState(new Set())
  const [showArchived, setShowArchived] = useState(false)

  // Load cached results and archived jobs on mount
  useEffect(() => {
    try {
      // Load cached results
      const cached = localStorage.getItem('autoSearchCache')
      if (cached) {
        const { results: cachedResults, criteria, timestamp } = JSON.parse(cached)
        setResults(cachedResults)
        setKeywords(criteria.keywords)
        setLocation(criteria.location)
        setThreshold(criteria.threshold)
        setAutoImport(criteria.autoImport)
        setSearchTimestamp(timestamp)
      }

      // Load archived jobs
      const archived = localStorage.getItem('archivedSearchJobs')
      if (archived) {
        setArchivedJobs(new Set(JSON.parse(archived)))
      }
    } catch (error) {
      console.error('Failed to load cached data:', error)
    }
  }, [])

  const handleSearch = async () => {
    setSearching(true)
    setResults(null)
    setSelectedJobs(new Set())
    setSearchTimestamp(null)

    try {
      const searchResults = await runAutoSearch({
        keywords,
        location,
        threshold,
        autoImport,
        limit: 20,
        boards: ['linkedin', 'indeed']
      })

      const timestamp = new Date().toISOString()
      setResults(searchResults)
      setSearchTimestamp(timestamp)

      // Cache results to localStorage
      try {
        localStorage.setItem('autoSearchCache', JSON.stringify({
          results: searchResults,
          criteria: { keywords, location, threshold, autoImport },
          timestamp
        }))
      } catch (error) {
        console.error('Failed to cache results:', error)
      }

      if (autoImport && searchResults.imported > 0) {
        // Reload jobs to show newly imported ones
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    } catch (error) {
      alert(`Search failed: ${error.message}`)
    }

    setSearching(false)
  }

  const handleNewSearch = () => {
    setResults(null)
    setSelectedJobs(new Set())
    setSearchTimestamp(null)
    localStorage.removeItem('autoSearchCache')
  }

  const handleToggleJob = (index) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedJobs(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedJobs.size === results.results.length) {
      setSelectedJobs(new Set())
    } else {
      setSelectedJobs(new Set(results.results.map((_, i) => i)))
    }
  }

  const handleImportSelected = async () => {
    if (selectedJobs.size === 0) return

    setImporting(true)
    try {
      const jobsToImport = Array.from(selectedJobs).map(i => results.results[i])
      const importResult = await importSelectedJobs(jobsToImport)

      alert(`Successfully imported ${importResult.imported} jobs!`)

      // Reload to show imported jobs
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      alert(`Import failed: ${error.message}`)
    }
    setImporting(false)
  }

  const handleArchiveJob = (job) => {
    const jobKey = `${job.company}-${job.title}-${job.url || ''}`.toLowerCase()
    const newArchived = new Set(archivedJobs)

    if (newArchived.has(jobKey)) {
      newArchived.delete(jobKey)
    } else {
      newArchived.add(jobKey)
    }

    setArchivedJobs(newArchived)
    localStorage.setItem('archivedSearchJobs', JSON.stringify(Array.from(newArchived)))
  }

  const isJobArchived = (job) => {
    const jobKey = `${job.company}-${job.title}-${job.url || ''}`.toLowerCase()
    return archivedJobs.has(jobKey)
  }

  // Filter out archived jobs unless showArchived is true
  const getFilteredResults = () => {
    if (!results || !results.results) return []
    if (showArchived) return results.results
    return results.results.filter(job => !isJobArchived(job))
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.9)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20
    }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-search-title"
    >
      <div style={{
        maxWidth: 900, width: "100%", background: "#0D1B2A",
        borderRadius: 12, border: "1px solid #1E3A5F", maxHeight: "90vh",
        overflow: "hidden", display: "flex", flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: 24, borderBottom: "1px solid #1E3A5F",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <h2 id="auto-search-title" style={{
            fontSize: 20, fontWeight: 700, color: "#F0F4F8", margin: 0
          }}>
            🤖 Automated Job Search
          </h2>
          <button type="button" onClick={onClose} aria-label="Close dialog" style={{
            background: "none", border: "none", color: "#94A3B8",
            cursor: "pointer", fontSize: 24
          }}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {!results ? (
            <>
              <p style={{ color: "#94A3B8", marginBottom: 24, fontSize: 14 }}>
                Search multiple job boards with AI-powered evaluation. Jobs meeting your threshold will be automatically imported.
              </p>

              {/* Keywords */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="auto-search-keywords" style={{ display: "block", marginBottom: 8, color: "#F0F4F8", fontSize: 14, fontWeight: 600 }}>
                  Keywords
                </label>
                <input
                  id="auto-search-keywords"
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g., Software Engineer, Data Scientist"
                  style={{
                    width: "100%", padding: 12, background: "#0F172A",
                    border: "1px solid #1E293B", borderRadius: 8, color: "#F0F4F8",
                    fontSize: 14
                  }}
                />
              </div>

              {/* Location */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="auto-search-location" style={{ display: "block", marginBottom: 8, color: "#F0F4F8", fontSize: 14, fontWeight: 600 }}>
                  Location
                </label>
                <input
                  id="auto-search-location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Remote, San Francisco, New York"
                  style={{
                    width: "100%", padding: 12, background: "#0F172A",
                    border: "1px solid #1E293B", borderRadius: 8, color: "#F0F4F8",
                    fontSize: 14
                  }}
                />
              </div>

              {/* Threshold */}
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="auto-search-threshold" style={{ display: "block", marginBottom: 8, color: "#F0F4F8", fontSize: 14, fontWeight: 600 }}>
                  Fit Score Threshold: {threshold}%
                </label>
                <input
                  id="auto-search-threshold"
                  type="range"
                  min="50"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B", fontSize: 12, marginTop: 4 }}>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Auto Import */}
              <div style={{
                marginBottom: 24, padding: 16, background: "#0F172A",
                border: `1px solid ${autoImport ? '#10B981' : '#1E293B'}`,
                borderRadius: 8
              }}>
                <label htmlFor="auto-search-auto-import" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                  <input
                    id="auto-search-auto-import"
                    type="checkbox"
                    checked={autoImport}
                    onChange={(e) => setAutoImport(e.target.checked)}
                    style={{ marginRight: 12, width: 18, height: 18, cursor: "pointer" }}
                  />
                  <span style={{ color: "#F0F4F8", fontSize: 14, fontWeight: 600 }}>
                    Auto-Import Matching Jobs
                  </span>
                </label>
                <p style={{ color: "#94A3B8", fontSize: 12, marginTop: 8, marginLeft: 30 }}>
                  {autoImport
                    ? '✅ Jobs above threshold will be automatically saved to your tracker'
                    : '👁️ Preview mode: Jobs will be analyzed but not imported'}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button"
                  onClick={handleSearch}
                  disabled={searching || !keywords}
                  style={{
                    flex: 1, padding: 12, background: searching ? "#1E293B" : "#0A3D2E",
                    border: `1px solid ${searching ? "#64748B" : "#10B981"}`,
                    color: searching ? "#64748B" : "#10B981", borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: searching || !keywords ? "not-allowed" : "pointer"
                  }}
                >
                  {searching ? "🔍 Searching..." : "🚀 Start Search"}
                </button>
                <button type="button"
                  onClick={onClose}
                  style={{
                    padding: 12, background: "none", border: "1px solid #64748B",
                    color: "#94A3B8", borderRadius: 8, fontSize: 14, cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Cached Results Notice */}
              {searchTimestamp && (
                <div style={{
                  background: "#0A1628", border: "1px solid #1E3A5F",
                  borderRadius: 8, padding: 12, marginBottom: 16,
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "#94A3B8" }}>
                      📦 Cached results from {new Date(searchTimestamp).toLocaleString()}
                    </span>
                  </div>
                  <button type="button"
                    onClick={handleNewSearch}
                    style={{
                      padding: "6px 12px", background: "#0A3D2E", border: "1px solid #10B981",
                      color: "#10B981", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    🔄 New Search
                  </button>
                </div>
              )}

              {/* Summary Stats */}
              <div style={{
                background: "#0F172A", border: "1px solid #1E293B",
                borderRadius: 8, padding: 16, marginBottom: 20
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#3B82F6" }}>{results.searched}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Found</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: autoImport ? "#10B981" : "#F59E0B" }}>
                      {autoImport ? results.imported : selectedJobs.size}
                    </div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>{autoImport ? "Imported" : "Selected"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#64748B" }}>{results.skipped}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Skipped</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "#8B5CF6" }}>{results.threshold}%</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>Threshold</div>
                  </div>
                </div>
              </div>

              {/* Job List */}
              {results.results && results.results.length > 0 && !autoImport && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <h3 style={{ color: "#F0F4F8", fontSize: 16, margin: 0 }}>
                      Select Jobs to Import ({selectedJobs.size} selected, {archivedJobs.size} archived)
                    </h3>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button"
                        onClick={() => setShowArchived(!showArchived)}
                        style={{
                          padding: "6px 12px", background: "none", border: "1px solid #64748B",
                          color: showArchived ? "#F59E0B" : "#64748B", borderRadius: 6, fontSize: 12, cursor: "pointer"
                        }}
                      >
                        {showArchived ? "Hide Archived" : "Show Archived"}
                      </button>
                      <button type="button"
                        onClick={handleSelectAll}
                        style={{
                          padding: "6px 12px", background: "none", border: "1px solid #3B82F6",
                          color: "#3B82F6", borderRadius: 6, fontSize: 12, cursor: "pointer"
                        }}
                      >
                        {selectedJobs.size === results.results.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                  </div>

                  <div style={{ maxHeight: 450, overflow: "auto", marginBottom: 20 }}>
                    {getFilteredResults().map((job, index) => {
                      const isArchived = isJobArchived(job)
                      return (
                      <div key={index} style={{
                        background: selectedJobs.has(index) ? "#0F2818" : isArchived ? "#1A1A1A" : "#0F172A",
                        border: `1px solid ${selectedJobs.has(index) ? '#10B981' : isArchived ? '#64748B' : '#1E293B'}`,
                        borderRadius: 8, padding: 16, marginBottom: 12,
                        cursor: "pointer", transition: "all 0.2s",
                        opacity: isArchived ? 0.6 : 1
                      }}
                        onClick={() => handleToggleJob(index)}
                      >
                        <div style={{ display: "flex", gap: 12 }}>
                          {/* Checkbox */}
                          <div style={{ flexShrink: 0, paddingTop: 4 }}>
                            <input
                              id={`search-result-select-${index}`}
                              type="checkbox"
                              checked={selectedJobs.has(index)}
                              onChange={() => handleToggleJob(index)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${job.title} at ${job.company} for import`}
                              style={{ width: 18, height: 18, cursor: "pointer" }}
                            />
                          </div>

                          {/* Job Details */}
                          <div style={{ flex: 1 }}>
                            {/* Title & Company with Archive Button */}
                            <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ color: "#F0F4F8", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                                  {job.title} {isArchived && <span style={{ color: "#64748B", fontSize: 12 }}>(Archived)</span>}
                                </div>
                                <div style={{ color: "#94A3B8", fontSize: 13 }}>
                                  {job.company} • {job.location} • {job.source}
                                </div>
                              </div>
                              <button type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleArchiveJob(job)
                                }}
                                style={{
                                  padding: "4px 8px", background: isArchived ? "#3D2E05" : "#1E293B",
                                  border: `1px solid ${isArchived ? '#F59E0B' : '#64748B'}`,
                                  color: isArchived ? "#F59E0B" : "#94A3B8",
                                  borderRadius: 4, fontSize: 11, cursor: "pointer",
                                  flexShrink: 0
                                }}
                                title={isArchived ? "Unarchive this job" : "Archive this job"}
                              >
                                {isArchived ? "Unarchive" : "Archive"}
                              </button>
                            </div>

                            {/* Role Summary */}
                            {job.roleSummary && (
                              <div style={{
                                color: "#CBD5E1", fontSize: 13, marginBottom: 8,
                                lineHeight: 1.5, display: "-webkit-box",
                                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                                overflow: "hidden"
                              }}>
                                {job.roleSummary}
                              </div>
                            )}

                            {/* Skills & Fit Score */}
                            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <div style={{
                                padding: "4px 10px", background: job.fitScore >= 80 ? "#0A3D2E" : job.fitScore >= 70 ? "#0A2E1A" : "#3D2E05",
                                border: `1px solid ${job.fitScore >= 80 ? '#10B981' : job.fitScore >= 70 ? '#059669' : '#F59E0B'}`,
                                borderRadius: 6, fontSize: 12, fontWeight: 700,
                                color: job.fitScore >= 80 ? '#10B981' : job.fitScore >= 70 ? '#059669' : '#F59E0B'
                              }}>
                                {job.fitScore}% Match
                              </div>

                              {job.keySkills && job.keySkills.slice(0, 3).map((skill, i) => (
                                <div key={i} style={{
                                  padding: "4px 8px", background: "#1E293B",
                                  border: "1px solid #334155", borderRadius: 4,
                                  fontSize: 11, color: "#94A3B8"
                                }}>
                                  {skill}
                                </div>
                              ))}

                              {job.keySkills && job.keySkills.length > 3 && (
                                <span style={{ fontSize: 11, color: "#64748B" }}>
                                  +{job.keySkills.length - 3} more
                                </span>
                              )}
                            </div>

                            {/* Salary if available */}
                            {job.salary && (
                              <div style={{ color: "#10B981", fontSize: 12, marginTop: 6 }}>
                                💰 {job.salary}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                    })}
                  </div>

                  {/* Import Button */}
                  <div style={{ display: "flex", gap: 12 }}>
                    <button type="button"
                      onClick={handleImportSelected}
                      disabled={selectedJobs.size === 0 || importing}
                      style={{
                        flex: 1, padding: 14, background: selectedJobs.size > 0 ? "#0A3D2E" : "#1E293B",
                        border: `1px solid ${selectedJobs.size > 0 ? '#10B981' : '#64748B'}`,
                        color: selectedJobs.size > 0 ? "#10B981" : "#64748B",
                        borderRadius: 8, fontSize: 14, fontWeight: 700,
                        cursor: selectedJobs.size > 0 && !importing ? "pointer" : "not-allowed"
                      }}
                    >
                      {importing ? "Importing..." : `Import ${selectedJobs.size} Selected Job${selectedJobs.size !== 1 ? 's' : ''}`}
                    </button>
                    <button type="button"
                      onClick={onClose}
                      style={{
                        padding: 14, background: "none", border: "1px solid #64748B",
                        color: "#94A3B8", borderRadius: 8, fontSize: 14, cursor: "pointer"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {/* Auto-import mode confirmation */}
              {autoImport && (
                <button type="button"
                  onClick={onClose}
                  style={{
                    width: "100%", padding: 12, background: "#0A3D2E",
                    border: "1px solid #10B981", color: "#10B981", borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: "pointer"
                  }}
                >
                  {results.imported > 0 ? "✅ Done (Refreshing...)" : "Close"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status) {
  const colors = {
    saved: "#64748B",
    applied: "#3B82F6",
    screening: "#8B5CF6",
    interview: "#F59E0B",
    offer: "#10B981",
    accepted: "#059669",
    rejected: "#EF4444",
    withdrawn: "#94A3B8"
  }
  return colors[status] || "#64748B"
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function JobTracker({ onStatsChange } = {}) {
  const [jobs, setJobs] = useState([])
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date-desc")
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [gapAnalysis, setGapAnalysis] = useState(null)
  const [showGapAnalysis, setShowGapAnalysis] = useState(false)
  const [gapAnalysisJobId, setGapAnalysisJobId] = useState(null)
  const [comparison, setComparison] = useState(null)
  const [showComparison, setShowComparison] = useState(false)
  const [roleSuggestions, setRoleSuggestions] = useState(null)
  const [showRoleSuggestions, setShowRoleSuggestions] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showAutoSearch, setShowAutoSearch] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedForBatch, setSelectedForBatch] = useState(new Set())
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchAutoSubmit, setBatchAutoSubmit] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAutocomplete, setShowAutocomplete] = useState(false)

  useEffect(() => {
    loadJobs()
  }, [])

  // Stats are derived from `jobs` so they can be computed every render
  // without any hook-order surprises (NB: must sit above any conditional
  // returns — see https://react.dev/link/rules-of-hooks).
  const headerStats = {
    total: jobs.length,
    applied: jobs.filter(j => ["applied","screening","interview","offer"].includes(j.status)).length,
    interviews: jobs.filter(j => j.status === "interview").length,
    offers: jobs.filter(j => j.status === "offer").length,
  }

  // Bubble stats up to the app-level header so it can render them outside this component.
  useEffect(() => {
    if (typeof onStatsChange === 'function') onStatsChange(headerStats)
  }, [headerStats.total, headerStats.applied, headerStats.interviews, headerStats.offers, onStatsChange])

  // Close the mobile sidebar drawer when the user presses Escape.
  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen])

  const loadJobs = async () => {
    try {
      const data = await fetchJobs()
      setJobs(data)
    } catch (e) {
      console.error("Failed to load jobs:", e)
    }
    setLoading(false)
  }

  const handleAdd = async (jobData) => {
    const created = await createJob(jobData)
    setJobs([created, ...jobs])
    setSelected(created)
  }

  const handleUpdate = async (id, updates) => {
    const updated = await updateJob(id, updates)
    setJobs(jobs.map(j => j.id === id ? updated : j))
    setSelected(updated)
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this job from your tracker?")) return
    await deleteJob(id)
    setJobs(jobs.filter(j => j.id !== id))
    setSelected(null)
  }

  const handleReparse = async (id, url) => {
    try {
      // Parse the job URL again
      const parsed = await parseJob(url)

      // Get the current job to preserve user data
      const currentJob = jobs.find(j => j.id === id)

      // Update with new parsed data while preserving user fields
      const updates = {
        company: parsed.company,
        title: parsed.title,
        location: parsed.location,
        type: parsed.type,
        salary: parsed.salary,
        summary: parsed.summary,
        fitScore: parsed.fitScore,
        fitReason: parsed.fitReason,
        keySkills: parsed.keySkills,
        // Preserve user data
        status: currentJob.status,
        notes: currentJob.notes,
        appliedDate: currentJob.appliedDate,
        lastContact: currentJob.lastContact,
      }

      const updated = await updateJob(id, updates)
      setJobs(jobs.map(j => j.id === id ? updated : j))
      setSelected(updated)
    } catch (error) {
      throw error
    }
  }

  const handleReevaluate = async (id) => {
    try {
      const updated = await reevaluateFit(id)
      setJobs(jobs.map(j => j.id === id ? updated : j))
      if (selected?.id === id) {
        setSelected(updated)
      }
    } catch (error) {
      alert("Failed to re-evaluate fit: " + error.message)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updated = await updateJob(id, { status: newStatus })
      setJobs(jobs.map(j => j.id === id ? updated : j))
      if (selected?.id === id) {
        setSelected(updated)
      }
    } catch (error) {
      alert("Failed to update status: " + error.message)
    }
  }

  const handleGapAnalysis = async (id) => {
    try {
      const analysis = await getGapAnalysis(id)
      setGapAnalysis(analysis)
      setGapAnalysisJobId(id)
      setShowGapAnalysis(true)
    } catch (error) {
      alert("Failed to generate gap analysis: " + error.message)
    }
  }

  const handleRerunGapAnalysis = async () => {
    if (!gapAnalysisJobId) return
    const analysis = await getGapAnalysis(gapAnalysisJobId, { refresh: true })
    setGapAnalysis(analysis)
  }

  const handleGenerateOptimizedResume = async () => {
    if (!gapAnalysisJobId) return
    try {
      const result = await generateOptimizedResume(gapAnalysisJobId)
      window.open(result.url, '_blank')
      setShowGapAnalysis(false)
    } catch (error) {
      throw error
    }
  }

  const handleCompareJobs = async () => {
    // Get two most recently selected jobs, or prompt user
    const savedJobs = jobs.filter(j => j.status === 'saved' || j.status === 'applied')
    if (savedJobs.length < 2) {
      alert("You need at least 2 jobs to compare. Add more jobs first!")
      return
    }

    // For now, compare the two most recent jobs
    // In a full implementation, you could add a job selector UI
    const job1 = savedJobs[0]
    const job2 = savedJobs[1]

    try {
      const result = await compareResumes(job1.id, job2.id)
      setComparison(result)
      setShowComparison(true)
    } catch (error) {
      alert("Failed to compare jobs: " + error.message)
    }
  }

  const handleGetRoleSuggestions = async () => {
    try {
      const result = await getSuggestedRoles()
      setRoleSuggestions(result)
      setShowRoleSuggestions(true)
    } catch (error) {
      alert("Failed to get role suggestions: " + error.message)
    }
  }

  const handleRunBatchAutoApply = async () => {
    if (selectedForBatch.size === 0) {
      alert("Please select at least one job for batch auto-apply")
      return
    }

    const confirmed = confirm(
      `⚠️  BATCH AUTO-APPLY\n\n` +
      `You are about to auto-apply to ${selectedForBatch.size} jobs.\n\n` +
      `${batchAutoSubmit ? '⚠️  AUTO-SUBMIT IS ENABLED - Applications will be submitted automatically!' : 'Forms will be filled but NOT submitted (you can review first).'}\n\n` +
      `This will run in the background and may take several minutes.\n\n` +
      `Continue?`
    )

    if (!confirmed) return

    setBatchProcessing(true)
    try {
      const jobIds = Array.from(selectedForBatch)
      const result = await batchAutoApply(jobIds, batchAutoSubmit)

      alert(
        `Batch Auto-Apply Complete!\n\n` +
        `Total: ${result.total}\n` +
        `Successful: ${result.successful}\n` +
        `Submitted: ${result.submitted}\n` +
        `Failed: ${result.failed}`
      )

      // Reload jobs to show updated statuses
      await loadJobs()
      setSelectedForBatch(new Set())
      setBatchMode(false)
    } catch (error) {
      alert(`Batch auto-apply failed: ${error.message}`)
    }
    setBatchProcessing(false)
  }

  const handleToggleBatchSelection = (jobId) => {
    const newSelected = new Set(selectedForBatch)
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId)
    } else {
      newSelected.add(jobId)
    }
    setSelectedForBatch(newSelected)
  }

  const handleShowAnalytics = async () => {
    try {
      const result = await getAnalytics()
      setAnalytics(result)
      setShowAnalytics(true)
    } catch (error) {
      alert("Failed to load analytics: " + error.message)
    }
  }

  const handleExportCSV = () => {
    exportCSV()
  }

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#64748B" }}>Loading...</div>
  }

  // Apply status filter
  let filtered = filter === "all" ? jobs :
                 filter === "unapplied" ? jobs.filter(j => j.status === "saved" && !j.appliedDate) :
                 jobs.filter(j => j.status === filter)

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    filtered = filtered.filter(job => {
      const searchableFields = [
        job.company,
        job.title,
        job.location,
        job.summary,
        job.notes,
        ...(job.keySkills || [])
      ].filter(Boolean).map(f => String(f).toLowerCase())

      return searchableFields.some(field => field.includes(query))
    })
  }

  // Generate autocomplete suggestions
  const generateSuggestions = () => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []

    const query = searchQuery.toLowerCase().trim()
    const suggestions = new Set()

    jobs.forEach(job => {
      // Add matching companies
      if (job.company && job.company.toLowerCase().includes(query)) {
        suggestions.add(job.company)
      }
      // Add matching job titles
      if (job.title && job.title.toLowerCase().includes(query)) {
        suggestions.add(job.title)
      }
      // Add matching locations
      if (job.location && job.location.toLowerCase().includes(query)) {
        suggestions.add(job.location)
      }
      // Add matching skills
      if (job.keySkills) {
        job.keySkills.forEach(skill => {
          if (skill.toLowerCase().includes(query)) {
            suggestions.add(skill)
          }
        })
      }
    })

    return Array.from(suggestions).slice(0, 8) // Limit to 8 suggestions
  }

  const autocompleteSuggestions = generateSuggestions()

  // Apply sorting
  filtered = [...filtered].sort((a, b) => {
    switch(sortBy) {
      case "date-desc":
        return new Date(b.savedDate || b.createdAt) - new Date(a.savedDate || a.createdAt)
      case "date-asc":
        return new Date(a.savedDate || a.createdAt) - new Date(b.savedDate || b.createdAt)
      case "fit-desc":
        return (b.fitScore || 0) - (a.fitScore || 0)
      case "fit-asc":
        return (a.fitScore || 0) - (b.fitScore || 0)
      case "company":
        return (a.company || "").localeCompare(b.company || "")
      case "title":
        return (a.title || "").localeCompare(b.title || "")
      default:
        return 0
    }
  })

  const followUps = jobs.filter(needsFollowUp)

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#030A14", fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      color: "#E2E8F0", overflow: "hidden", minHeight: 0
    }}>
      {/* Actions toolbar (the app-level header above renders brand + stats) */}
      <div
        id="jt-actions"
        className="jt-actions"
        role="toolbar"
        aria-label="Job tracker actions"
      >
        <div className="jt-actions__group">
          <button
            type="button"
            className="jt-sidebar-toggle"
            aria-label={sidebarOpen ? 'Close job list' : 'Open job list'}
            aria-controls="jt-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(o => !o)}
          >
            <span aria-hidden="true">☰</span>
          </button>

          {followUps.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              aria-label={`${followUps.length} job${followUps.length > 1 ? 's' : ''} need${followUps.length === 1 ? 's' : ''} follow-up`}
              style={{ padding: "6px 14px", background: "#3D2E05", borderRadius: 20, border: "1px solid #F59E0B44", fontSize: 12, color: "#F59E0B", fontWeight: 700, whiteSpace: "nowrap" }}
            >
              <span aria-hidden="true">⚡</span>
              <span className="jt-btn-label">&nbsp;{followUps.length} follow-up{followUps.length > 1 ? "s" : ""} needed</span>
              <span className="sr-only">{followUps.length} follow-up{followUps.length > 1 ? "s" : ""} needed</span>
            </div>
          )}
        </div>

        <div className="jt-actions__spacer" aria-hidden="true" />

        <div className="jt-actions__group">
          <button
            type="button"
            onClick={handleCompareJobs}
            aria-label="Compare two jobs side-by-side"
            style={{
              padding: "8px 14px", background: "#0A1A2E", border: "1px solid #8B5CF6",
              color: "#8B5CF6", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 40
            }}
          >
            <span aria-hidden="true">⚖️</span><span className="jt-btn-label">Compare</span>
          </button>
          <button
            type="button"
            onClick={handleGetRoleSuggestions}
            aria-label="Get ideal role suggestions"
            style={{
              padding: "8px 14px", background: "#0A1A2E", border: "1px solid #F59E0B",
              color: "#F59E0B", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 40
            }}
          >
            <span aria-hidden="true">💼</span><span className="jt-btn-label">Ideal Roles</span>
          </button>
          <button
            type="button"
            onClick={handleShowAnalytics}
            aria-label="View application analytics"
            style={{
              padding: "8px 14px", background: "#0A1A2E", border: "1px solid #3B82F6",
              color: "#3B82F6", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 40
            }}
          >
            <span aria-hidden="true">📊</span><span className="jt-btn-label">Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAutoSearch(true)}
            aria-label="Automated job search"
            style={{
              padding: "8px 14px", background: "#0A1A2E", border: "1px solid #10B981",
              color: "#10B981", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 40
            }}
          >
            <span aria-hidden="true">🤖</span><span className="jt-btn-label">Auto Search</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBatchMode(!batchMode)
              if (batchMode) setSelectedForBatch(new Set())
            }}
            aria-label={batchMode ? `Exit batch auto-apply mode (${selectedForBatch.size} selected)` : 'Enter batch auto-apply mode'}
            aria-pressed={batchMode}
            style={{
              padding: "8px 14px", background: batchMode ? "#1E3A8A" : "#0A1A2E",
              border: `1px solid ${batchMode ? '#60A5FA' : '#3B82F6'}`,
              color: batchMode ? "#60A5FA" : "#3B82F6",
              borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 40
            }}
          >
            <span aria-hidden="true">🚀</span>
            <span className="jt-btn-label">{batchMode ? `Batch (${selectedForBatch.size})` : 'Batch Auto-Apply'}</span>
          </button>
          <a
            href="/resume"
            aria-label="Manage resume template"
            style={{
              padding: "8px 14px", background: "#0A3D2E", border: "1px solid #10B981",
              color: "#10B981", borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: "pointer", textDecoration: "none", display: "inline-flex",
              alignItems: "center", gap: 6, minHeight: 40
            }}
          >
            <span aria-hidden="true">📄</span><span className="jt-btn-label">Resume</span>
          </a>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            aria-label="Add new job to tracker"
            style={{
              padding: "8px 18px", background: "#1D4ED8", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
              minHeight: 40
            }}
          >
            <span aria-hidden="true">+</span><span className="jt-btn-label">&nbsp;Add Job</span>
            <span className="sr-only">Add Job</span>
          </button>
        </div>
      </div>

      {/* Batch Mode Controls (separate row, full width) */}
      <div role="region" aria-label="Batch mode controls" aria-hidden={!batchMode}>
        {batchMode && (
          <div style={{
            padding: "12px 16px",
            background: "#0A1628",
            borderTop: "1px solid #1E3A5F",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#F0F4F8", fontSize: 13, fontWeight: 600 }}>
                {selectedForBatch.size} job{selectedForBatch.size !== 1 ? 's' : ''} selected
              </span>
              <label htmlFor="batch-auto-submit" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  id="batch-auto-submit"
                  type="checkbox"
                  checked={batchAutoSubmit}
                  onChange={(e) => setBatchAutoSubmit(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <span style={{ color: batchAutoSubmit ? "#F59E0B" : "#94A3B8", fontSize: 13, fontWeight: 600 }}>
                  ⚠️  Auto-Submit (Dangerous!)
                </span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button"
                onClick={handleRunBatchAutoApply}
                disabled={selectedForBatch.size === 0 || batchProcessing}
                style={{
                  padding: "6px 12px",
                  background: selectedForBatch.size > 0 ? "#1E3A8A" : "#1E293B",
                  border: `1px solid ${selectedForBatch.size > 0 ? '#60A5FA' : '#64748B'}`,
                  color: selectedForBatch.size > 0 ? "#60A5FA" : "#64748B",
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selectedForBatch.size > 0 && !batchProcessing ? "pointer" : "not-allowed"
                }}
              >
                {batchProcessing ? "Processing..." : `🚀 Run Batch Apply`}
              </button>
              <button type="button"
                onClick={() => {
                  setBatchMode(false)
                  setSelectedForBatch(new Set())
                }}
                style={{
                  padding: "6px 12px",
                  background: "none",
                  border: "1px solid #64748B",
                  color: "#94A3B8",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <main
        id="main-content"
        role="main"
        style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}
      >
        {/* Mobile backdrop — only rendered when sidebar drawer is open */}
        {sidebarOpen && (
          <div
            className="jt-sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar (becomes a slide-out drawer on mobile via CSS) */}
        <aside
          id="jt-sidebar"
          className={`jt-sidebar${sidebarOpen ? ' jt-sidebar--open' : ''}`}
          aria-label="Job list and filters"
          aria-hidden={false /* sidebar is always reachable; on mobile it is collapsed visually via CSS */}
          style={{
            width: 300, flexShrink: 0, borderRight: "1px solid #0D1F35",
            display: "flex", flexDirection: "column", overflow: "hidden"
          }}
        >
          {/* Filter tabs */}
          <nav
            aria-label="Job status filters"
            style={{ padding: "12px 16px", borderBottom: "1px solid #0D1F35", display: "flex", flexWrap: "wrap", gap: 6 }}
          >
            {[
              { key: "all", label: "All" },
              { key: "unapplied", label: "Unapplied", color: "#F59E0B" },
              ...STATUSES
            ].map(s => (
              <button type="button"
                key={s.key}
                onClick={() => setFilter(s.key)}
                aria-pressed={filter === s.key}
                aria-label={`Filter by ${s.label} status`}
                style={{
                  padding: "4px 10px", borderRadius: 6, border: "none",
                  background: filter === s.key ? "#1D4ED8" : "#0A1628",
                  color: filter === s.key ? "#fff" : "#64748B",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  letterSpacing: "0.04em"
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Sort controls */}
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #0D1F35", display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="sort-select" style={{ fontSize: 10, color: "#64748B", fontWeight: 700, letterSpacing: "0.1em" }}>
              SORT BY:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort jobs by"
              style={{
                flex: 1,
                background: "#0A1628",
                border: "1px solid #1A2E45",
                borderRadius: 6,
                padding: "4px 8px",
                color: "#E2E8F0",
                fontSize: 11,
                cursor: "pointer"
              }}
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="fit-desc">Best Fit First</option>
              <option value="fit-asc">Worst Fit First</option>
              <option value="company">Company (A-Z)</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {/* Search box */}
          <div style={{ padding: "8px 16px", borderBottom: "1px solid #0D1F35", position: "relative" }}>
            <div style={{ position: "relative" }}>
              <input
                id="job-search-input"
                type="text"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowAutocomplete(e.target.value.trim().length >= 2)
                }}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) {
                    setShowAutocomplete(true)
                  }
                }}
                onBlur={() => {
                  // Delay to allow clicking on suggestions
                  setTimeout(() => setShowAutocomplete(false), 200)
                }}
                aria-label="Search jobs by company, title, location, or skills"
                style={{
                  width: "100%",
                  background: "#0A1628",
                  border: "1px solid #1A2E45",
                  borderRadius: 6,
                  padding: "8px 32px 8px 12px",
                  color: "#E2E8F0",
                  fontSize: 12,
                  outline: "none"
                }}
              />
              <span style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748B",
                fontSize: 14,
                pointerEvents: "none"
              }}>
                🔍
              </span>
              {searchQuery && (
                <button type="button"
                  onClick={() => {
                    setSearchQuery("")
                    setShowAutocomplete(false)
                  }}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: 32,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#64748B",
                    fontSize: 16,
                    cursor: "pointer",
                    padding: 2
                  }}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            {showAutocomplete && autocompleteSuggestions.length > 0 && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 16,
                right: 16,
                background: "#0A1628",
                border: "1px solid #1A2E45",
                borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                zIndex: 1000,
                maxHeight: 200,
                overflowY: "auto"
              }}>
                {autocompleteSuggestions.map((suggestion, index) => (
                  <button type="button"
                    key={index}
                    onClick={() => {
                      setSearchQuery(suggestion)
                      setShowAutocomplete(false)
                    }}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      background: "transparent",
                      border: "none",
                      borderBottom: index < autocompleteSuggestions.length - 1 ? "1px solid #0D1F35" : "none",
                      color: "#E2E8F0",
                      fontSize: 12,
                      textAlign: "left",
                      cursor: "pointer",
                      display: "block"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#1A2E45"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Job list */}
          <div
            role="list"
            aria-label={`${filtered.length} job${filtered.length !== 1 ? 's' : ''}`}
            style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
          >
            {filtered.length === 0 ? (
              <div
                role="status"
                aria-live="polite"
                style={{ textAlign: "center", color: "#374151", padding: "40px 16px", fontSize: 13, lineHeight: 1.6 }}
              >
                {jobs.length === 0 ? "No jobs tracked yet. Click + Add Job to get started." : "No jobs match this filter."}
              </div>
            ) : filtered.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onSelect={(j) => { setSelected(j); setSidebarOpen(false) }}
                selected={selected?.id === job.id}
                onReparse={handleReparse}
                onReevaluate={handleReevaluate}
                onStatusChange={handleStatusChange}
                batchMode={batchMode}
                batchSelected={selectedForBatch.has(job.id)}
                onBatchToggle={handleToggleBatchSelection}
              />
            ))}
          </div>
        </aside>

        {/* Detail pane */}
        <div
          style={{ flex: 1, overflow: "hidden", background: "#070E1A" }}
          role="region"
          aria-label="Job details"
        >
          {selected ? (
            <JobDetail
              job={selected}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onReparse={handleReparse}
              onGapAnalysis={handleGapAnalysis}
            />
          ) : (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", height: "100%", gap: 16, color: "#1A2E45"
              }}
            >
              <div style={{ fontSize: 64 }} aria-hidden="true">📋</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Select a job to view details</div>
              <div style={{ fontSize: 13, color: "#0D1F35" }}>or click + Add Job to start tracking</div>
            </div>
          )}
        </div>
      </main>

      {showAdd && <AddJobModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
      {showGapAnalysis && <GapAnalysisModal analysis={gapAnalysis} onClose={() => setShowGapAnalysis(false)} onGenerateOptimizedResume={handleGenerateOptimizedResume} onRerun={handleRerunGapAnalysis} />}
      {showComparison && <ResumeComparisonModal comparison={comparison} onClose={() => setShowComparison(false)} />}
      {showRoleSuggestions && <RoleSuggestionsModal suggestions={roleSuggestions} onClose={() => setShowRoleSuggestions(false)} />}
      {showAnalytics && <AnalyticsDashboard analytics={analytics} onClose={() => setShowAnalytics(false)} onExport={handleExportCSV} />}
      {showAutoSearch && <AutoSearchModal onClose={() => setShowAutoSearch(false)} onSearch={loadJobs} />}
    </div>
  )
}
