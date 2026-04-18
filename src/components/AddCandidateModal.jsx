import { useState, useRef, useCallback, useMemo } from 'react'
import { X, User, Upload, FileText, Image, Sparkles, Loader, AlertCircle, CheckCircle, Trash2, AlertTriangle } from 'lucide-react'
import { CATEGORIES, PIPELINE_STAGES } from '../data/mockData'
import { analyzeResume, hasApiKey } from '../services/resumeParser'

function normalizePhone(p) { return (p || '').replace(/\D/g, '') }

function findDuplicate(form, existingCandidates) {
  if (!existingCandidates?.length) return null
  const phone = normalizePhone(form.phone)
  const email = form.email?.trim().toLowerCase()
  if (phone.length >= 7) {
    const m = existingCandidates.find((c) => normalizePhone(c.phone) === phone)
    if (m) return { candidate: m, by: 'phone' }
  }
  if (email?.includes('@')) {
    const m = existingCandidates.find((c) => c.email?.trim().toLowerCase() === email)
    if (m) return { candidate: m, by: 'email' }
  }
  return null
}

// ─── Shared input styles ──────────────────────────────────────────────────────
const baseInput = {
  width: '100%',
  background: '#0d1117',
  border: '1px solid #1e2533',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#d1d5db',
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
}

