import { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Upload, FileText, Image as ImageIcon, Loader,
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
  Trash2, Sparkles, Users, Eye, PenLine, RotateCcw, AlertTriangle,
} from 'lucide-react'
import { CATEGORIES, PIPELINE_STAGES } from '../data/mockData'
import { analyzeResume, hasApiKey } from '../services/resumeParser'

const baseInput = {
  width: '100%', background: '#0d1117', border: '1px solid #1e2533',
  borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#d1d5db',
  outline: 'none', fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box',
}

const EMPTY_FORM = () => ({
  name: '', phone: '', email: '', role: '',
  category: 'Engineering', status: 'Home Coming',
  location: '', nationality: '', education: '', experience: '', notes: '',
})

const STATUS_UI = {
  queued:     { icon: Clock,        color: '#4a5568',  label: 'Queued'     },
  processing: { icon: Loader,       color: '#4f8ff7',  label: 'Analyzing…' },
  done:       { icon: CheckCircle,  color: '#22c55e',  label: 'Ready'      },
  error:      { icon: AlertCircle,  color: '#ef4444',  label: 'Failed'     },
  manual:     { icon: PenLine,      color: '#0ea5e9',  label: 'Manual'     },
  'no-key':   { icon: AlertCircle,  color: '#eab308',  label: 'No API Key' },
}

let UID = 0
const uid = () => String(++UID)

// ── Normalize phone: keep digits only ─────────────────────────────────────────
function normalizePhone(p) {
  return (p || '').replace(/\D/g, '')
}

// ── Find matching existing candidate by phone (primary) or email (fallback) ───
function findDuplicate(form, existingCandidates) {
  if (!existingCandidates?.length) return null
  const phone = normalizePhone(form.phone)
  const email = form.email?.trim().toLowerCase()
  // Phone is the hard check — must be 7+ digits
  if (phone.length >= 7) {
    const match = existingCandidates.find((c) => normalizePhone(c.phone) === phone)
    if (match) return { candidate: match, by: 'phone' }
  }
  // Email fallback
  if (email && email.includes('@')) {
    const match = existingCandidates.find((c) => c.email?.trim().toLowerCase() === email)
    if (match) return { candidate: match, by: 'email' }
  }
  return null
}

// ── Check within-batch: does this form match any OTHER item in the same upload ─
function findBatchDuplicate(form, items, selfId) {
  const phone = normalizePhone(form.phone)
  const email = form.email?.trim().toLowerCase()
  if (phone.length < 7 && !email?.includes('@')) return null
  return items.find((i) => {
    if (i.id === selfId) return false
    const f = i.form
    if (phone.length >= 7 && normalizePhone(f.phone) === phone) return true
    if (email?.includes('@') && f.email?.trim().toLowerCase() === email) return true
    return false
  }) || null
}

