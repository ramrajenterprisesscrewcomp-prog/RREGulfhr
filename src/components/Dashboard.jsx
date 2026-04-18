import { useState, useRef } from 'react'
import {
  Calendar, Plus, X, CheckSquare, Square,
  Users, Briefcase, ChevronRight, Search,
  ArrowDown, Trash2, Pencil,
} from 'lucide-react'
import { PIPELINE_STAGES } from '../data/mockData'

const TODAY = new Date().toISOString().split('T')[0]

const ROLE_ST = {
  'Open':        { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)'  },
  'In Progress': { color: '#eab308', bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.25)'  },
  'Filled':      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.25)'  },
}

const PROJ_ST = {
  'Active':   { color: '#4f8ff7', bg: 'rgba(79,143,247,0.1)',  border: 'rgba(79,143,247,0.25)' },
  'Complete': { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.25)'  },
  'On Hold':  { color: '#eab308', bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)'  },
}

const cardBase = {
  background: '#111620', border: '1px solid #1e2533', borderRadius: 14, padding: '18px 20px',
}

const thSt = {
  padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#4a5568',
  textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: 'left',
  borderBottom: '1px solid #1e2533', whiteSpace: 'nowrap', background: '#0d1117',
}

const tdSt = {
  padding: '8px 10px', fontSize: 12, color: '#8b95a8',
  borderBottom: '1px solid #1a2133', verticalAlign: 'middle',
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const pct = (p) => {
  const filled = p.roles.reduce((s, r) => s + Math.min(r.selectedCandidates.length, r.required), 0)
  const total  = p.roles.reduce((s, r) => s + r.required, 0)
  return total > 0 ? Math.round((filled / total) * 100) : 0
}

const RolePill = ({ label, color, bg, border }) => (
  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: bg, color, border: `1px solid ${border}` }}>{label}</span>
)

