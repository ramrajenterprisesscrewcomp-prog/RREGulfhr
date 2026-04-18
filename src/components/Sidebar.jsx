import { LayoutDashboard, Users, Calendar, FileText, Star, ChevronRight } from 'lucide-react'
import GoogleSyncStatus from './GoogleSyncStatus'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
  { id: 'candidates', label: 'Candidate Database',  icon: Users           },
  { id: 'interviews', label: 'Interview Schedule',  icon: Calendar        },
  { id: 'documents',  label: 'Documentation',       icon: FileText        },
]

export default function Sidebar({ candidates, interviews, activeTab, setActiveTab, onCandidateClick, googleSync, onLoadCandidates }) {
  const selected = candidates.filter((c) => c.status === 'Selected')
  const scheduledCount = interviews.filter((i) => i.status === 'Scheduled').length

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''

  return (
    <aside
      style={{
        width: 230,
        minWidth: 230,
        background: '#0a0f19',
        borderRight: '1px solid #1e2533',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div style={{ padding: '22px 18px 16px', borderBottom: '1px solid #1a2235' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #4f8ff7 0%, #a78bfa 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px',
              boxShadow: '0 4px 12px rgba(79,143,247,0.35)',
            }}
          >
            RR
          </div>
          <div>
            <div
              style={{
                fontSize: 14, fontWeight: 800, letterSpacing: '-0.3px',
                background: 'linear-gradient(135deg, #4f8ff7, #a78bfa)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
            >
              RRE HR
            </div>
            <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 500, letterSpacing: '0.04em' }}>
              CONSULTANCY DASHBOARD
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 10px 8px' }}>
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          const badge = id === 'interviews' ? scheduledCount : id === 'candidates' ? candidates.length : null
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 10px',
                borderRadius: 9, border: 'none', cursor: 'pointer', marginBottom: 2,
                display: 'flex', alignItems: 'center', gap: 10,
                background: isActive ? 'rgba(79,143,247,0.12)' : 'transparent',
                color: isActive ? '#4f8ff7' : '#8b95a8',
                fontFamily: 'DM Sans, sans-serif',
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#111d2e'; e.currentTarget.style.color = '#c0c8d8' }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b95a8' } }}
            >
              {isActive && (
                <span style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, borderRadius: '0 3px 3px 0', background: '#4f8ff7' }} />
              )}
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              {label}
              {badge > 0 && (
                <span style={{
                  marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                  background: isActive ? '#4f8ff7' : '#1e2533',
                  color: isActive ? '#fff' : '#8b95a8',
                  borderRadius: 10, padding: '1px 7px', minWidth: 18, textAlign: 'center',
                }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: '#1e2533', margin: '4px 14px' }} />

      {/* Selected Candidates */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '10px 10px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '0 4px' }}>
          <Star size={12} color="#eab308" fill="#eab308" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#8b95a8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Selected</span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
            background: 'rgba(234,179,8,0.15)', color: '#eab308',
            border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 10, padding: '1px 7px',
          }}>
            {selected.length}
          </span>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, maxHeight: 260 }}>
          {selected.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4a5568', textAlign: 'center', marginTop: 16, fontStyle: 'italic' }}>
              No selected candidates
            </p>
          ) : (
            selected.map((c) => (
              <button
                key={c.id}
                onClick={() => { setActiveTab('candidates'); onCandidateClick(c) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px',
                  borderRadius: 8, border: 'none', cursor: 'pointer', marginBottom: 3,
                  background: 'transparent', display: 'flex', flexDirection: 'column', gap: 2,
                  fontFamily: 'DM Sans, sans-serif', transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#111d2e'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>{c.name}</span>
                  <ChevronRight size={11} color="#4a5568" />
                </div>
                <span style={{ fontSize: 11, color: '#4a5568' }}>{c.role}</span>
                <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                  <span style={{ fontSize: 10, color: '#4a5568', background: '#1a2133', padding: '1px 6px', borderRadius: 4 }}>{c.category}</span>
                  <span style={{ fontSize: 10, color: '#4a5568' }}>{formatDate(c.date_added)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {selected.length > 0 && (
          <button
            onClick={() => setActiveTab('candidates')}
            style={{
              width: '100%', padding: '7px', marginTop: 4, marginBottom: 8,
              background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)',
              borderRadius: 8, color: '#eab308', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}
          >
            View all {selected.length} selected →
          </button>
        )}
      </div>

      {/* Stats footer */}
      <div style={{ padding: '10px 14px 8px', borderTop: '1px solid #1e2533', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: '#4a5568', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Candidates</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#4f8ff7', fontFamily: 'JetBrains Mono, monospace' }}>{candidates.length}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#4a5568' }}>Onboard</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', fontFamily: 'JetBrains Mono, monospace' }}>
            {candidates.filter((c) => c.status === 'Onboard').length}
          </div>
        </div>
      </div>

      {/* Google Sync */}
      {googleSync && (
        <GoogleSyncStatus
          sync={googleSync}
          candidates={candidates}
          onLoadCandidates={onLoadCandidates}
        />
      )}
    </aside>
  )
}
