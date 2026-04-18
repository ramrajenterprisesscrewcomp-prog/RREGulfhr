import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, Check, Minus, X, ExternalLink, Loader, AlertCircle, File, Image, ChevronDown, ChevronRight } from 'lucide-react'
import { DOC_TYPES, PIPELINE_STAGES } from '../data/mockData'
import { uploadDocumentToDrive } from '../services/driveService'
import { getToken } from '../services/googleAuth'

const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || null

const PIPELINE_ORDER  = PIPELINE_STAGES.map((s) => s.status)
// Only show candidates at Selected (index 3) and beyond
const SELECTED_PLUS   = PIPELINE_STAGES.slice(3).map((s) => s.status)
// Tracking table: Offer Letter (index 4) and beyond
const OFFER_PLUS      = PIPELINE_STAGES.slice(4).map((s) => s.status)

const DOC_STAGE_MAP = {
  'Offer Letter':         4,
  'Medical Report':       6,
  'Passport Copy':        7,
  'Visa Copy':            8,
  'Flight Ticket':        9,
  'ID Proof':             4,
  'Education Certificate':4,
  'Experience Letter':    4,
}

const ACCEPTED = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.heic,.avif,.xlsx,.xls,.txt'

function fmtSize(bytes) {
  if (!bytes) return ''
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`
}

function FileIcon({ file }) {
  const name = (file?.name || '').toLowerCase()
  if (name.endsWith('.pdf'))              return <FileText size={15} color="#ef4444" />
  if (name.match(/\.(jpg|jpeg|png|webp)/)) return <Image   size={15} color="#a78bfa" />
  return <File size={15} color="#4f8ff7" />
}

const TRACKER_DOCS = [
  { label: 'Offer Letter',  key: 'Offer Letter'  },
  { label: 'Medical',       key: 'Medical Report' },
  { label: 'Passport',      key: 'Passport Copy'  },
  { label: 'Visa',          key: 'Visa Copy'      },
  { label: 'Flight Ticket', key: 'Flight Ticket'  },
]

export default function Documents({ candidates, documents = [], docChecklist = {}, onAddDocument, onToggleDocCheck, googleSync }) {
  const [docType,         setDocType]         = useState('')
  const [linkedCandidate, setLinkedCandidate] = useState('')
  const [condition,       setCondition]       = useState('')
  const [createDate,      setCreateDate]      = useState(new Date().toISOString().split('T')[0])
  const [selectedFile,    setSelectedFile]    = useState(null)
  const [dragOver,        setDragOver]        = useState(false)
  const [uploading,           setUploading]           = useState(false)
  const [uploadError,         setUploadError]         = useState('')
  const [toast,               setToast]               = useState(null)
  const [expandedCandidateId, setExpandedCandidateId] = useState(null)
  const fileInputRef = useRef(null)

  // Only show Selected+ candidates in the dropdown
  const eligibleCandidates = candidates.filter((c) => SELECTED_PLUS.includes(c.status))
  // Tracking table uses Offer Letter+ candidates
  const trackingCandidates = candidates.filter((c) => OFFER_PLUS.includes(c.status))

  const stageIndex = (status) => PIPELINE_ORDER.indexOf(status)
  const hasDoc     = (candidate, dt) => stageIndex(candidate.status) >= (DOC_STAGE_MAP[dt] ?? 4)

  const pickFile = (file) => { if (file) { setSelectedFile(file); setUploadError('') } }

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) pickFile(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) pickFile(file)
    e.target.value = ''
  }

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleUpload = useCallback(async (e) => {
    e.preventDefault()
    if (!docType || !linkedCandidate) {
      showToast('Select document type and candidate', 'error'); return
    }
    if (!selectedFile) {
      showToast('Select a file to upload', 'error'); return
    }

    setUploading(true); setUploadError('')

    const cand = candidates.find((c) => c.id === linkedCandidate)
    let fileUrl = null
    let driveUploaded = false

    if (getToken() && FOLDER_ID) {
      try {
        fileUrl = await uploadDocumentToDrive(selectedFile, FOLDER_ID, cand?.name || linkedCandidate)
        driveUploaded = true
      } catch (err) {
        setUploadError(`Drive upload failed: ${err.message}. Saved locally.`)
        fileUrl = URL.createObjectURL(selectedFile)
      }
    } else {
      fileUrl = URL.createObjectURL(selectedFile)
    }

    const doc = {
      id:            Date.now().toString(),
      createDate,
      candidateId:   linkedCandidate,
      candidateName: cand?.name || '—',
      docType,
      fileName:      selectedFile.name,
      fileSize:      selectedFile.size,
      condition,
      fileUrl,
      driveUploaded,
    }

    onAddDocument(doc)
    setDocType(''); setLinkedCandidate(''); setCondition('')
    setCreateDate(new Date().toISOString().split('T')[0])
    setSelectedFile(null); setUploading(false)
    showToast(`${doc.docType} uploaded for ${doc.candidateName}`)
  }, [docType, linkedCandidate, condition, createDate, selectedFile, candidates, onAddDocument])

  const inputStyle = {
    width: '100%', background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8,
    padding: '9px 12px', fontSize: 13, color: '#d1d5db', outline: 'none',
    fontFamily: 'DM Sans, sans-serif', appearance: 'none',
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f4ff', margin: 0 }}>Document Management</h1>
        <p style={{ fontSize: 13, color: '#4a5568', margin: '4px 0 0' }}>
          Upload & track documents for selected candidates
          {googleSync?.connected && (
            <span style={{ marginLeft: 8, color: '#22c55e', fontSize: 12 }}>· Synced to Google Drive & Sheets</span>
          )}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, marginBottom: 28 }}>

        {/* ── Upload Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Upload Document
          </div>

          {/* Drop zone */}
          {!selectedFile ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#4f8ff7' : '#1e2533'}`,
                borderRadius: 14, padding: '28px 20px',
                background: dragOver ? 'rgba(79,143,247,0.06)' : '#111620',
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 13, background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Upload size={22} color="#4f8ff7" />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d1d5db', marginBottom: 4 }}>
                {dragOver ? 'Drop here' : 'Drag & Drop or Click to Browse'}
              </div>
              <div style={{ fontSize: 11, color: '#4a5568' }}>PDF, Word, JPG, PNG, Excel</div>
              {googleSync?.connected ? (
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, padding: '3px 10px' }}>
                  <Check size={10} strokeWidth={3} /> Saves to Drive: CandidateName/Documents/
                </div>
              ) : (
                <div style={{ marginTop: 8, fontSize: 11, color: '#4a5568' }}>Connect Google to save to Drive</div>
              )}
            </div>
          ) : (
            <div style={{ background: '#111620', border: '1px solid rgba(79,143,247,0.3)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileIcon file={selectedFile} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile.name}</div>
                <div style={{ fontSize: 11, color: '#4a5568' }}>{fmtSize(selectedFile.size)}</div>
              </div>
              <button onClick={() => setSelectedFile(null)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 6px', cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                <X size={12} />
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={handleFileInput} style={{ display: 'none' }} />

          {uploadError && (
            <div style={{ display: 'flex', gap: 7, padding: '8px 12px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8 }}>
              <AlertCircle size={13} color="#eab308" style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#eab308' }}>{uploadError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div>
              <label style={{ fontSize: 11, color: '#8b95a8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Document Type <span style={{ color: '#ec4899' }}>*</span>
              </label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} style={inputStyle}>
                <option value="">Select document type</option>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#8b95a8', fontWeight: 500, display: 'block', marginBottom: 4 }}>
                Candidate <span style={{ color: '#ec4899' }}>*</span>
                <span style={{ color: '#2e3a50', fontWeight: 400, marginLeft: 6 }}>({eligibleCandidates.length} selected+)</span>
              </label>
              <select value={linkedCandidate} onChange={(e) => setLinkedCandidate(e.target.value)} style={inputStyle}>
                <option value="">Select candidate</option>
                {eligibleCandidates.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.status}</option>
                ))}
              </select>
              {eligibleCandidates.length === 0 && (
                <p style={{ fontSize: 11, color: '#4a5568', margin: '4px 0 0' }}>No candidates at Selected stage yet</p>
              )}
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#8b95a8', fontWeight: 500, display: 'block', marginBottom: 4 }}>Status / Condition</label>
              <input
                type="text"
                placeholder="e.g. Medical clearance pending"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#8b95a8', fontWeight: 500, display: 'block', marginBottom: 4 }}>Date</label>
              <input type="date" value={createDate} onChange={(e) => setCreateDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
            </div>

            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: '11px', background: uploading ? '#1e2533' : '#4f8ff7',
                border: 'none', borderRadius: 9, color: uploading ? '#4a5568' : '#fff',
                fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = '#3d7de0' }}
              onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.background = '#4f8ff7' }}
            >
              {uploading
                ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
                : <><Upload size={14} /> Upload Document</>}
            </button>
          </form>
        </div>

        {/* ── Right: Doc Type Reference ── */}
        <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 14, padding: '18px 20px', alignSelf: 'start' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#8b95a8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Document Types Reference</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {DOC_TYPES.map((t) => {
              const stage = PIPELINE_STAGES[DOC_STAGE_MAP[t] ?? 4]
              return (
                <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#0d1117', borderRadius: 8, border: '1px solid #1a2133' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={13} color="#4a5568" />
                    <span style={{ fontSize: 13, color: '#d1d5db' }}>{t}</span>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, color: stage?.color, background: stage?.bg, border: `1px solid ${stage?.border}`, fontWeight: 600 }}>
                    {stage?.status}+
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Uploaded Documents Table ── */}
      {documents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', marginBottom: 14 }}>
            Uploaded Documents
            <span style={{ fontSize: 12, fontWeight: 400, color: '#4a5568', marginLeft: 8 }}>({documents.length})</span>
          </div>
          <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr style={{ background: '#0d1117', borderBottom: '1px solid #1e2533' }}>
                  {['Date', 'Candidate', 'Document Type', 'File Name', 'Condition', 'Storage', 'View'].map((h) => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((d, idx) => (
                  <tr
                    key={d.id}
                    style={{ borderBottom: idx < documents.length - 1 ? '1px solid #1a2133' : 'none', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#141d2e'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#4a5568', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{d.createDate}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#d1d5db' }}>{d.candidateName}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {(() => {
                        const stage = PIPELINE_STAGES[DOC_STAGE_MAP[d.docType] ?? 4]
                        return (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, color: stage?.color || '#8b95a8', background: stage?.bg || 'rgba(139,149,168,0.1)', border: `1px solid ${stage?.border || '#2e3a50'}` }}>
                            {d.docType}
                          </span>
                        )
                      })()}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileText size={12} color="#4a5568" />
                        <span style={{ fontSize: 12, color: '#8b95a8', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</span>
                        {d.fileSize && <span style={{ fontSize: 10, color: '#2e3a50' }}>{fmtSize(d.fileSize)}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: '#6b7280', fontStyle: 'italic', maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.condition || '—'}</div>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {d.driveUploaded ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 5, padding: '2px 7px' }}>Drive</span>
                      ) : (
                        <span style={{ fontSize: 10, color: '#4a5568', background: '#1a2133', border: '1px solid #2e3a50', borderRadius: 5, padding: '2px 7px' }}>Local</span>
                      )}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {d.fileUrl ? (
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#4f8ff7', background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', borderRadius: 6, padding: '4px 9px', textDecoration: 'none' }}
                        >
                          <ExternalLink size={10} /> View
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pipeline Document Tracking Table ── */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', marginBottom: 6 }}>
          Document Tracker — Selected+ Candidates
          <span style={{ fontSize: 12, fontWeight: 400, color: '#4a5568', marginLeft: 8 }}>({trackingCandidates.length} candidates)</span>
        </div>
        <p style={{ fontSize: 12, color: '#2e3a50', margin: '0 0 14px' }}>Click checkboxes to mark received · Click a row to view uploaded files</p>

        {trackingCandidates.length === 0 ? (
          <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 12, padding: '40px', textAlign: 'center' }}>
            <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.3, color: '#4a5568' }} />
            <div style={{ fontWeight: 600, color: '#8b95a8', marginBottom: 4 }}>No candidates at Selected+ stage</div>
            <div style={{ fontSize: 12, color: '#4a5568' }}>Tracking activates when candidates reach the Selected stage</div>
          </div>
        ) : (
          <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#0d1117', borderBottom: '1px solid #1e2533' }}>
                  <th style={{ padding: '10px 14px', width: 28 }} />
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Candidate</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Stage</th>
                  {TRACKER_DOCS.map((d) => (
                    <th key={d.key} style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d.label}</th>
                  ))}
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Files</th>
                </tr>
              </thead>
              <tbody>
                {trackingCandidates.map((c, idx) => {
                  const isExpanded    = expandedCandidateId === c.id
                  const candDocs      = documents.filter((d) => d.candidateId === c.id)
                  const isLast        = idx === trackingCandidates.length - 1
                  const stg           = PIPELINE_STAGES[stageIndex(c.status)]

                  return [
                    /* ── Main row ── */
                    <tr
                      key={c.id}
                      onClick={() => setExpandedCandidateId(isExpanded ? null : c.id)}
                      style={{
                        borderBottom: (!isExpanded && !isLast) ? '1px solid #1a2133' : isExpanded ? '1px solid #1e2533' : 'none',
                        cursor: 'pointer', transition: 'background 0.1s',
                        background: isExpanded ? '#111d2e' : undefined,
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = '#141d2e' }}
                      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* Expand chevron */}
                      <td style={{ padding: '12px 10px 12px 14px', textAlign: 'center', color: '#2e3a50' }}>
                        {isExpanded
                          ? <ChevronDown size={13} color="#4f8ff7" />
                          : <ChevronRight size={13} />}
                      </td>
                      {/* Candidate */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isExpanded ? '#f0f4ff' : '#d1d5db' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: '#4a5568' }}>{c.role}</div>
                      </td>
                      {/* Stage */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, color: stg?.color || '#4a5568', background: stg?.bg || '#1e2533', border: `1px solid ${stg?.border || '#2e3a50'}` }}>
                          {c.status}
                        </span>
                      </td>
                      {/* Checkboxes */}
                      {TRACKER_DOCS.map((td) => {
                        const checked = docChecklist[c.id]?.[td.key] || false
                        return (
                          <td key={td.key} style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleDocCheck?.(c.id, td.key, !checked) }}
                              title={checked ? 'Mark as not received' : 'Mark as received'}
                              style={{
                                width: 22, height: 22, borderRadius: 5, border: 'none',
                                background: checked ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1.5px solid ${checked ? 'rgba(34,197,94,0.5)' : '#2e3a50'}`,
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={(e) => { if (!checked) e.currentTarget.style.borderColor = '#4f8ff7' }}
                              onMouseLeave={(e) => { if (!checked) e.currentTarget.style.borderColor = '#2e3a50' }}
                            >
                              {checked && <Check size={12} color="#22c55e" strokeWidth={3} />}
                            </button>
                          </td>
                        )
                      })}
                      {/* Files count */}
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {candDocs.length > 0 ? (
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#4f8ff7', background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', borderRadius: 6, padding: '2px 9px' }}>
                            {candDocs.length}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#2e3a50' }}>—</span>
                        )}
                      </td>
                    </tr>,

                    /* ── Expanded: documents for this candidate ── */
                    isExpanded && (
                      <tr key={`${c.id}-expanded`} style={{ background: '#0d1520', borderBottom: isLast ? 'none' : '1px solid #1e2533' }}>
                        <td colSpan={3 + TRACKER_DOCS.length + 1} style={{ padding: '0 0 0 48px' }}>
                          {candDocs.length === 0 ? (
                            <div style={{ padding: '16px 16px 16px 0', fontSize: 13, color: '#4a5568', fontStyle: 'italic' }}>
                              No documents uploaded for {c.name} yet. Use the upload form above.
                            </div>
                          ) : (
                            <div style={{ padding: '12px 16px 12px 0' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                                Uploaded Documents ({candDocs.length})
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {candDocs.map((d) => {
                                  const stageInfo = PIPELINE_STAGES[DOC_STAGE_MAP[d.docType] ?? 4]
                                  return (
                                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#111620', borderRadius: 8, border: '1px solid #1a2133' }}>
                                      <FileText size={13} color="#4a5568" style={{ flexShrink: 0 }} />
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, color: stageInfo?.color || '#8b95a8', background: stageInfo?.bg || '#1e2533', border: `1px solid ${stageInfo?.border || '#2e3a50'}`, flexShrink: 0 }}>
                                        {d.docType}
                                      </span>
                                      <span style={{ fontSize: 12, color: '#8b95a8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.fileName}</span>
                                      {d.condition && <span style={{ fontSize: 11, color: '#4a5568', fontStyle: 'italic', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.condition}</span>}
                                      <span style={{ fontSize: 10, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{d.createDate}</span>
                                      {d.driveUploaded && <span style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>Drive</span>}
                                      {d.fileUrl && (
                                        <a href={d.fileUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#4f8ff7', background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.2)', borderRadius: 5, padding: '3px 8px', textDecoration: 'none', flexShrink: 0 }}>
                                          <ExternalLink size={10} /> View
                                        </a>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="toast-animate"
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 200,
            background: toast.type === 'success' ? '#22c55e' : '#ef4444',
            color: '#fff', padding: '12px 20px', borderRadius: 10,
            fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          {toast.type === 'success' ? '✓' : '✗'} {toast.msg}
        </div>
      )}
    </div>
  )
}
