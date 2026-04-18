import { useState, useMemo } from 'react'
import {
  Plus, Search, Calendar, Clock, User, FileText,
  CheckCircle, XCircle, RotateCcw, Trash2, Pencil, X, Users,
} from 'lucide-react'
import NewInterviewModal from './NewInterviewModal'
import { ATTEND_STATUSES } from '../data/mockData'

const TODAY = new Date().toISOString().split('T')[0]

// ─── Session-level status ────────────────────────────────────────────────────
const IV_STATUS_COLORS = {
  Scheduled:   { color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)',  border: 'rgba(14,165,233,0.25)'  },
  Completed:   { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)'   },
  Cancelled:   { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)'   },
  Rescheduled: { color: '#eab308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)'   },
  'No Show':   { color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)'  },
}

// ─── Per-candidate attend status ─────────────────────────────────────────────
const ATTEND_COLORS = {
  'Shortlist':           { color: '#64748b', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
  'Mail Sent':           { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
  'Informed Day Before': { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  'On the Morning':      { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)'  },
  '1 Hr Before':         { color: '#eab308', bg: 'rgba(234,179,8,0.12)',   border: 'rgba(234,179,8,0.3)'   },
  'Selected':            { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
  'Rejected':            { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
}

function IVBadge({ status }) {
  const s = IV_STATUS_COLORS[status] || IV_STATUS_COLORS.Scheduled
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '2px 8px', borderRadius: 20 }}>
      {status}
    </span>
  )
}

function AttendBadge({ status }) {
  const s = ATTEND_COLORS[status] || ATTEND_COLORS['Shortlist']
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  )
}

// ─── Edit Session Modal ───────────────────────────────────────────────────────
function EditInterviewModal({ interview, onSave, onClose }) {
  const [form, setForm] = useState({
    title:       interview.title       || '',
    date:        interview.date,
    time:        interview.time,
    type:        interview.type,
    interviewer: interview.interviewer || '',
    notes:       interview.notes       || '',
    status:      interview.status,
  })

  const inputSt = {
    width: '100%', background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8,
    padding: '8px 12px', fontSize: 13, color: '#d1d5db', outline: 'none', fontFamily: 'DM Sans, sans-serif',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 16, width: '100%', maxWidth: 480, padding: 24, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>Edit Session</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Session Title</label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={{ ...inputSt, colorScheme: 'dark' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} style={{ ...inputSt, colorScheme: 'dark' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Interview Type</label>
            <input value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Interviewer / Panel</label>
            <input value={form.interviewer} onChange={(e) => setForm((f) => ({ ...f, interviewer: e.target.value }))} style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Session Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={{ ...inputSt, cursor: 'pointer', appearance: 'none' }}>
              {Object.keys(IV_STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3}
              style={{ ...inputSt, resize: 'vertical', minHeight: 72 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1e2533', borderRadius: 8, color: '#8b95a8', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={() => { onSave(form); onClose() }} style={{ flex: 2, padding: '10px', background: '#4f8ff7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Interviews({ candidates, interviews, onAddInterview, onUpdateInterview, onDeleteInterview, onCandidateClick, onUpdateCandidate }) {
  const [showModal, setShowModal]           = useState(false)
  const [search, setSearch]                 = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [editingInterview, setEditingInterview] = useState(null)

  const getCand = (id) => candidates.find((c) => c.id === id)

  const stats = useMemo(() => ({
    Scheduled: interviews.filter((i) => i.status === 'Scheduled').length,
    Completed: interviews.filter((i) => i.status === 'Completed').length,
    Cancelled: interviews.filter((i) => i.status === 'Cancelled').length,
    Total:     interviews.length,
  }), [interviews])

  const filtered = useMemo(() => {
    let list = [...interviews]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((iv) => {
        if ((iv.title || '').toLowerCase().includes(q)) return true
        if ((iv.type || '').toLowerCase().includes(q)) return true
        if ((iv.interviewer || '').toLowerCase().includes(q)) return true
        return (iv.candidates || []).some((c) => {
          const cand = getCand(c.id)
          return cand && (cand.name.toLowerCase().includes(q) || cand.role.toLowerCase().includes(q))
        })
      })
    }
    if (filterStatus) list = list.filter((i) => i.status === filterStatus)
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  }, [interviews, search, filterStatus, candidates])

  const formatDate = (d) => {
    if (!d) return ''
    if (d === TODAY) return 'Today'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
  }

  // Update a single candidate's attendStatus within a session
  // If marked Selected → also promote the candidate's pipeline status to "Selected"
  const handleAttendStatus = (ivId, candId, newStatus) => {
    const iv = interviews.find((i) => i.id === ivId)
    if (!iv) return
    onUpdateInterview(ivId, {
      candidates: iv.candidates.map((c) =>
        c.id === candId ? { ...c, attendStatus: newStatus } : c
      ),
    })
    if (newStatus === 'Selected' && onUpdateCandidate) {
      onUpdateCandidate(candId, { status: 'Selected' })
    }
  }

  const statCards = [
    { label: 'Scheduled', value: stats.Scheduled, color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.2)', icon: Calendar      },
    { label: 'Completed', value: stats.Completed, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.2)',  icon: CheckCircle    },
    { label: 'Cancelled', value: stats.Cancelled, color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  icon: XCircle        },
    { label: 'Total',     value: stats.Total,     color: '#a78bfa', bg: 'rgba(167,139,250,0.08)',border: 'rgba(167,139,250,0.2)',icon: FileText       },
  ]

  const selectStyle = {
    background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8,
    padding: '8px 12px', fontSize: 12, color: '#8b95a8', outline: 'none',
    cursor: 'pointer', appearance: 'none', fontFamily: 'DM Sans, sans-serif',
  }

  const thSt = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700, color: '#4a5568',
    textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
    borderBottom: '1px solid #1a2133', background: '#0a0f19', whiteSpace: 'nowrap',
  }

  const tdSt = {
    padding: '9px 12px', fontSize: 12, color: '#8b95a8',
    borderBottom: '1px solid #1a2133', verticalAlign: 'middle',
  }

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f4ff', margin: 0 }}>Interview Schedule</h1>
          <p style={{ fontSize: 13, color: '#4a5568', margin: '4px 0 0' }}>{filtered.length} session{filtered.length !== 1 ? 's' : ''} shown</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#0ea5e9', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(14,165,233,0.3)', fontFamily: 'DM Sans, sans-serif' }}
        >
          <Plus size={16} /> New Session
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {statCards.map(({ label, value, color, bg, border, icon: Icon }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 12, color, opacity: 0.7, fontWeight: 500, marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} color="#4a5568" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by session title, candidate name, or interviewer..."
            style={{ ...selectStyle, paddingLeft: 32, width: '100%', color: '#d1d5db' }}
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          {Object.keys(IV_STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Interview Session Cards */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: '#4a5568' }}>
          <Calendar size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <div style={{ fontWeight: 600, color: '#8b95a8', marginBottom: 4 }}>No sessions found</div>
          <div style={{ fontSize: 13 }}>Schedule a new interview session to get started</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((iv) => {
            const isToday     = iv.date === TODAY
            const isScheduled = iv.status === 'Scheduled'
            const sessionCandidates = (iv.candidates || [])

            return (
              <div
                key={iv.id}
                style={{
                  background: '#111620',
                  border: `1px solid ${isToday ? 'rgba(234,179,8,0.35)' : '#1e2533'}`,
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: isToday ? '0 0 0 1px rgba(234,179,8,0.12), 0 4px 24px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                {/* Card Header */}
                <div style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', borderBottom: '1px solid #1a2133' }}>
                  {/* Date box */}
                  <div style={{
                    minWidth: 52, textAlign: 'center', padding: '7px 4px',
                    background: isToday ? 'rgba(234,179,8,0.1)' : '#0d1117',
                    border: `1px solid ${isToday ? 'rgba(234,179,8,0.25)' : '#1e2533'}`,
                    borderRadius: 10, flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: isToday ? '#eab308' : '#4f8ff7', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                      {new Date(iv.date).getDate()}
                    </div>
                    <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', marginTop: 2 }}>
                      {new Date(iv.date).toLocaleDateString('en-GB', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: 9, color: '#2e3a50', marginTop: 1 }}>
                      {new Date(iv.date).getFullYear()}
                    </div>
                  </div>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f4ff' }}>{iv.title || 'Interview Session'}</span>
                      <IVBadge status={iv.status} />
                      {isToday && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#eab308', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', padding: '2px 7px', borderRadius: 5, letterSpacing: '0.05em' }}>
                          TODAY
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8b95a8' }}>
                        <Calendar size={12} color="#4a5568" />
                        <span style={{ fontWeight: 600, color: isToday ? '#eab308' : '#8b95a8' }}>{formatDate(iv.date)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8b95a8' }}>
                        <Clock size={12} color="#4a5568" />
                        {formatTime(iv.time)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8b95a8' }}>
                        <FileText size={12} color="#4a5568" />
                        {iv.type}
                      </div>
                      {iv.interviewer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8b95a8' }}>
                          <User size={12} color="#4a5568" />
                          {iv.interviewer}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8b95a8' }}>
                        <Users size={12} color="#4a5568" />
                        {sessionCandidates.length} candidate{sessionCandidates.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    {iv.notes && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#4a5568', lineHeight: 1.5, padding: '7px 10px', background: '#0d1117', borderRadius: 7, border: '1px solid #1a2133' }}>
                        {iv.notes}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                    {isScheduled && (
                      <>
                        <button
                          onClick={() => onUpdateInterview(iv.id, { status: 'Completed' })}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 7, color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
                        >
                          <CheckCircle size={12} /> Done
                        </button>
                        <button
                          onClick={() => onUpdateInterview(iv.id, { status: 'Cancelled' })}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
                        >
                          <XCircle size={12} /> Cancel
                        </button>
                      </>
                    )}
                    {iv.status === 'Cancelled' && (
                      <button
                        onClick={() => onUpdateInterview(iv.id, { status: 'Scheduled' })}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 7, color: '#eab308', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap' }}
                      >
                        <RotateCcw size={12} /> Reschedule
                      </button>
                    )}
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                      <button
                        onClick={() => setEditingInterview(iv)}
                        title="Edit session"
                        style={{ background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.25)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#4f8ff7', display: 'flex', alignItems: 'center' }}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => { if (window.confirm('Delete this interview session?')) onDeleteInterview(iv.id) }}
                        title="Delete session"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Candidate Table */}
                {sessionCandidates.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                      <thead>
                        <tr>
                          <th style={{ ...thSt, width: 40, textAlign: 'center' }}>S.No</th>
                          <th style={thSt}>Name</th>
                          <th style={thSt}>Phone Number</th>
                          <th style={thSt}>Email ID</th>
                          <th style={thSt}>Role</th>
                          <th style={{ ...thSt, minWidth: 170 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionCandidates.map((entry, idx) => {
                          const cand = getCand(entry.id)
                          if (!cand) return null
                          const isLast = idx === sessionCandidates.length - 1
                          const ac = ATTEND_COLORS[entry.attendStatus] || ATTEND_COLORS['Shortlist']
                          return (
                            <tr
                              key={entry.id}
                              style={{ borderBottom: isLast ? 'none' : '1px solid #1a2133', transition: 'background 0.1s' }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#141d2e'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <td style={{ ...tdSt, textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2e3a50' }}>{idx + 1}</td>
                              <td style={tdSt}>
                                <button
                                  onClick={() => onCandidateClick(cand.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 700, color: '#d1d5db', textAlign: 'left' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#4f8ff7'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = '#d1d5db'}
                                >
                                  {cand.name}
                                </button>
                              </td>
                              <td style={{ ...tdSt, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{cand.phone}</td>
                              <td style={{ ...tdSt, fontSize: 11 }}>{cand.email}</td>
                              <td style={{ ...tdSt, fontSize: 12 }}>{cand.role}</td>
                              <td style={{ ...tdSt }}>
                                <select
                                  value={entry.attendStatus}
                                  onChange={(e) => handleAttendStatus(iv.id, entry.id, e.target.value)}
                                  style={{
                                    background: ac.bg,
                                    border: `1px solid ${ac.border}`,
                                    borderRadius: 20,
                                    padding: '3px 10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: ac.color,
                                    outline: 'none',
                                    cursor: 'pointer',
                                    appearance: 'none',
                                    fontFamily: 'DM Sans, sans-serif',
                                  }}
                                >
                                  {ATTEND_STATUSES.map((s) => (
                                    <option key={s} value={s} style={{ background: '#111620', color: '#d1d5db' }}>{s}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <NewInterviewModal
          candidates={candidates}
          onClose={() => setShowModal(false)}
          onAdd={onAddInterview}
        />
      )}

      {editingInterview && (
        <EditInterviewModal
          interview={editingInterview}
          onSave={(updates) => onUpdateInterview(editingInterview.id, updates)}
          onClose={() => setEditingInterview(null)}
        />
      )}
    </div>
  )
}
