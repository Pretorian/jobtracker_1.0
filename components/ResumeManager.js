'use client'

import { useState, useEffect } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001/api'

export default function ResumeManager() {
  const [templateInfo, setTemplateInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadTemplateInfo()
  }, [])

  const loadTemplateInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/resume/template`, {
        credentials: 'include',
      })
      const data = await res.json()
      setTemplateInfo(data)
    } catch (error) {
      console.error('Failed to load template info:', error)
      setMessage({ type: 'error', text: 'Failed to load template info' })
    }
    setLoading(false)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.name.endsWith('.docx')) {
      setMessage({ type: 'error', text: 'Please upload a .docx file' })
      return
    }

    setUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('template', file)

      const res = await fetch(`${API_BASE}/resume/template/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setMessage({ type: 'success', text: 'Template uploaded successfully!' })
      await loadTemplateInfo()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }

    setUploading(false)
    e.target.value = '' // Reset file input
  }

  const handleDownload = () => {
    window.open(`${API_BASE}/resume/template/download`, '_blank')
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete the master resume template? A backup will be saved.')) {
      return
    }

    try {
      const res = await fetch(`${API_BASE}/resume/template`, {
        method: 'DELETE',
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Delete failed')
      }

      setMessage({ type: 'success', text: `Template deleted (backup: ${data.backupPath})` })
      await loadTemplateInfo()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#030A14', color: '#64748B'
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#030A14',
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      color: '#E2E8F0', padding: 24
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 800, margin: '0 auto',
        borderBottom: '1px solid #0D1F35', paddingBottom: 24, marginBottom: 32
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <a href="/" aria-label="Back to dashboard" style={{
            color: '#64748B', textDecoration: 'none',
            fontSize: 24, cursor: 'pointer'
          }}><span aria-hidden="true">←</span></a>
          <h1 style={{
            fontSize: 24, fontWeight: 800, margin: 0,
            background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Master Resume Template</h1>
        </div>
        <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>
          Manage your master resume template for automatic resume generation
        </p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Message */}
        {message && (
          <div style={{
            padding: '12px 16px', borderRadius: 8, marginBottom: 24,
            background: message.type === 'success' ? '#0A3D2E' : '#3D1515',
            border: `1px solid ${message.type === 'success' ? '#10B981' : '#EF4444'}`,
            color: message.type === 'success' ? '#10B981' : '#EF4444'
          }}>
            {message.text}
          </div>
        )}

        {/* Template Status */}
        <div style={{
          background: '#0A1628', border: '1px solid #1A2E45',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0', marginBottom: 16 }}>
            Current Template
          </h2>

          {templateInfo?.exists ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ color: '#64748B', fontSize: 13 }}>Status:</div>
                <div style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>✅ Template exists</div>

                <div style={{ color: '#64748B', fontSize: 13 }}>Size:</div>
                <div style={{ color: '#E2E8F0', fontSize: 13 }}>{templateInfo.sizeFormatted}</div>

                <div style={{ color: '#64748B', fontSize: 13 }}>Last Modified:</div>
                <div style={{ color: '#E2E8F0', fontSize: 13 }}>
                  {new Date(templateInfo.lastModified).toLocaleString()}
                </div>

                <div style={{ color: '#64748B', fontSize: 13 }}>Path:</div>
                <div style={{ color: '#64748B', fontSize: 11, fontFamily: 'monospace' }}>
                  {templateInfo.path}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={handleDownload} style={{
                  padding: '10px 18px', background: '#1D4ED8', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}>
                  📥 Download Template
                </button>
                <button type="button" onClick={handleDelete} style={{
                  padding: '10px 18px', background: 'none', border: '1px solid #3D1515',
                  color: '#EF4444', borderRadius: 8, fontSize: 13, cursor: 'pointer'
                }}>
                  🗑️ Delete
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{
                padding: '16px', background: '#3D2E05', borderRadius: 8,
                border: '1px solid #F59E0B44', marginBottom: 16
              }}>
                <div style={{ color: '#F59E0B', fontSize: 13 }}>
                  ⚠️ No template found. Upload a .docx file to enable resume generation.
                </div>
              </div>
              <div style={{ color: '#64748B', fontSize: 11, fontFamily: 'monospace' }}>
                Expected location: {templateInfo?.path}
              </div>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div style={{
          background: '#0A1628', border: '1px solid #1A2E45',
          borderRadius: 12, padding: 24, marginBottom: 24
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0', marginBottom: 16 }}>
            Upload New Template
          </h2>

          <div style={{
            border: '2px dashed #1A2E45', borderRadius: 8,
            padding: 32, textAlign: 'center', marginBottom: 16
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <label htmlFor="resume-template-upload" style={{
              display: 'inline-block', padding: '10px 20px',
              background: uploading ? '#1A2E45' : '#1D4ED8',
              color: '#fff', borderRadius: 8, fontSize: 14,
              fontWeight: 600, cursor: uploading ? 'wait' : 'pointer'
            }}>
              {uploading ? 'Uploading...' : 'Choose .docx File'}
              <input
                id="resume-template-upload"
                type="file"
                accept=".docx"
                onChange={handleFileUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
            <div style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
              Only .docx files are supported (max 10MB)
            </div>
          </div>

          {templateInfo?.exists && (
            <div style={{
              padding: '12px 16px', background: '#0A1A2E', borderRadius: 6,
              fontSize: 12, color: '#94A3B8', borderLeft: '3px solid #3B82F6'
            }}>
              💡 Uploading a new template will backup the existing one automatically
            </div>
          )}
        </div>

        {/* Template Variables Guide */}
        <div style={{
          background: '#0A1628', border: '1px solid #1A2E45',
          borderRadius: 12, padding: 24
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#E2E8F0', marginBottom: 16 }}>
            Template Variables
          </h2>

          <p style={{ color: '#94A3B8', fontSize: 13, lineHeight: 1.7, marginBottom: 16 }}>
            Use these variables in your resume. They'll be replaced automatically when generating resumes:
          </p>

          <div style={{ display: 'grid', gap: 12 }}>
            {[
              { var: '{targetCompany}', desc: 'Company name (e.g., "Google", "Microsoft")' },
              { var: '{targetRole}', desc: 'Job title (e.g., "Senior Software Engineer")' },
              { var: '{targetLocation}', desc: 'Location (e.g., "Remote", "San Francisco, CA")' },
              { var: '{date}', desc: 'Current date in "Month DD, YYYY" format' },
              { var: '{objective}', desc: 'AI-tailored career objective for the role' },
              { var: '{summary}', desc: 'AI-tailored professional summary' },
              { var: '{skills}', desc: 'Key skills for the job, comma-separated' },
              { var: '{keyAchievements}', desc: 'AI-generated achievement bullets (multi-line)' },
              { var: '{relevantExperience}', desc: 'AI-reframed relevant experience (multi-line)' },
            ].map(item => (
              <div key={item.var} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12,
                padding: '10px 12px', background: '#060F1A', borderRadius: 6
              }}>
                <code style={{
                  color: '#7DD3FC', fontSize: 12,
                  fontFamily: "'DM Mono', monospace"
                }}>{item.var}</code>
                <span style={{ color: '#94A3B8', fontSize: 12 }}>{item.desc}</span>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: '16px', background: '#0A1A2E',
            borderRadius: 8, borderLeft: '3px solid #10B981'
          }}>
            <div style={{ color: '#10B981', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
              Example Usage
            </div>
            <div style={{
              color: '#94A3B8', fontSize: 12, lineHeight: 1.7,
              fontFamily: "'DM Mono', monospace"
            }}>
              "I am excited to apply for the{' '}
              <span style={{ color: '#7DD3FC' }}>&#123;targetRole&#125;</span>
              {' '}position at{' '}
              <span style={{ color: '#7DD3FC' }}>&#123;targetCompany&#125;</span>."
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
