import { useState } from 'react'
import { Loader, CheckCircle2, AlertCircle, RefreshCw, Menu } from 'lucide-react'

export default function GoogleTopBar({ sync, candidates, onLoadCandidates, onLoadProjects, onLoadInterviews, onLoadDocuments, onMenuClick, isMobile }) {
  const [working, setWorking] = useState(false)

  const handleRefresh = async () => {
    setWorking(true)
    try {
      const [data, projects, ivs, docs] = await Promise.all([
        sync.fetchCandidates(),
        sync.fetchProjects(),
        sync.fetchInterviews(),
        sync.fetchDocuments(),
      ])
      if (data?.length)     onLoadCandidates?.(data)
      if (projects?.length) onLoadProjects?.(projects)
      if (ivs?.length)      onLoadInterviews?.(ivs)
      if (docs)             onLoadDocuments?.(docs)
    } finally { setWorking(false) }
  }

  const timeStr = sync.lastSync
    ? sync.lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null

  const barStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: isMobile ? '0 12px' : '0 18px', height: 46, flexShrink: 0,
    background: '#080c14', borderBottom: '1px solid #1a2030',
    fontFamily: 'DM Sans, sans-serif',
  }

  return (
    <div style={barStyle}>
      {isMobile && (
        <button onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b95a8', padding: '4px 6px', display: 'flex', alignItems: 'center', marginRight: 4 }}>
          <Menu size={20} />
        </button>
      )}

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        {sync.syncing || working
          ? <Loader size={12} color="#4f8ff7" style={{ animation: 'spin 1s linear infinite' }} />
          : sync.connected
            ? <CheckCircle2 size={12} color="#22c55e" />
            : <AlertCircle size={12} color="#ef4444" />}
        <span style={{ fontSize: 12, fontWeight: 700, color: sync.syncing || working ? '#4f8ff7' : sync.connected ? '#22c55e' : '#ef4444' }}>
          {sync.syncing || working ? 'Syncing…' : sync.connected ? 'Google Sheets' : 'Backend offline'}
        </span>
        {timeStr && !isMobile && (
          <span style={{ fontSize: 11, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace' }}>{timeStr}</span>
        )}
      </div>

      {sync.error && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#ef4444', maxWidth: isMobile ? 160 : 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <AlertCircle size={11} style={{ flexShrink: 0 }} />{sync.error}
        </div>
      )}

      <button onClick={handleRefresh} disabled={sync.syncing || working} title="Refresh from sheet"
        style={{ background: 'none', border: 'none', cursor: sync.syncing || working ? 'not-allowed' : 'pointer', color: '#4a5568', padding: '3px 5px', display: 'flex', alignItems: 'center', borderRadius: 4 }}
        onMouseEnter={(e) => e.currentTarget.style.color = '#4f8ff7'}
        onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}>
        <RefreshCw size={13} />
      </button>
    </div>
  )
}