export default function BulkUploadModal({ onClose, onAddMultiple, existingCandidates = [] }) {
  const fileInputRef        = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [items, setItems]   = useState([])
  const [previewItemId, setPreviewItemId] = useState(null)  // for full-screen preview

  // ── add files ─────────────────────────────────────────────────────────────
  const addFiles = useCallback((files) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    const valid = Array.from(files).filter(
      (f) => allowed.includes(f.type) || f.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i)
    )
    if (!valid.length) return
    setItems((prev) => [
      ...prev,
      ...valid.map((file) => ({
        id:         uid(),
        file,
        previewUrl: URL.createObjectURL(file),
        status:     hasApiKey() ? 'queued' : 'no-key',
        form:       EMPTY_FORM(),
        aiFields:   new Set(),
        dupMatch:   null,    // { candidate, by } or batch item
        dupSource:  null,    // 'existing' | 'batch'
        error:      '',
        expanded:   false,
      })),
    ])
  }, [])

  // ── sequential AI processing ──────────────────────────────────────────────
  useEffect(() => {
    const nextQueued = items.find((i) => i.status === 'queued')
    const isRunning  = items.some((i) => i.status === 'processing')
    if (!nextQueued || isRunning) return

    setItems((prev) => prev.map((i) => i.id === nextQueued.id ? { ...i, status: 'processing' } : i))

    analyzeResume(nextQueued.file)
      .then((extracted) => {
        setItems((prev) => prev.map((i) => {
          if (i.id !== nextQueued.id) return i
          const form = EMPTY_FORM()
          const aiFields = new Set()
          const fieldMap = {
            name: 'name', phone: 'phone', email: 'email', role: 'role',
            experience: 'experience', education: 'education',
            location: 'location', nationality: 'nationality',
          }
          for (const [k, fk] of Object.entries(fieldMap)) {
            const v = extracted[k]
            if (v && String(v).trim()) { form[fk] = String(v).trim(); aiFields.add(fk) }
          }
          if (extracted.category && CATEGORIES.includes(extracted.category)) {
            form.category = extracted.category; aiFields.add('category')
          }
          const existMatch = findDuplicate(form, existingCandidates)
          const batchMatch = existMatch ? null : findBatchDuplicate(form, prev, nextQueued.id)
          return {
            ...i, status: 'done', form, aiFields,
            dupMatch:  existMatch ?? (batchMatch ? { candidate: batchMatch, by: 'batch' } : null),
            dupSource: existMatch ? 'existing' : batchMatch ? 'batch' : null,
          }
        }))
      })
      .catch((err) => {
        setItems((prev) => prev.map((i) =>
          i.id === nextQueued.id
            ? { ...i, status: 'error', error: err.message || 'Extraction failed', expanded: true }
            : i
        ))
      })
  }, [items, existingCandidates])

  // ── helpers ───────────────────────────────────────────────────────────────
  const removeItem = (id) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((i) => i.id !== id)
    })
  }

  const toggleExpand = (id) =>
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, expanded: !i.expanded } : i))

  const markManual = (id) =>
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'manual', expanded: true, error: '' } : i))

  const retryItem = (id) =>
    setItems((prev) => prev.map((i) =>
      i.id === id ? { ...i, status: hasApiKey() ? 'queued' : 'no-key', error: '', expanded: false } : i
    ))

  const updateForm = (id, field, value) =>
    setItems((prev) => prev.map((i) => {
      if (i.id !== id) return i
      const aiFields = new Set(i.aiFields); aiFields.delete(field)
      const newForm = { ...i.form, [field]: value }
      const existMatch = findDuplicate(newForm, existingCandidates)
      const batchMatch = existMatch ? null : findBatchDuplicate(newForm, prev, id)
      return {
        ...i, form: newForm, aiFields,
        dupMatch:  existMatch ?? (batchMatch ? { candidate: batchMatch, by: 'batch' } : null),
        dupSource: existMatch ? 'existing' : batchMatch ? 'batch' : null,
      }
    }))

  // items eligible to be added — duplicates are ALWAYS blocked
  const addableStatuses = new Set(['done', 'manual', 'no-key'])
  const readyItems = items.filter((i) => addableStatuses.has(i.status) && i.form.name.trim() && i.form.role.trim() && !i.dupMatch)
  const dupItems   = items.filter((i) => i.dupMatch)

  const handleAddAll = () => {
    const toAdd = readyItems.map((i) => ({
      ...i.form,
      id:            Date.now().toString() + Math.random().toString(36).slice(2),
      date_added:    new Date().toISOString().split('T')[0],
      resume_url:    null,
      docs_complete: false,
      _resumeFile:   i.file,   // passed to App.jsx → Drive upload
    }))
    onAddMultiple(toAdd)
    onClose()
  }

  // ── preview item ──────────────────────────────────────────────────────────
  const previewItem = items.find((i) => i.id === previewItemId)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 18, width: '96%', maxWidth: 820, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 100px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} color="#a78bfa" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Bulk Resume Upload</div>
              <div style={{ fontSize: 12, color: '#8b95a8' }}>Upload multiple resumes — AI fills each candidate automatically</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Drop zone */}
        <div style={{ padding: '14px 24px 0', flexShrink: 0 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#a78bfa' : '#1e2533'}`,
              borderRadius: 12, padding: '16px 20px',
              background: dragOver ? 'rgba(167,139,250,0.06)' : '#0d1117',
              display: 'flex', alignItems: 'center', gap: 14,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Upload size={18} color="#a78bfa" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d1d5db', marginBottom: 2 }}>Drop multiple resumes here</div>
              <div style={{ fontSize: 11, color: '#4a5568' }}>
                PDF, JPG, PNG — select or drop as many files as needed
                {hasApiKey()
                  ? <span style={{ marginLeft: 8, color: '#a78bfa', fontWeight: 600 }}>✨ AI extraction active</span>
                  : <span style={{ marginLeft: 8, color: '#eab308' }}> · Add VITE_OPENAI_API_KEY to .env for AI</span>
                }
              </div>
            </div>
            {items.length > 0 && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{items.length}</div>
                <div style={{ fontSize: 10, color: '#4a5568' }}>files</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => addFiles(e.target.files)} style={{ display: 'none' }} />
        </div>

        {/* Queue */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 8px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#4a5568' }}>
              <Upload size={28} style={{ margin: '0 auto 10px', opacity: 0.2 }} />
              <div style={{ fontSize: 13 }}>No files yet — drop resumes above</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((item, idx) => {
                const st      = STATUS_UI[item.status] || STATUS_UI.queued
                const StIcon  = st.icon
                const spinning = item.status === 'processing'
                const isPDF   = item.file.type === 'application/pdf' || item.file.name.endsWith('.pdf')
                const canExpand = ['done', 'manual', 'no-key', 'error'].includes(item.status)
                const borderColor = item.dupMatch ? 'rgba(239,68,68,0.4)'
                  : item.status === 'done' || item.status === 'manual' ? 'rgba(34,197,94,0.2)'
                  : item.status === 'error' ? 'rgba(239,68,68,0.2)'
                  : '#1e2533'

                return (
                  <div key={item.id} style={{ background: '#0d1117', border: `1px solid ${borderColor}`, borderRadius: 10, overflow: 'hidden' }}>

                    {/* Row */}
                    <div style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
                      {/* File icon */}
                      <div style={{ width: 30, height: 30, borderRadius: 7, background: '#111620', border: '1px solid #1a2133', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isPDF ? <FileText size={13} color="#4f8ff7" /> : <ImageIcon size={13} color="#4f8ff7" />}
                      </div>

                      {/* Index + info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace' }}>#{idx + 1}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(item.status === 'done' || item.status === 'manual') && item.form.name
                              ? item.form.name
                              : item.file.name}
                          </span>
                          {item.dupMatch && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                              <AlertTriangle size={8} /> Already Exists
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.status === 'done' || item.status === 'manual'
                            ? [item.form.role, item.form.nationality, item.form.phone, item.form.location].filter(Boolean).join(' · ')
                            : item.status === 'error'
                              ? item.error
                              : item.file.name}
                        </div>
                      </div>

                      {/* Status chip */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: st.color, background: `${st.color}15`, border: `1px solid ${st.color}30`, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>
                        <StIcon size={10} style={spinning ? { animation: 'spin 1s linear infinite' } : {}} />
                        {st.label}
                      </div>

                      {/* Preview button */}
                      <button
                        onClick={() => setPreviewItemId(item.id)}
                        title="Preview resume"
                        style={{ background: 'rgba(79,143,247,0.08)', border: '1px solid rgba(79,143,247,0.2)', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: '#4f8ff7', display: 'flex', alignItems: 'center' }}
                      >
                        <Eye size={11} />
                      </button>

                      {/* Enter Manually (for error/no-key) */}
                      {(item.status === 'error' || item.status === 'no-key') && (
                        <button
                          onClick={() => markManual(item.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#0ea5e9', fontSize: 10, fontWeight: 700, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
                        >
                          <PenLine size={10} /> Enter Manually
                        </button>
                      )}

                      {/* Retry (for error) */}
                      {item.status === 'error' && hasApiKey() && (
                        <button
                          onClick={() => retryItem(item.id)}
                          title="Retry AI extraction"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '4px 6px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                        >
                          <RotateCcw size={10} />
                        </button>
                      )}

                      {/* Expand/collapse (done/manual/no-key) */}
                      {canExpand && item.status !== 'error' && (
                        <button
                          onClick={() => toggleExpand(item.id)}
                          style={{ background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', borderRadius: 5, padding: '4px 8px', cursor: 'pointer', color: '#4f8ff7', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}
                        >
                          {item.expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                          Edit
                        </button>
                      )}

                      {/* Remove */}
                      <button onClick={() => removeItem(item.id)} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 5, padding: '4px 5px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* Expanded form */}
                    {item.expanded && (
                      <div style={{ borderTop: '1px solid #1a2133', padding: '12px 14px', background: '#111620' }}>
                        {item.status === 'manual' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: '#0ea5e9', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 6, padding: '5px 10px' }}>
                            <PenLine size={11} /> Manual entry mode — fill in the candidate details below
                          </div>
                        )}
                        {item.aiFields.size > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, fontSize: 11, color: '#a78bfa' }}>
                            <Sparkles size={11} />
                            <span style={{ fontWeight: 600 }}>{item.aiFields.size} fields auto-filled by AI</span>
                            <span style={{ color: '#4a5568' }}>— edit any field below</span>
                          </div>
                        )}
                        {item.dupMatch && (
                          <div style={{ marginBottom: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 7, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>
                                  Duplicate blocked — candidate already exists
                                </div>
                                {item.dupSource === 'batch' ? (
                                  <div style={{ fontSize: 11, color: '#8b95a8' }}>
                                    Matches another resume in this batch with the same {item.dupMatch.by}.
                                    Remove one to proceed.
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: '#8b95a8', lineHeight: 1.6 }}>
                                    Matched by <span style={{ color: '#ef4444', fontWeight: 700 }}>{item.dupMatch.by}</span> with existing candidate:<br />
                                    <span style={{ color: '#d1d5db', fontWeight: 600 }}>{item.dupMatch.candidate?.name}</span>
                                    {item.dupMatch.candidate?.phone && <span> · {item.dupMatch.candidate.phone}</span>}
                                    {item.dupMatch.candidate?.email && <span> · {item.dupMatch.candidate.email}</span>}
                                    {item.dupMatch.candidate?.status && (
                                      <span style={{ marginLeft: 4, color: '#4f8ff7' }}>({item.dupMatch.candidate.status})</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                          <MField label="Full Name *"      ai={item.aiFields.has('name')}        value={item.form.name}        onChange={(v) => updateForm(item.id, 'name', v)}        placeholder="Full name" />
                          <MField label="Nationality"      ai={item.aiFields.has('nationality')} value={item.form.nationality} onChange={(v) => updateForm(item.id, 'nationality', v)} placeholder="e.g. Indian, Saudi" />
                          <MField label="Phone"            ai={item.aiFields.has('phone')}       value={item.form.phone}       onChange={(v) => updateForm(item.id, 'phone', v)}       placeholder="+91-9123456789" />
                          <MField label="Email"            ai={item.aiFields.has('email')}       value={item.form.email}       onChange={(v) => updateForm(item.id, 'email', v)}       placeholder="email@example.com" type="email" />
                          <div style={{ gridColumn: '1/-1' }}>
                            <MField label="Role / Position *" ai={item.aiFields.has('role')} value={item.form.role} onChange={(v) => updateForm(item.id, 'role', v)} placeholder="Job title" />
                          </div>
                          <MSelect label="Category" ai={item.aiFields.has('category')} value={item.form.category} onChange={(v) => updateForm(item.id, 'category', v)} options={CATEGORIES} />
                          <MSelect label="Status" value={item.form.status} onChange={(v) => updateForm(item.id, 'status', v)} options={PIPELINE_STAGES.map((s) => s.status)} />
                          <MField label="Location"   ai={item.aiFields.has('location')}   value={item.form.location}   onChange={(v) => updateForm(item.id, 'location', v)}   placeholder="City, Country" />
                          <MField label="Education"  ai={item.aiFields.has('education')}  value={item.form.education}  onChange={(v) => updateForm(item.id, 'education', v)}  placeholder="Qualification" />
                          <div style={{ gridColumn: '1/-1' }}>
                            <label style={{ fontSize: 10, color: item.aiFields.has('experience') ? '#a78bfa' : '#8b95a8', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                              Experience {item.aiFields.has('experience') && '✨'}
                            </label>
                            <textarea value={item.form.experience} onChange={(e) => updateForm(item.id, 'experience', e.target.value)} rows={2} style={{ ...baseInput, resize: 'vertical', minHeight: 50 }} placeholder="Experience summary" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #1e2533', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#0d1117' }}>
          {items.length > 0 && (
            <div style={{ fontSize: 11, color: '#4a5568', flex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {readyItems.length > 0 && <span style={{ color: '#22c55e', fontWeight: 700 }}>{readyItems.length} ready</span>}
              {dupItems.length > 0 && <span style={{ color: '#eab308', fontWeight: 700 }}>{dupItems.length} duplicate{dupItems.length > 1 ? 's' : ''} (skipped)</span>}
              {items.filter((i) => i.status === 'processing' || i.status === 'queued').length > 0 && (
                <span style={{ color: '#4f8ff7' }}>{items.filter((i) => i.status === 'processing' || i.status === 'queued').length} processing</span>
              )}
              {items.filter((i) => i.status === 'error').length > 0 && (
                <span style={{ color: '#ef4444' }}>{items.filter((i) => i.status === 'error').length} failed</span>
              )}
            </div>
          )}
          <button onClick={onClose} style={{ padding: '9px 18px', background: 'transparent', border: '1px solid #1e2533', borderRadius: 8, color: '#8b95a8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Cancel
          </button>
          <button
            onClick={handleAddAll}
            disabled={readyItems.length === 0}
            style={{ padding: '9px 22px', background: readyItems.length > 0 ? '#a78bfa' : '#1e2533', border: 'none', borderRadius: 8, color: readyItems.length > 0 ? '#fff' : '#4a5568', fontSize: 13, fontWeight: 700, cursor: readyItems.length > 0 ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans, sans-serif' }}
          >
            Add {readyItems.length > 0 ? readyItems.length : ''} Candidate{readyItems.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* ── Full-screen preview overlay ── */}
      {previewItem && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
          onClick={(e) => e.target === e.currentTarget && setPreviewItemId(null)}
        >
          <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 14, width: '90%', maxWidth: 860, height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {previewItem.file.name.endsWith('.pdf')
                  ? <FileText size={14} color="#4f8ff7" />
                  : <ImageIcon size={14} color="#4f8ff7" />}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>{previewItem.file.name}</span>
              </div>
              <button onClick={() => setPreviewItemId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', background: '#0d1117' }}>
              {previewItem.file.name.toLowerCase().match(/\.(pdf)$/) || previewItem.file.type === 'application/pdf' ? (
                <embed src={previewItem.previewUrl} type="application/pdf" style={{ width: '100%', height: '100%', border: 'none' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 16 }}>
                  <img src={previewItem.previewUrl} alt="Resume" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini field components for the expanded edit form ─────────────────────────
function MField({ label, ai, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: ai ? '#a78bfa' : '#8b95a8', fontWeight: 600, display: 'block', marginBottom: 3 }}>
        {label} {ai && '✨'}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...baseInput, borderColor: ai ? 'rgba(167,139,250,0.35)' : '#1e2533' }}
        onFocus={(e) => { e.target.style.borderColor = '#4f8ff7' }}
        onBlur={(e) => { e.target.style.borderColor = ai ? 'rgba(167,139,250,0.35)' : '#1e2533' }}
      />
    </div>
  )
}

function MSelect({ label, ai, value, onChange, options }) {
  return (
    <div>
      <label style={{ fontSize: 10, color: ai ? '#a78bfa' : '#8b95a8', fontWeight: 600, display: 'block', marginBottom: 3 }}>
        {label} {ai && '✨'}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...baseInput, cursor: 'pointer', appearance: 'none', borderColor: ai ? 'rgba(167,139,250,0.35)' : '#1e2533' }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
