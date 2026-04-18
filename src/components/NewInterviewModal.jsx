import { useState } from 'react'
import { X, Calendar, Search, Check } from 'lucide-react'
import { INTERVIEW_TYPES } from '../data/mockData'

const inputStyle = {
  width: '100%',
  background: '#0d1117',
  border: '1px solid #1e2533',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#d1d5db',
  outline: 'none',
  fontFamily: 'DM Sans, sans-serif',
}

const Label = ({ children, required }) => (
  <label style={{ fontSize: 12, color: '#8b95a8', fontWeight: 500, display: 'block', marginBottom: 5 }}>
    {children} {required && <span style={{ color: '#ec4899' }}>*</span>}
  </label>
)

export default function NewInterviewModal({ candidates, onClose, onAdd }) {
  const [form, setForm] = useState({
    title: '',
    type: 'Phone Screening',
    date: '',
    time: '',
    interviewer: '',
    notes: '',
    status: 'Scheduled',
  })
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [errors, setErrors] = useState({})

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const filteredCandidates = candidates.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q)
  })

  const toggleCandidate = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const validate = () => {
    const e = {}
    if (!form.title.trim()) e.title = 'Session title is required'
    if (!form.date) e.date = 'Date is required'
    if (!form.time) e.time = 'Time is required'
    if (selectedIds.length === 0) e.candidates = 'Select at least one candidate'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (!validate()) return
    onAdd({
      ...form,
      id: Date.now().toString(),
      candidates: selectedIds.map((id) => ({ id, attendStatus: 'Shortlist' })),
    })
    onClose()
  }

  return (
    <div
      className="fade-in-up"
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#111620',
          border: '1px solid #1e2533',
          borderRadius: 16,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} color="#0ea5e9" />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Schedule Interview Session</div>
              <div style={{ fontSize: 12, color: '#8b95a8' }}>Create a group interview with multiple candidates</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Session Title */}
            <div>
              <Label required>Session Title</Label>
              <input
                autoFocus
                value={form.title}
                onChange={set('title')}
                placeholder="e.g. ADNOC Technical Round 1"
                style={inputStyle}
              />
              {errors.title && <p style={{ fontSize: 11, color: '#ec4899', marginTop: 4 }}>{errors.title}</p>}
            </div>

            {/* Interview Type */}
            <div>
              <Label required>Interview Type</Label>
              <select value={form.type} onChange={set('type')} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
                {INTERVIEW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Date & Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label required>Date</Label>
                <input type="date" value={form.date} onChange={set('date')} style={{ ...inputStyle, colorScheme: 'dark' }} />
                {errors.date && <p style={{ fontSize: 11, color: '#ec4899', marginTop: 4 }}>{errors.date}</p>}
              </div>
              <div>
                <Label required>Time</Label>
                <input type="time" value={form.time} onChange={set('time')} style={{ ...inputStyle, colorScheme: 'dark' }} />
                {errors.time && <p style={{ fontSize: 11, color: '#ec4899', marginTop: 4 }}>{errors.time}</p>}
              </div>
            </div>

            {/* Interviewer */}
            <div>
              <Label>Interviewer / Panel</Label>
              <input
                type="text"
                placeholder="e.g. Arjun Das, Dr. Patel"
                value={form.interviewer}
                onChange={set('interviewer')}
                style={inputStyle}
              />
            </div>

            {/* Candidate Multi-Select */}
            <div>
              <Label required>
                Select Candidates
                {selectedIds.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#0ea5e9', background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', borderRadius: 10, padding: '1px 7px' }}>
                    {selectedIds.length} selected
                  </span>
                )}
              </Label>

              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <Search size={13} color="#4a5568" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search candidates..."
                  style={{ ...inputStyle, paddingLeft: 30 }}
                />
              </div>

              {/* List */}
              <div style={{ background: '#0d1117', border: `1px solid ${errors.candidates ? '#ec4899' : '#1e2533'}`, borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                {filteredCandidates.length === 0
                  ? <div style={{ padding: '12px', fontSize: 12, color: '#4a5568', textAlign: 'center' }}>No candidates found</div>
                  : filteredCandidates.map((c) => {
                    const checked = selectedIds.includes(c.id)
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleCandidate(c.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          cursor: 'pointer', borderBottom: '1px solid #1a2133',
                          background: checked ? 'rgba(14,165,233,0.07)' : 'transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={(e) => { if (!checked) e.currentTarget.style.background = '#111620' }}
                        onMouseLeave={(e) => { if (!checked) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                          border: `1.5px solid ${checked ? '#0ea5e9' : '#2e3a50'}`,
                          background: checked ? '#0ea5e9' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}>
                          {checked && <Check size={11} color="#fff" strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: checked ? '#f0f4ff' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.role}</div>
                        </div>
                        <span style={{ fontSize: 10, color: '#4a5568', background: '#1a2133', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{c.status}</span>
                      </div>
                    )
                  })
                }
              </div>
              {errors.candidates && <p style={{ fontSize: 11, color: '#ec4899', marginTop: 4 }}>{errors.candidates}</p>}
            </div>

            {/* Notes */}
            <div>
              <Label>Notes / Focus Areas</Label>
              <textarea
                placeholder="Topics to cover, preparation notes..."
                value={form.notes}
                onChange={set('notes')}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #1e2533' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '10px 0', background: 'transparent', border: '1px solid #1e2533', borderRadius: 8, color: '#8b95a8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ flex: 2, padding: '10px 0', background: '#0ea5e9', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              Schedule Session
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