function Field({ label, required, aiField, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: '#8b95a8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        {label}
        {required && <span style={{ color: '#ec4899' }}>*</span>}
        {aiField && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 9, fontWeight: 700, color: '#a78bfa',
            background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)',
            borderRadius: 4, padding: '1px 5px', letterSpacing: '0.04em',
          }}>
            <Sparkles size={8} /> AI
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function AddCandidateModal({ onClose, onAdd, existingCandidates = [] }) {
  const fileInputRef = useRef(null)
  const [dragOver, setDragOver]     = useState(false)
  const [resumeFile, setResumeFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [aiStatus, setAiStatus]     = useState('idle') // idle | loading | done | error
  const [aiError, setAiError]       = useState('')
  const [aiFields, setAiFields]     = useState(new Set())   // which fields AI filled

  const [form, setForm] = useState({
    name: '', phone: '', email: '', role: '',
    category: 'Engineering', status: 'Home Coming',
    location: '', nationality: '', education: '', experience: '', notes: '',
  })
  const [errors, setErrors] = useState({})

  // ── live duplicate check ────────────────────────────────────────────────────
  const dupMatch = useMemo(() => findDuplicate(form, existingCandidates), [form, existingCandidates])

  // ── field helpers ───────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setAiFields((prev) => { const s = new Set(prev); s.delete(field); return s })
    if (errors[field]) setErrors((er) => { const n = { ...er }; delete n[field]; return n })
  }

  const inputProps = (field, extras = {}) => ({
    value: form[field],
    onChange: set(field),
    style: {
      ...baseInput,
      borderColor: errors[field] ? '#ec4899' : aiFields.has(field) ? 'rgba(167,139,250,0.4)' : '#1e2533',
      ...extras.style,
    },
    onFocus:  (e) => { e.target.style.borderColor = '#4f8ff7' },
    onBlur:   (e) => { e.target.style.borderColor = errors[field] ? '#ec4899' : aiFields.has(field) ? 'rgba(167,139,250,0.4)' : '#1e2533' },
    ...extras,
  })

  // ── file handling ───────────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return
    // Accept PDF, Word, and any image format — block only obviously wrong types
    const mime = (file.type || '').toLowerCase()
    const ext  = (file.name || '').toLowerCase().split('.').pop()
    const isAccepted =
      mime === 'application/pdf' ||
      mime.startsWith('image/') ||
      mime.includes('word') ||
      mime.includes('document') ||
      ['pdf','doc','docx','jpg','jpeg','png','webp','gif','bmp','tiff','tif','heic','avif','jfif'].includes(ext)
    if (!isAccepted) {
      setAiError(`Unsupported file type (.${ext}). Use PDF, DOCX, or an image.`)
      setAiStatus('error')
      return
    }

    // Create preview URL
    const url = URL.createObjectURL(file)
    setResumeFile(file)
    setPreviewUrl(url)
    setAiError('')

    if (!hasApiKey()) {
      setAiStatus('no-key')
      return
    }

    // Start AI analysis
    setAiStatus('loading')
    try {
      const extracted = await analyzeResume(file)
      const filled = new Set()

      setForm((prev) => {
        const next = { ...prev }
        const map = {
          name: 'name', phone: 'phone', email: 'email', role: 'role',
          experience: 'experience', education: 'education', location: 'location',
          nationality: 'nationality',
        }
        for (const [aiKey, formKey] of Object.entries(map)) {
          const val = extracted[aiKey]
          if (val && String(val).trim()) { next[formKey] = String(val).trim(); filled.add(formKey) }
        }
        // Category — validate it's a known value
        if (extracted.category && CATEGORIES.includes(extracted.category)) {
          next.category = extracted.category
          filled.add('category')
        }
        return next
      })

      setAiFields(filled)
      setAiStatus('done')
    } catch (err) {
      setAiStatus('error')
      setAiError(err.message || 'AI extraction failed')
    }
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const clearFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setResumeFile(null)
    setPreviewUrl(null)
    setAiStatus('idle')
    setAiError('')
    setAiFields(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── validation & submit ─────────────────────────────────────────────────────
  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.role.trim()) e.role = 'Role is required'
    if (!form.category)    e.category = 'Category is required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    if (dupMatch) return   // hard block — duplicate never added
    onAdd({
      ...form,
      id: Date.now().toString(),
      date_added: new Date().toISOString().split('T')[0],
      resume_url: null,        // Drive upload sets the real URL
      docs_complete: false,
    }, resumeFile)             // pass file so App.jsx can upload to Drive
    onClose()
  }

  // ── derived ─────────────────────────────────────────────────────────────────
  const isPDF   = resumeFile?.type === 'application/pdf' || resumeFile?.name?.endsWith('.pdf')
  const fileSize = resumeFile ? (resumeFile.size / 1024 < 1000
    ? `${(resumeFile.size / 1024).toFixed(0)} KB`
    : `${(resumeFile.size / 1048576).toFixed(1)} MB`) : ''

  const aiStatusInfo = {
    loading:  { icon: <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} />, color: '#4f8ff7', text: 'Extracting with AI…' },
    done:     { icon: <CheckCircle size={13} />, color: '#22c55e', text: `${aiFields.size} fields filled` },
    error:    { icon: <AlertCircle size={13} />, color: '#ef4444', text: aiError || 'Extraction failed' },
    'no-key': { icon: <AlertCircle size={13} />, color: '#eab308', text: 'Add VITE_OPENAI_API_KEY to .env' },
  }[aiStatus]

  return (
    <div
      className="fade-in-up"
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 18, width: '96%', maxWidth: 940, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 100px rgba(0,0,0,0.7)' }}>

        {/* ── Header ── */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(79,143,247,0.12)', border: '1px solid rgba(79,143,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color="#4f8ff7" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Add New Candidate</div>
              <div style={{ fontSize: 12, color: '#8b95a8' }}>Upload resume for AI extraction, or fill in manually</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* ── Two-panel body ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ── LEFT: Upload + Preview ── */}
          <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid #1e2533', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>

            {/* Upload zone (always visible at top) */}
            {!resumeFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  margin: 16, borderRadius: 12, flex: 1,
                  border: `2px dashed ${dragOver ? '#4f8ff7' : '#1e2533'}`,
                  background: dragOver ? 'rgba(79,143,247,0.06)' : 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.2s', gap: 12, padding: 24, textAlign: 'center',
                }}
              >
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Upload size={24} color="#4f8ff7" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#d1d5db', marginBottom: 4 }}>Drop Resume Here</div>
                  <div style={{ fontSize: 11, color: '#4a5568', lineHeight: 1.5 }}>or click to browse<br />PDF, DOCX, JPG, PNG, BMP, TIFF…</div>
                </div>
                {hasApiKey() ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 6, padding: '4px 10px' }}>
                    <Sparkles size={11} /> AI extraction ready
                  </div>
                ) : (
                  <div style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.4 }}>
                    Add <code style={{ color: '#eab308' }}>VITE_OPENAI_API_KEY</code><br />to .env for AI extraction
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Preview area */}
                <div style={{ flex: 1, overflow: 'hidden', margin: '12px 12px 0', borderRadius: 10, border: '1px solid #1e2533', background: '#111620', minHeight: 0 }}>
                  {isPDF ? (
                    <embed
                      src={previewUrl}
                      type="application/pdf"
                      style={{ width: '100%', height: '100%', minHeight: 300, border: 'none', borderRadius: 10 }}
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Resume preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 10 }}
                    />
                  )}
                </div>

                {/* File info + AI status */}
                <div style={{ padding: '10px 12px 12px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '7px 10px', background: '#111620', borderRadius: 8, border: '1px solid #1a2133' }}>
                    {isPDF ? <FileText size={14} color="#4f8ff7" /> : <Image size={14} color="#4f8ff7" />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resumeFile.name}</div>
                      <div style={{ fontSize: 10, color: '#4a5568' }}>{fileSize}</div>
                    </div>
                    <button onClick={clearFile} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={11} />
                    </button>
                  </div>

                  {aiStatusInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 8, background: `${aiStatusInfo.color}12`, border: `1px solid ${aiStatusInfo.color}30` }}>
                      <span style={{ color: aiStatusInfo.color, display: 'flex', alignItems: 'center' }}>{aiStatusInfo.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: aiStatusInfo.color }}>{aiStatusInfo.text}</span>
                    </div>
                  )}

                  {/* Replace file */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ marginTop: 6, width: '100%', padding: '6px', background: 'transparent', border: '1px dashed #1e2533', borderRadius: 7, color: '#4a5568', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
                  >
                    Replace Resume
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.heic,.avif"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </div>

          {/* ── RIGHT: Form ── */}
          <form
            onSubmit={handleSubmit}
            id="add-cand-form"
            style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* AI loading overlay hint */}
            {aiStatus === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(79,143,247,0.08)', border: '1px solid rgba(79,143,247,0.2)', borderRadius: 8, marginBottom: 2 }}>
                <Loader size={14} color="#4f8ff7" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#4f8ff7', fontWeight: 500 }}>Analyzing resume with AI — fields will fill automatically…</span>
              </div>
            )}

            {/* Row 1: Name */}
            <Field label="Full Name" required aiField={aiFields.has('name')}>
              <input placeholder="e.g. Ahmed Al-Rashidi" {...inputProps('name')} />
              {errors.name && <p style={{ fontSize: 11, color: '#ec4899', marginTop: 3 }}>{errors.name}</p>}
            </Field>

            {/* Row 2: Phone + Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Contact Number" aiField={aiFields.has('phone')}>
                <input placeholder="+971-501234567" {...inputProps('phone')} />
              </Field>
              <Field label="Email ID" aiField={aiFields.has('email')}>
                <input type="email" placeholder="email@example.com" {...inputProps('email')} />
              </Field>
            </div>

            {/* Row 3: Role */}
            <Field label="Role / Position" required aiField={aiFields.has('role')}>
              <input placeholder="e.g. Senior Mechanical Engineer" {...inputProps('role')} />
              {errors.role && <p style={{ fontSize: 11, color: '#ec4899', marginTop: 3 }}>{errors.role}</p>}
            </Field>

            {/* Row 4: Category + Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Category" required aiField={aiFields.has('category')}>
                <select
                  value={form.category}
                  onChange={set('category')}
                  style={{ ...baseInput, cursor: 'pointer', appearance: 'none', borderColor: aiFields.has('category') ? 'rgba(167,139,250,0.4)' : '#1e2533' }}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Initial Status">
                <select
                  value={form.status}
                  onChange={set('status')}
                  style={{ ...baseInput, cursor: 'pointer', appearance: 'none' }}
                >
                  {PIPELINE_STAGES.map((s) => <option key={s.status} value={s.status}>{s.status}</option>)}
                </select>
              </Field>
            </div>

            {/* Row 5: Location + Nationality */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Location" aiField={aiFields.has('location')}>
                <input placeholder="City, Country" {...inputProps('location')} />
              </Field>
              <Field label="Nationality" aiField={aiFields.has('nationality')}>
                <input placeholder="e.g. Indian, Filipino" {...inputProps('nationality')} />
              </Field>
            </div>

            {/* Row 6: Education */}
            <Field label="Education" aiField={aiFields.has('education')}>
              <input placeholder="Highest qualification" {...inputProps('education')} />
            </Field>

            {/* Row 7: Experience */}
            <Field label="Experience" aiField={aiFields.has('experience')}>
              <textarea
                placeholder="Brief experience summary…"
                {...inputProps('experience')}
                style={{ ...baseInput, resize: 'vertical', minHeight: 72, borderColor: aiFields.has('experience') ? 'rgba(167,139,250,0.4)' : '#1e2533' }}
                rows={3}
              />
            </Field>

            {/* Row 8: Notes */}
            <Field label="Short Notes">
              <textarea
                placeholder="Any important notes…"
                {...inputProps('notes')}
                style={{ ...baseInput, resize: 'vertical', minHeight: 56 }}
                rows={2}
              />
            </Field>
          </form>
        </div>

        {/* ── Duplicate warning banner ── */}
        {dupMatch && (
          <div style={{ padding: '10px 24px', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: '#ef4444' }}>Duplicate blocked — </span>
              <span style={{ color: '#8b95a8' }}>
                Matched by <span style={{ color: '#ef4444', fontWeight: 600 }}>{dupMatch.by}</span> with existing candidate:{' '}
                <span style={{ color: '#d1d5db', fontWeight: 600 }}>{dupMatch.candidate.name}</span>
                {dupMatch.candidate.phone && <span> · {dupMatch.candidate.phone}</span>}
                {dupMatch.candidate.status && <span style={{ color: '#4f8ff7' }}> ({dupMatch.candidate.status})</span>}
              </span>
            </div>
          </div>
        )}

        {/* ── Footer actions ── */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #1e2533', display: 'flex', gap: 10, flexShrink: 0, background: '#0d1117' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid #1e2533', borderRadius: 8, color: '#8b95a8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-cand-form"
            disabled={aiStatus === 'loading' || !!dupMatch}
            style={{ flex: 2, padding: '10px 0', background: dupMatch ? 'rgba(239,68,68,0.15)' : aiStatus === 'loading' ? '#1e2533' : '#4f8ff7', border: dupMatch ? '1px solid rgba(239,68,68,0.3)' : 'none', borderRadius: 8, color: dupMatch ? '#ef4444' : aiStatus === 'loading' ? '#4a5568' : '#fff', fontSize: 13, fontWeight: 700, cursor: aiStatus === 'loading' || dupMatch ? 'not-allowed' : 'pointer', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.02em' }}
          >
            {dupMatch ? 'Duplicate — Cannot Add' : aiStatus === 'loading' ? 'Analyzing…' : 'Add Candidate'}
          </button>
        </div>
      </div>
    </div>
  )
}