const CompletionBar = ({ value, height = 5 }) => (
  <div style={{ height, background: '#1e2533', borderRadius: 4, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${value}%`, background: value === 100 ? '#22c55e' : 'linear-gradient(90deg,#4f8ff7,#a78bfa)', borderRadius: 4, transition: 'width 0.3s' }} />
  </div>
)

// ─── Candidate Picker ─────────────────────────────────────────────────────────
function CandidatePicker({ candidates, excludeIds, onPick, onClose }) {
  const [q, setQ] = useState('')
  const filtered = candidates.filter(
    (c) => !excludeIds.includes(c.id) && (c.name.toLowerCase().includes(q.toLowerCase()) || c.role.toLowerCase().includes(q.toLowerCase()))
  )
  return (
    <div style={{ position: 'absolute', zIndex: 200, top: '100%', left: 0, marginTop: 4, width: 260, background: '#111620', border: '1px solid #1e2533', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Search size={12} color="#4a5568" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidate…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: '#d1d5db', fontFamily: 'DM Sans, sans-serif' }} />
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 0 }}><X size={12} /></button>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {filtered.length === 0
          ? <div style={{ padding: '12px', fontSize: 12, color: '#4a5568', textAlign: 'center' }}>No candidates found</div>
          : filtered.map((c) => (
            <button key={c.id} onClick={() => { onPick(c.id); onClose() }}
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, fontFamily: 'DM Sans, sans-serif', transition: 'background 0.1s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#1a2133'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>{c.name}</span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>{c.role}</span>
            </button>
          ))
        }
      </div>
    </div>
  )
}

// ─── Project Detail Modal ─────────────────────────────────────────────────────
function ProjectDetailModal({ project, candidates, onClose, onAddCandidate, onRemoveCandidate, onAddRole, onDeleteRole, onUpdateProject }) {
  const [pickerRoleId, setPickerRoleId] = useState(null)
  const [addingRole, setAddingRole] = useState(false)
  const [newRole, setNewRole] = useState({ jobTitle: '', salary: '', required: 1 })
  const [editingRoleId, setEditingRoleId] = useState(null)
  const [editRoleForm, setEditRoleForm] = useState({ jobTitle: '', salary: '', required: 1 })

  const getCand = (id) => candidates.find((c) => c.id === id)
  const completion = pct(project)
  const ps = PROJ_ST[project.status] || PROJ_ST['Active']

  const handleAddRole = () => {
    if (!newRole.jobTitle.trim()) return
    onAddRole(project.id, {
      id: `r${Date.now()}`,
      jobTitle: newRole.jobTitle.trim(),
      salary: newRole.salary.trim() || '—',
      required: parseInt(newRole.required) || 1,
      selectedCandidates: [],
      roleStatus: 'Open',
    })
    setNewRole({ jobTitle: '', salary: '', required: 1 })
    setAddingRole(false)
  }

  const saveRoleEdit = () => {
    const currentRole = project.roles.find((r) => r.id === editingRoleId)
    const newRequired = parseInt(editRoleForm.required) || 1
    const selCount = currentRole ? currentRole.selectedCandidates.length : 0
    const roleStatus = selCount >= newRequired ? 'Filled' : selCount > 0 ? 'In Progress' : 'Open'
    onUpdateProject(project.id, editingRoleId, {
      jobTitle: editRoleForm.jobTitle.trim() || currentRole?.jobTitle,
      salary: editRoleForm.salary.trim() || '—',
      required: newRequired,
      roleStatus,
    })
    setEditingRoleId(null)
  }

  const inputSt = { background: '#0d1117', border: '1px solid #1e2533', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#d1d5db', outline: 'none', fontFamily: 'DM Sans, sans-serif' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 18, width: '90%', maxWidth: 860, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.7)' }}>

        {/* Modal Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2533', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(79,143,247,0.12)', border: '1px solid rgba(79,143,247,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Briefcase size={18} color="#4f8ff7" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f4ff' }}>{project.title}</div>
                <div style={{ fontSize: 12, color: '#4a5568' }}>{project.client}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, marginLeft: 4 }}>{project.status}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, maxWidth: 280 }}>
                <CompletionBar value={completion} height={6} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: completion === 100 ? '#22c55e' : '#4f8ff7', fontFamily: 'JetBrains Mono, monospace' }}>{completion}% filled</span>
              <span style={{ fontSize: 12, color: '#4a5568' }}>{project.roles.length} role{project.roles.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Modal Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {project.roles.length === 0 && !addingRole ? (
            <div style={{ textAlign: 'center', color: '#4a5568', fontSize: 13, padding: '32px 0' }}>No roles added yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thSt, width: 36 }}>S.No</th>
                  <th style={thSt}>Job Title</th>
                  <th style={thSt}>Salary</th>
                  <th style={{ ...thSt, textAlign: 'center' }}>Required</th>
                  <th style={{ ...thSt, minWidth: 140 }}>Progress</th>
                  <th style={thSt}>Selected Candidates</th>
                  <th style={thSt}>Status</th>
                  <th style={{ ...thSt, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {project.roles.map((role, idx) => {
                  const rs = ROLE_ST[role.roleStatus] || ROLE_ST['Open']
                  const isPicker = pickerRoleId === role.id
                  const isEditing = editingRoleId === role.id
                  return (
                    <tr key={role.id}>
                      <td style={{ ...tdSt, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</td>
                      {isEditing ? (
                        <>
                          <td style={tdSt}>
                            <input autoFocus value={editRoleForm.jobTitle} onChange={(e) => setEditRoleForm((f) => ({ ...f, jobTitle: e.target.value }))} style={{ ...inputSt, width: '100%' }} />
                          </td>
                          <td style={tdSt}>
                            <input value={editRoleForm.salary} onChange={(e) => setEditRoleForm((f) => ({ ...f, salary: e.target.value }))} style={{ ...inputSt, width: 100 }} />
                          </td>
                          <td style={{ ...tdSt, textAlign: 'center' }}>
                            <input type="number" min="1" value={editRoleForm.required} onChange={(e) => setEditRoleForm((f) => ({ ...f, required: e.target.value }))} style={{ ...inputSt, width: 50, textAlign: 'center' }} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ ...tdSt, color: '#d1d5db', fontWeight: 600 }}>{role.jobTitle}</td>
                          <td style={{ ...tdSt, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{role.salary}</td>
                          <td style={{ ...tdSt, textAlign: 'center', fontWeight: 700, color: '#d1d5db' }}>{role.required}</td>
                        </>
                      )}
                      {/* Progress cell */}
                      {!isEditing && (() => {
                        const filled  = Math.min(role.selectedCandidates.length, role.required)
                        const rolePct = role.required > 0 ? Math.round((filled / role.required) * 100) : 0
                        const done    = rolePct === 100
                        const col     = done ? '#22c55e' : rolePct > 0 ? '#4f8ff7' : '#4a5568'
                        return (
                          <td style={{ ...tdSt, minWidth: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: '#1e2533', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${rolePct}%`, background: done ? '#22c55e' : 'linear-gradient(90deg,#4f8ff7,#a78bfa)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 800, color: col, fontFamily: 'JetBrains Mono, monospace', minWidth: 34, textAlign: 'right' }}>{rolePct}%</span>
                            </div>
                            <div style={{ fontSize: 10, color: '#4a5568', marginTop: 3 }}>
                              <span style={{ color: col, fontWeight: 700 }}>{filled}</span> of {role.required} filled
                            </div>
                          </td>
                        )
                      })()}
                      {isEditing && <td style={tdSt} />}
                      <td style={{ ...tdSt, position: 'relative' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                          {role.selectedCandidates.map((cid) => {
                            const cand = getCand(cid)
                            if (!cand) return null
                            return (
                              <span key={cid} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, background: 'rgba(79,143,247,0.12)', border: '1px solid rgba(79,143,247,0.25)', color: '#4f8ff7', borderRadius: 6, padding: '2px 6px 2px 8px' }}>
                                {cand.name}
                                <button onClick={() => onRemoveCandidate(project.id, role.id, cid)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f8ff7', padding: 0, display: 'flex', alignItems: 'center' }}>
                                  <X size={10} />
                                </button>
                              </span>
                            )
                          })}
                          <div style={{ position: 'relative' }}>
                            <button onClick={() => setPickerRoleId(isPicker ? null : role.id)}
                              style={{ width: 22, height: 22, borderRadius: 5, border: '1px dashed rgba(79,143,247,0.4)', background: 'rgba(79,143,247,0.08)', color: '#4f8ff7', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Plus size={12} />
                            </button>
                            {isPicker && (
                              <CandidatePicker
                                candidates={candidates}
                                excludeIds={role.selectedCandidates}
                                onPick={(cid) => onAddCandidate(project.id, role.id, cid)}
                                onClose={() => setPickerRoleId(null)}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <RolePill label={role.roleStatus} {...rs} />
                      </td>
                      <td style={tdSt}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={saveRoleEdit} style={{ padding: '3px 10px', background: '#4f8ff7', border: 'none', borderRadius: 5, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                            <button onClick={() => setEditingRoleId(null)} style={{ padding: '3px 8px', background: 'transparent', border: '1px solid #1e2533', borderRadius: 5, color: '#4a5568', fontSize: 11, cursor: 'pointer' }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => { setEditingRoleId(role.id); setEditRoleForm({ jobTitle: role.jobTitle, salary: role.salary, required: role.required }) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#4f8ff7' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#4a5568' }}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              onClick={() => { if (window.confirm(`Delete role "${role.jobTitle}"?`)) onDeleteRole(project.id, role.id) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#4a5568' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {/* Add role inline */}
                {addingRole && (
                  <tr>
                    <td style={tdSt} />
                    <td style={tdSt}>
                      <input autoFocus value={newRole.jobTitle} onChange={(e) => setNewRole((f) => ({ ...f, jobTitle: e.target.value }))}
                        placeholder="Job Title" style={{ ...inputSt, width: '100%' }} />
                    </td>
                    <td style={tdSt}>
                      <input value={newRole.salary} onChange={(e) => setNewRole((f) => ({ ...f, salary: e.target.value }))}
                        placeholder="e.g. $5,000/mo" style={{ ...inputSt, width: 110 }} />
                    </td>
                    <td style={{ ...tdSt, textAlign: 'center' }}>
                      <input type="number" min="1" value={newRole.required} onChange={(e) => setNewRole((f) => ({ ...f, required: e.target.value }))}
                        style={{ ...inputSt, width: 50, textAlign: 'center' }} />
                    </td>
                    <td style={tdSt}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={handleAddRole} style={{ padding: '4px 12px', background: '#4f8ff7', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Add</button>
                        <button onClick={() => setAddingRole(false)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid #1e2533', borderRadius: 6, color: '#4a5568', fontSize: 12, cursor: 'pointer' }}>✕</button>
                      </div>
                    </td>
                    <td style={tdSt} />
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {!addingRole && (
            <button onClick={() => setAddingRole(true)}
              style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#4f8ff7', background: 'none', border: '1px dashed rgba(79,143,247,0.3)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>
              <Plus size={13} /> Add Role
            </button>
          )}
        </div>

        {/* Status change footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #1e2533', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#4a5568' }}>Project Status:</span>
          {['Active', 'On Hold', 'Complete'].map((s) => {
            const st = PROJ_ST[s]
            const active = project.status === s
            return (
              <button key={s} onClick={() => onUpdateProject(project.id, null, { status: s })}
                style={{ padding: '4px 12px', borderRadius: 7, border: `1px solid ${active ? st.border : '#1e2533'}`, background: active ? st.bg : 'transparent', color: active ? st.color : '#4a5568', fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                {s}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Compact Project Card ─────────────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  const completion = pct(project)
  const ps = PROJ_ST[project.status] || PROJ_ST['Active']
  const totalRequired  = project.roles.reduce((s, r) => s + r.required, 0)
  const totalSelected  = project.roles.reduce((s, r) => s + r.selectedCandidates.length, 0)

  return (
    <div onClick={onClick} style={{ ...cardBase, cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.3)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</div>
          <div style={{ fontSize: 11, color: '#4a5568', marginTop: 2 }}>{project.client}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, marginLeft: 8, whiteSpace: 'nowrap' }}>{project.status}</span>
      </div>

      {/* Completion */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: '#4a5568' }}>{totalSelected}/{totalRequired} candidates filled</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: completion === 100 ? '#22c55e' : '#4f8ff7', fontFamily: 'JetBrains Mono, monospace' }}>{completion}%</span>
        </div>
        <CompletionBar value={completion} />
      </div>

      {/* Role progress rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {project.roles.length === 0 && (
          <div style={{ fontSize: 12, color: '#2e3a50', fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>No roles — click to add</div>
        )}
        {project.roles.map((role, idx) => {
          const filled  = Math.min(role.selectedCandidates.length, role.required)
          const rolePct = role.required > 0 ? Math.round((filled / role.required) * 100) : 0
          const done    = rolePct === 100
          const color   = done ? '#22c55e' : rolePct > 0 ? '#4f8ff7' : '#4a5568'
          return (
            <div key={role.id} style={{ background: '#0d1117', borderRadius: 8, padding: '8px 10px', border: `1px solid ${done ? 'rgba(34,197,94,0.2)' : '#1a2133'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>#{idx + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.jobTitle}</span>
                  {done && <span style={{ fontSize: 9, fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>✓ FULL</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: '#4a5568', fontFamily: 'JetBrains Mono, monospace' }}>
                    <span style={{ color, fontWeight: 700 }}>{filled}</span>/{role.required}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', minWidth: 34, textAlign: 'right' }}>{rolePct}%</span>
                </div>
              </div>
              {/* Per-role progress bar */}
              <div style={{ height: 4, background: '#1e2533', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${rolePct}%`, borderRadius: 3, transition: 'width 0.4s ease', background: done ? '#22c55e' : 'linear-gradient(90deg,#4f8ff7,#a78bfa)' }} />
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#2e3a50', textAlign: 'right' }}>Click to open detail →</div>
    </div>
  )
}

// ─── New Project Modal ────────────────────────────────────────────────────────
function NewProjectModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ title: '', client: '', status: 'Active' })
  const inputSt = { width: '100%', background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#d1d5db', outline: 'none', fontFamily: 'DM Sans, sans-serif' }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({ id: `p${Date.now()}`, title: form.title.trim(), client: form.client.trim(), status: form.status, roles: [] })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f0f4ff' }}>New Project</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568' }}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Project Title <span style={{ color: '#ec4899' }}>*</span></label>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. ADNOC Offshore Expansion" style={inputSt} autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Client Name</label>
            <input value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} placeholder="e.g. ADNOC" style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#8b95a8', display: 'block', marginBottom: 5 }}>Status</label>
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={{ ...inputSt, cursor: 'pointer', appearance: 'none' }}>
              <option>Active</option><option>On Hold</option><option>Complete</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1e2533', borderRadius: 8, color: '#8b95a8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ flex: 2, padding: '10px', background: '#4f8ff7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Create Project</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Todo List ────────────────────────────────────────────────────────────────
const INIT_TODOS = [
  { id: 1, text: 'Follow up with Ahmed on visa documents', done: false },
  { id: 2, text: 'Send offer letter to Sarah Johnson',     done: false },
  { id: 3, text: 'Schedule medical for Rajan Nair',        done: true  },
  { id: 4, text: 'Collect passport copy from Hassan',      done: false },
]

function TodoCard() {
  const [todos, setTodos] = useState(INIT_TODOS)
  const [text, setText] = useState('')
  const toggle = (id) => setTodos((t) => t.map((item) => item.id === id ? { ...item, done: !item.done } : item))
  const remove = (id) => setTodos((t) => t.filter((item) => item.id !== id))
  const add = () => { if (!text.trim()) return; setTodos((t) => [...t, { id: Date.now(), text: text.trim(), done: false }]); setText('') }

  return (
    <div style={cardBase}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <CheckSquare size={14} color="#a78bfa" /> Todo List
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto', marginBottom: 10 }}>
        {todos.map((todo) => (
          <div key={todo.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderBottom: '1px solid #1a2133' }}>
            <button onClick={() => toggle(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, marginTop: 1 }}>
              {todo.done ? <CheckSquare size={13} color="#22c55e" /> : <Square size={13} color="#4a5568" />}
            </button>
            <span style={{ fontSize: 12, color: todo.done ? '#4a5568' : '#c0c8d8', textDecoration: todo.done ? 'line-through' : 'none', flex: 1, lineHeight: 1.4 }}>{todo.text}</span>
            <button onClick={() => remove(todo.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2e3a50', padding: 0 }}><X size={10} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="Add task…"
          style={{ flex: 1, background: '#0d1117', border: '1px solid #1e2533', borderRadius: 7, padding: '6px 10px', fontSize: 12, color: '#d1d5db', outline: 'none', fontFamily: 'DM Sans, sans-serif' }} />
        <button onClick={add} style={{ padding: '6px 10px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 7, color: '#a78bfa', cursor: 'pointer' }}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({
  candidates, interviews, projects,
  onAddProject, onUpdateProject, onAddRole, onDeleteRole,
  onAddCandidateToRole, onRemoveCandidateFromRole,
  onNavigateToCandidates, onNavigateToInterviews,
}) {
  const [showNewProject, setShowNewProject] = useState(false)
  const [detailProject, setDetailProject]   = useState(null)
  const allProjectsRef = useRef(null)

  const topProjects = [...projects].sort((a, b) => pct(b) - pct(a)).slice(0, 3)

  const upcomingInterviews = interviews
    .filter((iv) => iv.status === 'Scheduled' && iv.date >= TODAY)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 5)

  const selectedCandidates = candidates.filter((c) => c.status === 'Selected')

  const getCandidateName = (id) => candidates.find((c) => c.id === id)?.name || 'Unknown'
  const getSessionLabel  = (iv) => iv.title || iv.type || 'Interview'

  const formatDate = (d) => {
    if (!d) return ''
    if (d === TODAY) return 'Today'
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  const formatTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
  }

  // sync detail modal with latest project state
  const liveDetail = detailProject ? projects.find((p) => p.id === detailProject.id) || detailProject : null

  return (
    <div style={{ padding: '28px 32px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#4a5568', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>RRE HR Consultancy</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f0f4ff', margin: 0, letterSpacing: '-0.5px' }}>Recruitment Dashboard</h1>
        <div style={{ fontSize: 13, color: '#8b95a8', marginTop: 4 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── Pipeline Funnel ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Users size={14} color="#4f8ff7" /> Recruitment Pipeline
          <span style={{ fontSize: 11, color: '#4a5568', fontWeight: 400 }}>{candidates.length} total candidates</span>
        </div>
        {[PIPELINE_STAGES.slice(0, 6), PIPELINE_STAGES.slice(6)].map((row, rowIdx) => (
          <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: rowIdx === 0 ? 10 : 0 }}>
            {row.map((stage) => {
              const count = candidates.filter((c) => c.status === stage.status).length
              const pctOfAll = candidates.length > 0 ? Math.round((count / candidates.length) * 100) : 0
              return (
                <button
                  key={stage.status}
                  onClick={() => onNavigateToCandidates({ status: stage.status, category: '' })}
                  style={{ background: '#111620', border: `1px solid #1e2533`, borderRadius: 10, padding: '12px 10px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = stage.border; e.currentTarget.style.background = stage.bg }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e2533'; e.currentTarget.style.background = '#111620' }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: stage.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1, marginBottom: 3 }}>{count}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#d1d5db', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stage.status}</div>
                  <div style={{ height: 3, background: '#1e2533', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctOfAll}%`, background: stage.color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* ── Top 3 Projects ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={14} color="#4f8ff7" /> Projects
            <span style={{ fontSize: 11, color: '#4a5568', fontWeight: 400 }}>top {topProjects.length} by completion</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => allProjectsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'transparent', border: '1px solid #1e2533', borderRadius: 8, color: '#8b95a8', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              <ArrowDown size={12} /> View All
            </button>
            <button onClick={() => setShowNewProject(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', background: '#4f8ff7', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              <Plus size={13} /> New Project
            </button>
          </div>
        </div>

        {topProjects.length === 0 ? (
          <div style={{ ...cardBase, textAlign: 'center', color: '#4a5568', fontSize: 13, padding: 32 }}>
            No projects yet. Click <strong style={{ color: '#4f8ff7' }}>+ New Project</strong> to get started.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {topProjects.map((p) => (
              <ProjectCard key={p.id} project={p} onClick={() => setDetailProject(p)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Row 2: Interviews | Selected | Todo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 32 }}>

        {/* Upcoming Interviews */}
        <div style={cardBase}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} color="#0ea5e9" /> Upcoming Interviews
            </div>
            <button onClick={onNavigateToInterviews} style={{ fontSize: 11, color: '#4f8ff7', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans' }}>View all →</button>
          </div>
          {upcomingInterviews.length === 0
            ? <p style={{ fontSize: 12, color: '#4a5568', fontStyle: 'italic' }}>No upcoming interviews</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {upcomingInterviews.map((iv) => {
                  const isToday = iv.date === TODAY
                  return (
                    <button key={iv.id} onClick={onNavigateToInterviews}
                      style={{ width: '100%', textAlign: 'left', background: isToday ? 'rgba(234,179,8,0.06)' : '#0d1117', border: `1px solid ${isToday ? 'rgba(234,179,8,0.25)' : '#1e2533'}`, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', fontFamily: 'DM Sans, sans-serif' }}>
                      <div style={{ textAlign: 'center', minWidth: 32, flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: isToday ? '#eab308' : '#4f8ff7', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{new Date(iv.date).getDate()}</div>
                        <div style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase' }}>{formatDate(iv.date)}</div>
                      </div>
                      <div style={{ borderLeft: `2px solid ${isToday ? '#eab308' : '#1e2533'}`, paddingLeft: 8, flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getSessionLabel(iv)}</div>
                        <div style={{ fontSize: 11, color: '#4a5568', marginTop: 1 }}>{iv.type} · {formatTime(iv.time)} · {(iv.candidates || []).length} candidate{(iv.candidates || []).length !== 1 ? 's' : ''}</div>
                      </div>
                      {isToday && <span style={{ fontSize: 9, fontWeight: 700, color: '#eab308', background: 'rgba(234,179,8,0.15)', border: '1px solid rgba(234,179,8,0.3)', padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>TODAY</span>}
                    </button>
                  )
                })}
              </div>
          }
        </div>

        {/* Selected Candidates */}
        <div style={cardBase}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} color="#22c55e" /> Selected Candidates
            </div>
            <button onClick={() => onNavigateToCandidates({ status: 'Selected', category: '' })} style={{ fontSize: 11, color: '#4f8ff7', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans' }}>View all →</button>
          </div>
          {selectedCandidates.length === 0
            ? <p style={{ fontSize: 12, color: '#4a5568', fontStyle: 'italic' }}>No selected candidates</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 230, overflowY: 'auto' }}>
                {selectedCandidates.map((c) => (
                  <button key={c.id} onClick={() => onNavigateToCandidates({ status: 'Selected', category: '' })}
                    style={{ width: '100%', textAlign: 'left', background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#4f8ff744,#a78bfa44)', border: '1px solid #1e2533', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#a78bfa', flexShrink: 0 }}>
                      {c.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.role}</div>
                    </div>
                    <ChevronRight size={12} color="#2e3a50" />
                  </button>
                ))}
              </div>
          }
        </div>

        {/* Todo */}
        <TodoCard />
      </div>

      {/* ── All Projects Section ── */}
      <div ref={allProjectsRef}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f0f4ff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Briefcase size={14} color="#a78bfa" /> All Projects
            <span style={{ fontSize: 11, color: '#4a5568', fontWeight: 400 }}>{projects.length} total</span>
          </div>
        </div>
        {projects.length === 0 ? (
          <div style={{ ...cardBase, textAlign: 'center', color: '#4a5568', fontSize: 13, padding: 32 }}>No projects yet.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onClick={() => setDetailProject(p)} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} onAdd={onAddProject} />}

      {liveDetail && (
        <ProjectDetailModal
          project={liveDetail}
          candidates={candidates}
          onClose={() => setDetailProject(null)}
          onAddCandidate={onAddCandidateToRole}
          onRemoveCandidate={onRemoveCandidateFromRole}
          onAddRole={onAddRole}
          onDeleteRole={onDeleteRole}
          onUpdateProject={onUpdateProject}
        />
      )}
    </div>
  )
}
