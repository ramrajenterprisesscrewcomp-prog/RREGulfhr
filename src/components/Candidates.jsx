import { useState, useMemo } from 'react'
import { Search, Plus, Upload, Download, ChevronUp, ChevronDown, X, SlidersHorizontal, Trash2, Eye, EyeOff, ExternalLink, FileText, Mail } from 'lucide-react'
import StatusBadge from './StatusBadge'
import AddCandidateModal from './AddCandidateModal'
import BulkUploadModal from './BulkUploadModal'
import EmailScanModal from './EmailScanModal'
import CandidateDrawer from './CandidateDrawer'
import { CATEGORIES, PIPELINE_STAGES } from '../data/mockData'

const TODAY = new Date().toISOString().split('T')[0]

// Convert Drive webViewLink → embeddable preview URL
function driveEmbedUrl(url) {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^/?#]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  return url
}

function Toast({ message }) {
  return (
    <div
      className="toast-animate"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 200,
        background: '#22c55e', color: '#fff', padding: '12px 20px',
        borderRadius: 10, fontSize: 13, fontWeight: 600,
        boxShadow: '0 8px 32px rgba(34,197,94,0.35)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      ✓ {message}
    </div>
  )
}

export default function Candidates({
  candidates,
  interviews,
  onAddCandidate,
  onUpdateCandidate,
  onDeleteCandidate,
  onAddInterview,
  externalFilter,
  onClearExternalFilter,
  drawerCandidate,
  onOpenDrawer,
  onCloseDrawer,
}) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState(externalFilter?.category || '')
  const [filterStatus, setFilterStatus] = useState(externalFilter?.status || '')
  const [filterLocation, setFilterLocation] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [sortField, setSortField] = useState('date_added')
  const [sortDir, setSortDir] = useState('desc')
  const [showModal, setShowModal]           = useState(false)
  const [showBulkModal, setShowBulkModal]   = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [toast, setToast]                   = useState(null)
  const [previewCandidate, setPreviewCandidate] = useState(null)

  // Sync external filter
  useMemo(() => {
    if (externalFilter?.status) setFilterStatus(externalFilter.status)
    if (externalFilter?.category) setFilterCategory(externalFilter.category)
  }, [externalFilter])

  const locations = useMemo(() => [...new Set(candidates.map((c) => c.location).filter(Boolean))].sort(), [candidates])

  const dateFrom = useMemo(() => {
    if (!filterDate) return null
    const d = new Date()
    d.setDate(d.getDate() - parseInt(filterDate))
    return d.toISOString().split('T')[0]
  }, [filterDate])

  const filtered = useMemo(() => {
    let list = [...candidates]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || (c.phone || '').includes(q) || (c.email || '').toLowerCase().includes(q))
    }
    if (filterCategory) list = list.filter((c) => c.category === filterCategory)
    if (filterStatus) list = list.filter((c) => c.status === filterStatus)
    if (filterLocation) list = list.filter((c) => c.location === filterLocation)
    if (dateFrom) list = list.filter((c) => c.date_added >= dateFrom)

    list.sort((a, b) => {
      let av = a[sortField] || ''
      let bv = b[sortField] || ''
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [candidates, search, filterCategory, filterStatus, filterLocation, dateFrom, sortField, sortDir])

  const hasFilter = search || filterCategory || filterStatus || filterLocation || filterDate

  const clearAll = () => {
    setSearch(''); setFilterCategory(''); setFilterStatus('')
    setFilterLocation(''); setFilterDate('')
    onClearExternalFilter()
  }

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUp size={12} color="#2e3a50" />
    return sortDir === 'asc' ? <ChevronUp size={12} color="#4f8ff7" /> : <ChevronDown size={12} color="#4f8ff7" />
  }

  const handleAdd = (candidate, file) => {
    onAddCandidate(candidate, file)
    setToast('Candidate added successfully!')
    setTimeout(() => setToast(null), 3000)
  }

  const handleBulkAdd = (candidates) => {
    candidates.forEach((c) => onAddCandidate(c))
    setToast(`${candidates.length} candidate${candidates.length !== 1 ? 's' : ''} added!`)
    setTimeout(() => setToast(null), 3000)
  }

  const togglePreview = (e, c) => {
    e.stopPropagation()
    setPreviewCandidate((prev) => (prev?.id === c.id ? null : c))
  }

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

  const selectStyle = {
    background: '#0d1117', border: '1px solid #1e2533', borderRadius: 8,
    padding: '7px 10px', fontSize: 12, color: '#8b95a8', outline: 'none',
    cursor: 'pointer', appearance: 'none', fontFamily: 'DM Sans, sans-serif',
  }

  const isPreviewing = Boolean(previewCandidate)

  return (
    <div style={{ display: 'flex', minHeight: '100%', alignItems: 'flex-start' }}>

      {/* ── LEFT: Table panel ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, padding: '28px 32px', transition: 'all 0.25s' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f0f4ff', margin: 0 }}>Candidate Database</h1>
            <p style={{ fontSize: 13, color: '#4a5568', margin: '4px 0 0' }}>
              {filtered.length} of {candidates.length} candidates
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowEmailModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, color: '#22c55e', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
            >
              <Mail size={15} /> Scan Email
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px', background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 10, color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167,139,250,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(167,139,250,0.12)'}
            >
              <Upload size={15} /> Bulk Upload
            </button>
            <button
              onClick={() => setShowModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#4f8ff7', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(79,143,247,0.3)', fontFamily: 'DM Sans, sans-serif' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#3d7de0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#4f8ff7'}
            >
              <Plus size={16} /> Add Candidate
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 12, padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <Search size={14} color="#4a5568" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, phone, email..."
              style={{ ...selectStyle, paddingLeft: 32, width: '100%', color: '#d1d5db' }}
            />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={selectStyle}>
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={selectStyle}>
            <option value="">All Statuses</option>
            {PIPELINE_STAGES.map((s) => <option key={s.status} value={s.status}>{s.status}</option>)}
          </select>
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={selectStyle}>
            <option value="">All Locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={selectStyle}>
            <option value="">Any Date</option>
            <option value="1">Last 1 day</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          {hasFilter && (
            <button
              onClick={clearAll}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
            >
              <X size={12} /> Clear All
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ background: '#111620', border: '1px solid #1e2533', borderRadius: 12, overflowX: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.6fr 1.3fr 1.5fr 1.3fr 1.4fr 1.4fr 1.1fr 1.1fr 1.5fr 1.3fr 0.9fr 0.4fr', gap: 0, borderBottom: '1px solid #1e2533', background: '#0d1117', minWidth: 1600 }}>
            {[
              { label: 'Timestamp',      field: 'date_added' },
              { label: 'Name',           field: 'name' },
              { label: 'Contact Number', field: null },
              { label: 'Email ID',       field: 'email' },
              { label: 'Role',           field: 'role' },
              { label: 'Experience',     field: null },
              { label: 'Education',      field: null },
              { label: 'Location',       field: 'location' },
              { label: 'Nationality',    field: 'nationality' },
              { label: 'Short Notes',    field: null },
              { label: 'Status',         field: 'status' },
              { label: 'Resume',         field: null },
              { label: '',               field: null },
            ].map(({ label, field }) => (
              <div
                key={label}
                onClick={() => field && toggleSort(field)}
                style={{
                  padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#4a5568',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  cursor: field ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 4,
                  userSelect: 'none',
                }}
              >
                {label}
                {field && <SortIcon field={field} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#4a5568', fontSize: 14 }}>
              <SlidersHorizontal size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div style={{ fontWeight: 600, color: '#8b95a8', marginBottom: 4 }}>No candidates found</div>
              <div style={{ fontSize: 12 }}>Try adjusting your filters</div>
            </div>
          ) : (
            filtered.map((c, idx) => {
              const isActive = previewCandidate?.id === c.id
              return (
                <div
                  key={c.id}
                  className="table-row-hover"
                  onClick={() => onOpenDrawer(c)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '0.9fr 1.6fr 1.3fr 1.5fr 1.3fr 1.4fr 1.4fr 1.1fr 1.1fr 1.5fr 1.3fr 0.9fr 0.4fr',
                    gap: 0,
                    borderBottom: idx < filtered.length - 1 ? '1px solid #1a2133' : 'none',
                    background: isActive ? 'rgba(79,143,247,0.06)' : undefined,
                    transition: 'background 0.12s',
                    minWidth: 1600,
                  }}
                >
                  {/* Timestamp */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#4a5568', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>{formatDate(c.date_added)}</span>
                  </div>

                  {/* Name */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: isActive ? 'linear-gradient(135deg, #4f8ff766, #a78bfa66)' : 'linear-gradient(135deg, #4f8ff744, #a78bfa44)',
                      border: `1px solid ${isActive ? 'rgba(79,143,247,0.4)' : '#1e2533'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#a78bfa',
                    }}>
                      {c.name.charAt(0)}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? '#f0f4ff' : '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    </div>
                  </div>

                  {/* Contact Number */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#8b95a8', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.phone || '—'}</span>
                  </div>

                  {/* Email ID */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#8b95a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.email || '—'}</span>
                  </div>

                  {/* Role */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 13, color: '#8b95a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.role}</span>
                  </div>

                  {/* Experience */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#8b95a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.experience || '—'}</span>
                  </div>

                  {/* Education */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#8b95a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.education || '—'}</span>
                  </div>

                  {/* Location */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#8b95a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.location || '—'}</span>
                  </div>

                  {/* Nationality */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#8b95a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.nationality || '—'}</span>
                  </div>

                  {/* Short Notes */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', width: '100%' }}>{c.notes || '—'}</span>
                  </div>

                  {/* Status */}
                  <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center' }}>
                    <StatusBadge status={c.status} size="sm" />
                  </div>

                  {/* Resume */}
                  <div style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {c.resume_url ? (
                      <>
                        <button
                          onClick={(e) => togglePreview(e, c)}
                          title={isActive ? 'Close preview' : 'Preview resume'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 3,
                            padding: '3px 7px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 600,
                            background: isActive ? 'rgba(79,143,247,0.22)' : 'rgba(79,143,247,0.1)',
                            color: isActive ? '#93c5fd' : '#4f8ff7',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79,143,247,0.25)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = isActive ? 'rgba(79,143,247,0.22)' : 'rgba(79,143,247,0.1)'}
                        >
                          {isActive ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                        <a
                          href={c.resume_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open in Drive"
                          style={{ display: 'flex', alignItems: 'center', padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(79,143,247,0.2)', color: '#4a5568', textDecoration: 'none', transition: 'color 0.12s' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#4f8ff7'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}
                        >
                          <Download size={11} />
                        </a>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: '#2e3a50' }}>—</span>
                    )}
                  </div>

                  {/* Delete */}
                  <div style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete ${c.name}?`)) { if (previewCandidate?.id === c.id) setPreviewCandidate(null); onDeleteCandidate(c.id) } }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2e3a50', padding: 4, borderRadius: 5, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#2e3a50'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Resume Preview Panel ─────────────────────────────────────── */}
      {isPreviewing && (
        <div style={{
          width: '46%', flexShrink: 0,
          position: 'sticky', top: 0,
          height: 'calc(100vh - 42px)',   // 42px = GoogleTopBar height
          borderLeft: '1px solid #1e2533',
          background: '#0a0e18',
          display: 'flex', flexDirection: 'column',
          zIndex: 10,
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid #1e2533',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, background: '#080c14',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'linear-gradient(135deg, #4f8ff744, #a78bfa44)',
                border: '1px solid rgba(79,143,247,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#a78bfa',
              }}>
                {previewCandidate.name.charAt(0)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f0f4ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewCandidate.name}
                </div>
                <div style={{ fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewCandidate.role}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <a
                href={previewCandidate.resume_url}
                target="_blank"
                rel="noreferrer"
                title="Open in Google Drive"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                  background: 'rgba(79,143,247,0.1)', border: '1px solid rgba(79,143,247,0.25)',
                  borderRadius: 7, color: '#4f8ff7', fontSize: 11, fontWeight: 600,
                  textDecoration: 'none', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(79,143,247,0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(79,143,247,0.1)'}
              >
                <ExternalLink size={11} /> Open
              </a>
              <button
                onClick={() => setPreviewCandidate(null)}
                title="Close preview"
                style={{
                  display: 'flex', alignItems: 'center', background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7, padding: '5px 8px',
                  cursor: 'pointer', color: '#ef4444', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* iframe */}
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <iframe
              key={previewCandidate.id}
              src={driveEmbedUrl(previewCandidate.resume_url)}
              title={`${previewCandidate.name} resume`}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              allow="autoplay"
            />
            {/* Subtle overlay label */}
            <div style={{
              position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(8,12,20,0.75)', border: '1px solid #1e2533',
              borderRadius: 6, padding: '4px 10px', fontSize: 10, color: '#4a5568',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              <FileText size={9} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Resume · Google Drive
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && <AddCandidateModal onClose={() => setShowModal(false)} onAdd={handleAdd} existingCandidates={candidates} />}
      {showBulkModal && <BulkUploadModal onClose={() => setShowBulkModal(false)} onAddMultiple={handleBulkAdd} existingCandidates={candidates} />}
      {showEmailModal && (
        <EmailScanModal
          onClose={() => setShowEmailModal(false)}
          existingCandidates={candidates}
          onAddCandidates={(newCands) => {
            newCands.forEach((c) => {
              const { _resumeFile, ...clean } = c
              onAddCandidate(clean, _resumeFile || null)
            })
            setToast(`${newCands.length} candidate${newCands.length !== 1 ? 's' : ''} imported from email!`)
            setTimeout(() => setToast(null), 3000)
          }}
        />
      )}

      {drawerCandidate && (
        <CandidateDrawer
          candidate={drawerCandidate}
          interviews={interviews.filter((i) => i.candidate_id === drawerCandidate.id)}
          onClose={onCloseDrawer}
          onUpdate={(updates) => onUpdateCandidate(drawerCandidate.id, updates)}
          onScheduleInterview={() => {}}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  )
}
