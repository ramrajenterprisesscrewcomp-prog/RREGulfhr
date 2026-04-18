import { useState } from 'react'
import { LogIn, LogOut, Loader, CheckCircle2, AlertCircle, RefreshCw, Table2, HardDrive } from 'lucide-react'

export default function GoogleSyncStatus({ sync, candidates, onLoadCandidates }) {
  const [working, setWorking] = useState(false)
  const [prompt,  setPrompt]  = useState(null)   // 'export' | { type:'load', data } | null

  const handleConnect = async () => {
    setWorking(true)
    try {
      await sync.connect()
      const sheetData = await sync.fetchCandidates()
      if (sheetData === null) return
      if (sheetData.length === 0 && candidates.length > 0) {
        setPrompt('export')
      } else if (sheetData.length > 0) {
        setPrompt({ type: 'load', data: sheetData })
      }
    } catch { /* error shown via sync.error */ }
    finally { setWorking(false) }
  }

  const confirmExport = async () => {
    setWorking(true)
    try { await sync.exportAll(candidates) }
    finally { setWorking(false); setPrompt(null) }
  }

  const confirmLoad = (data) => { onLoadCandidates(data); setPrompt(null) }

  const handleRefresh = async () => {
    setWorking(true)
    try {
      const data = await sync.fetchCandidates()
      if (data?.length) onLoadCandidates(data)
    } finally { setWorking(false) }
  }

  const timeStr = sync.lastSync
    ? sync.lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null

  // ── Not configured ─────────────────────────────────────────────────────────
  if (!sync.hasConfig) return (
    <div style={{ padding: '10px 14px 12px', borderTop: '1px solid #1e2533' }}>
      <div style={{ fontSize: 10, color: '#2e3a50', lineHeight: 1.6 }}>
        Add to <span style={{ color: '#4a5568' }}>.env</span>:<br />
        <code style={{ color: '#eab308', fontSize: 9 }}>VITE_GOOGLE_CLIENT_ID</code><br />
        <code style={{ color: '#eab308', fontSize: 9 }}>VITE_GOOGLE_SHEET_ID</code>
      </div>
    </div>
  )

  // ── Export prompt ──────────────────────────────────────────────────────────
  if (prompt === 'export') return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid #1e2533' }}>
      <div style={{ fontSize: 11, color: '#eab308', fontWeight: 700, marginBottom: 5 }}>Sheet is empty</div>
      <div style={{ fontSize: 11, color: '#8b95a8', marginBottom: 8, lineHeight: 1.4 }}>
        Push {candidates.length} candidates to Google Sheets now?
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={confirmExport} disabled={working} style={btn('#22c55e')}>
          {working ? <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> : 'Export'}
        </button>
        <button onClick={() => setPrompt(null)} style={btn('#4a5568')}>Skip</button>
      </div>
    </div>
  )

  // ── Load prompt ────────────────────────────────────────────────────────────
  if (prompt?.type === 'load') return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid #1e2533' }}>
      <div style={{ fontSize: 11, color: '#4f8ff7', fontWeight: 700, marginBottom: 5 }}>Sheet has data</div>
      <div style={{ fontSize: 11, color: '#8b95a8', marginBottom: 8, lineHeight: 1.4 }}>
        Load {prompt.data.length} candidates from sheet?
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => confirmLoad(prompt.data)} style={btn('#4f8ff7')}>Load</button>
        <button onClick={() => setPrompt(null)} style={btn('#4a5568')}>Skip</button>
      </div>
    </div>
  )

  // ── Disconnected ───────────────────────────────────────────────────────────
  if (!sync.connected) return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid #1e2533' }}>
      <button
        onClick={handleConnect}
        disabled={!sync.ready || working}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 10px', borderRadius: 8,
          border: '1px solid rgba(79,143,247,0.35)',
          background: 'rgba(79,143,247,0.1)', color: '#4f8ff7',
          fontSize: 12, fontWeight: 700, cursor: sync.ready && !working ? 'pointer' : 'not-allowed',
          fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (sync.ready && !working) e.currentTarget.style.background = 'rgba(79,143,247,0.2)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79,143,247,0.1)' }}
      >
        {working
          ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</>
          : <><LogIn size={13} /> Connect Google Sheets</>}
      </button>
      <div style={{ fontSize: 10, color: '#2e3a50', textAlign: 'center', marginTop: 5, lineHeight: 1.4 }}>
        Connect once — stays connected on refresh
      </div>
      {sync.error && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginTop: 6, fontSize: 10, color: '#ef4444' }}>
          <AlertCircle size={10} style={{ flexShrink: 0, marginTop: 1 }} />{sync.error}
        </div>
      )}
    </div>
  )

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '10px 14px 12px', borderTop: '1px solid #1e2533' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {sync.syncing
          ? <Loader size={11} color="#4f8ff7" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          : <CheckCircle2 size={11} color="#22c55e" style={{ flexShrink: 0 }} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: sync.syncing ? '#4f8ff7' : '#22c55e', flex: 1 }}>
          {sync.syncing ? 'Syncing…' : 'Google Synced'}
        </span>
        <button onClick={handleRefresh} disabled={sync.syncing || working} title="Refresh from sheet"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 2, display: 'flex' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#4f8ff7'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}>
          <RefreshCw size={11} />
        </button>
        <button onClick={sync.disconnect} title="Disconnect"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', padding: 2, display: 'flex' }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}>
          <LogOut size={11} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Table2 size={10} color="#22c55e" />
          <span style={{ fontSize: 10, color: '#4a5568' }}>Sheet</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <HardDrive size={10} color="#22c55e" />
          <span style={{ fontSize: 10, color: '#4a5568' }}>Drive</span>
        </div>
        {timeStr && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace' }}>
            {timeStr}
          </span>
        )}
      </div>
      {sync.error && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', marginTop: 5, fontSize: 10, color: '#ef4444' }}>
          <AlertCircle size={10} style={{ flexShrink: 0, marginTop: 1 }} />{sync.error}
        </div>
      )}
    </div>
  )
}

function btn(color) {
  return {
    flex: 1, padding: '6px 8px', borderRadius: 6,
    border: `1px solid ${color}40`, background: `${color}15`,
    color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  }
}
