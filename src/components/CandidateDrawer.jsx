import { useState, useEffect } from 'react'
import {
  X, Phone, Mail, MapPin, Briefcase, GraduationCap,
  Download, Upload, FileText, Calendar, StickyNote,
  ChevronDown, ChevronUp, Edit3, Check, Globe, RotateCcw,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import PipelineStepper from './PipelineStepper'
import { PIPELINE_STAGES } from '../data/mockData'

const InfoRow = ({ icon: Icon, label, value }) => (
  <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #1a2133' }}>
    <Icon size={14} color="#4a5568" style={{ marginTop: 2, flexShrink: 0 }} />
    <div>
      <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 13, color: '#d1d5db', marginTop: 2 }}>{value || '—'}</div>
    </div>
  </div>
)

export default function CandidateDrawer({ candidate, interviews, onClose, onUpdate, onScheduleInterview }) {
  // ── Pending changes — nothing syncs until Done is clicked ──────────────────
  const [pending, setPending] = useState({})
  const [showPipeline, setShowPipeline] = useState(true)
  const [editingNotes, setEditingNotes] = useState(false)

  // Reset pending when a different candidate opens
  useEffect(() => { setPending({}); setEditingNotes(false) }, [candidate.id])

  const hasPending = Object.keys(pending).length > 0

  // Current display value: pending overrides saved value
  const val = (field) => field in pending ? pending[field] : candidate[field]

  const change = (field, value) => {
    setPending((prev) => {
      // If value is same as original, remove from pending
      if (value === candidate[field]) {
        const next = { ...prev }; delete next[field]; return next
      }
      return { ...prev, [field]: value }
    })
  }

  const handleDone = () => {
    if (!hasPending) return
    onUpdate(pending)
    setPending({})
    setEditingNotes(false)
  }

  const handleDiscard = () => {
    setPending({})
    setEditingNotes(false)
  }

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
  }

  const pendingCount = Object.keys(pending).length

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
        className="fade-in-up"
      />

      {/* Drawer */}
      <div
        className="slide-in-right"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 420, zIndex: 51,
          background: '#111620', borderLeft: '1px solid #1e2533',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'linear-gradient(135deg, #4f8ff7, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {candidate.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>{candidate.name}</div>
                <div style={{ fontSize: 12, color: '#8b95a8' }}>{candidate.role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StatusBadge status={val('status')} size="sm" />
              <span style={{ fontSize: 11, color: '#4a5568' }}>·</span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>{candidate.category}</span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>·</span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>Added {formatDate(candidate.date_added)}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 4, marginTop: -2 }}>
            <X size={20} />
          </button>
        </div>

        {/* Pending banner */}
        {hasPending && (
          <div style={{ padding: '8px 20px', background: 'rgba(234,179,8,0.08)', borderBottom: '1px solid rgba(234,179,8,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600, flex: 1 }}>
              {pendingCount} unsaved change{pendingCount > 1 ? 's' : ''} — click Done to save
            </span>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: hasPending ? 80 : 0 }}>

          {/* Pipeline Stage */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2533', background: 'rgba(79,143,247,0.03)' }}>
            <div style={{ fontSize: 11, color: '#8b95a8', fontWeight: 500, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pipeline Stage</div>
            <select
              value={val('status')}
              onChange={(e) => change('status', e.target.value)}
              style={{
                width: '100%', background: '#0d1117',
                border: `1px solid ${'status' in pending ? 'rgba(234,179,8,0.5)' : '#1e2533'}`,
                borderRadius: 8, padding: '8px 12px', fontSize: 13,
                color: 'status' in pending ? '#eab308' : '#d1d5db',
                outline: 'none', cursor: 'pointer', appearance: 'none',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s.status} value={s.status}>{s.status}</option>
              ))}
            </select>
            {'status' in pending && (
              <div style={{ marginTop: 5, fontSize: 11, color: '#8b95a8' }}>
                <span style={{ color: '#4a5568' }}>{candidate.status}</span>
                {' → '}
                <span style={{ color: '#eab308', fontWeight: 600 }}>{pending.status}</span>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2533' }}>
            <div style={{ fontSize: 11, color: '#8b95a8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Contact Details</div>
            <InfoRow icon={Phone}        label="Contact Number" value={candidate.phone} />
            <InfoRow icon={Mail}         label="Email"          value={candidate.email} />
            <InfoRow icon={MapPin}       label="Location"       value={candidate.location} />
            <InfoRow icon={Globe}        label="Nationality"    value={candidate.nationality} />
            <InfoRow icon={GraduationCap} label="Education"     value={candidate.education} />
          </div>

          {/* Experience */}
          {candidate.experience && (
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2533' }}>
              <div style={{ fontSize: 11, color: '#8b95a8', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Briefcase size={11} /> Experience
              </div>
              <p style={{ fontSize: 13, color: '#b0b8c8', lineHeight: 1.6, margin: 0 }}>{candidate.experience}</p>
            </div>
          )}

          {/* Resume */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2533' }}>
            <div style={{ fontSize: 11, color: '#8b95a8', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={11} /> Resume
            </div>
            {candidate.resume_url ? (
              <a
                href={candidate.resume_url}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.25)', borderRadius: 8, color: '#4f8ff7', fontSize: 13, fontWeight: 600, textDecoration: 'none', justifyContent: 'center' }}
              >
                <Download size={14} /> Download CV
              </a>
            ) : (
              <div style={{ padding: '10px', background: 'rgba(74,85,104,0.1)', border: '1px dashed #2e3a50', borderRadius: 8, color: '#4a5568', fontSize: 12, textAlign: 'center' }}>
                No resume uploaded
              </div>
            )}
          </div>

          {/* Notes */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2533' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#8b95a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <StickyNote size={11} /> Short Notes
                {'notes' in pending && <span style={{ color: '#eab308', fontSize: 10 }}> · edited</span>}
              </div>
              <button
                onClick={() => setEditingNotes((v) => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: editingNotes ? '#4f8ff7' : '#4a5568', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                {editingNotes ? <><Check size={12} /> Done editing</> : <><Edit3 size={12} /> Edit</>}
              </button>
            </div>
            {editingNotes ? (
              <textarea
                value={val('notes')}
                onChange={(e) => change('notes', e.target.value)}
                style={{ width: '100%', background: '#0d1117', border: `1px solid ${'notes' in pending ? 'rgba(234,179,8,0.5)' : '#4f8ff7'}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#d1d5db', outline: 'none', resize: 'vertical', minHeight: 80, fontFamily: 'DM Sans, sans-serif', boxSizing: 'border-box' }}
                autoFocus
              />
            ) : (
              <p style={{ fontSize: 13, color: val('notes') ? '#b0b8c8' : '#4a5568', lineHeight: 1.6, margin: 0, fontStyle: val('notes') ? 'normal' : 'italic' }}>
                {val('notes') || 'No notes yet. Click Edit to add.'}
              </p>
            )}
          </div>

          {/* Interview History */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e2533' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#8b95a8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={11} /> Interview History
              </div>
              <button
                onClick={onScheduleInterview}
                style={{ fontSize: 11, color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                + Schedule
              </button>
            </div>
            {interviews.length === 0 ? (
              <p style={{ fontSize: 12, color: '#4a5568', fontStyle: 'italic' }}>No interviews scheduled yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {interviews.map((iv) => {
                  const sc = iv.status === 'Completed' ? '#22c55e' : iv.status === 'Cancelled' ? '#ef4444' : iv.status === 'Scheduled' ? '#0ea5e9' : '#eab308'
                  return (
                    <div key={iv.id} style={{ padding: '10px 12px', background: '#0d1117', borderRadius: 8, border: '1px solid #1e2533', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 3, borderRadius: 2, background: sc, alignSelf: 'stretch', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>{iv.type}</span>
                          <span style={{ fontSize: 11, color: sc, fontWeight: 600 }}>{iv.status}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#4a5568', marginTop: 3 }}>
                          {formatDate(iv.date)} · {formatTime(iv.time)} {iv.interviewer && `· ${iv.interviewer}`}
                        </div>
                        {iv.notes && <div style={{ fontSize: 11, color: '#8b95a8', marginTop: 4, lineHeight: 1.4 }}>{iv.notes}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Pipeline Progress */}
          <div style={{ padding: '14px 20px' }}>
            <button
              onClick={() => setShowPipeline(!showPipeline)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b95a8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: showPipeline ? 12 : 0, padding: 0 }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pipeline Progress</span>
              {showPipeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showPipeline && <PipelineStepper currentStatus={val('status')} />}
          </div>
        </div>

        {/* ── Done / Discard bar — only shown when there are pending changes ── */}
        {hasPending && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '12px 20px', display: 'flex', gap: 10,
            background: '#111620', borderTop: '1px solid rgba(234,179,8,0.3)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
          }}>
            <button
              onClick={handleDiscard}
              style={{ flex: 1, padding: '10px', background: 'rgba(74,85,104,0.15)', border: '1px solid #2e3a50', borderRadius: 9, color: '#8b95a8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <RotateCcw size={13} /> Discard
            </button>
            <button
              onClick={handleDone}
              style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
            >
              <Check size={14} /> Done — Save Changes
            </button>
          </div>
        )}
      </div>
    </>
  )
}
