import { useState, useEffect } from 'react'
import { LogIn, LogOut, Loader, CheckCircle2, AlertCircle, RefreshCw, FlaskConical, Menu } from 'lucide-react'
import { testDriveUpload } from '../services/driveService'

const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || null

export default function GoogleTopBar({ sync, candidates, onLoadCandidates, onLoadProjects, onLoadInterviews, onLoadDocuments, onMenuClick, isMobile }) {
  const [working,    setWorking]    = useState(false)
  const [prompt,     setPrompt]     = useState(null)
  const [driveTest,  setDriveTest]  = useState(null)

  // Auto-connect when GIS is ready and user has connected before
  useEffect(() => {
    if (!sync.ready || sync.connected || working) return
    if (sync.wasConnected?.()) {
      setWorking(true)
      sync.connect().then(() => {
        sync.fetchProjects?.().then((p) => p?.length && onLoadProjects?.(p)).catch(() => {})
        sync.fetchInterviews?.().then((iv) => iv?.length && onLoadInterviews?.(iv)).catch(() => {})
        sync.fetchDocuments?.().then((d) => d && onLoadDocuments?.(d)).catch(() => {})
      }).catch(() => {}).finally(() => setWorking(false))
    }
  }, [sync.ready])

  if (!sync.hasConfig) return null   // hide bar entirely if not configured

  const handleConnect = async () => {
    setWorking(true)
    try {
      await sync.connect()
      // Auto-load projects, interviews and documents immediately (no prompt)
      sync.fetchProjects().then((p)   => { if (p?.length  && onLoadProjects)   onLoadProjects(p)   }).catch(() => {})
      sync.fetchInterviews().then((iv) => { if (iv?.length && onLoadInterviews) onLoadInterviews(iv) }).catch(() => {})
      sync.fetchDocuments?.().then((d) => { if (d && onLoadDocuments) onLoadDocuments(d) }).catch(() => {})
      // Candidates: show load/export prompt
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
      const [data, projects, ivs] = await Promise.all([
        sync.fetchCandidates(),
        sync.fetchProjects(),
        sync.fetchInterviews(),
      ])
      if (data?.length)     onLoadCandidates(data)
      if (projects?.length && onLoadProjects)   onLoadProjects(projects)
      if (ivs?.length     && onLoadInterviews)  onLoadInterviews(ivs)
    } finally { setWorking(false) }
  }

  const timeStr = sync.lastSync
    ? sync.lastSync.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null

  const HamburgerBtn = () => isMobile ? (
    <button onClick={onMenuClick} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b95a8', padding: '4px 6px', display: 'flex', alignItems: 'center', marginRight: 4, flexShrink: 0 }}>
      <Menu size={20} />
    </button>
  ) : null

  const barStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: isMobile ? '0 12px' : '0 18px', height: 46, flexShrink: 0,
    background: '#080c14',
    borderBottom: '1px solid #1a2030',
    fontFamily: 'DM Sans, sans-serif',
  }

  // ── Export prompt ────────────────────────────────────────────────────────────
  if (prompt === 'export') return (
    <div style={barStyle}>
      <HamburgerBtn />
      <span style={{ fontSize: 11, color: '#eab308', fontWeight: 700 }}>Sheet is empty</span>
      <span style={{ fontSize: 11, color: '#8b95a8' }}>Push {candidates.length} candidates to Google Sheets?</span>
      <button onClick={confirmExport} disabled={working} style={chipBtn('#22c55e')}>
        {working ? <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> : null}
        Export
      </button>
      <button onClick={() => setPrompt(null)} style={chipBtn('#4a5568')}>Skip</button>
    </div>
  )

  // ── Load prompt ──────────────────────────────────────────────────────────────
  if (prompt?.type === 'load') return (
    <div style={barStyle}>
      <HamburgerBtn />
      <span style={{ fontSize: 11, color: '#4f8ff7', fontWeight: 700 }}>Sheet has data</span>
      <span style={{ fontSize: 11, color: '#8b95a8' }}>Load {prompt.data.length} candidates from sheet?</span>
      <button onClick={() => confirmLoad(prompt.data)} style={chipBtn('#4f8ff7')}>Load</button>
      <button onClick={() => setPrompt(null)} style={chipBtn('#4a5568')}>Skip</button>
    </div>
  )

  // ── Disconnected ─────────────────────────────────────────────────────────────
  if (!sync.connected) return (
    <div style={barStyle}>
      <HamburgerBtn />
      <button
        onClick={handleConnect}
        disabled={!sync.ready || working}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 14px', borderRadius: 6,
          border: '1px solid rgba(79,143,247,0.4)',
          background: 'rgba(79,143,247,0.12)', color: '#4f8ff7',
          fontSize: 12, fontWeight: 700, cursor: sync.ready && !working ? 'pointer' : 'not-allowed',
          fontFamily: 'DM Sans, sans-serif', transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { if (sync.ready && !working) e.currentTarget.style.background = 'rgba(79,143,247,0.22)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(79,143,247,0.12)' }}
      >
        {working
          ? <><Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> Connecting…</>
          : <><LogIn size={12} /> Connect Google Sheets</>}
      </button>
      {sync.error && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#ef4444' }}>
          <AlertCircle size={11} />{sync.error}
        </div>
      )}
    </div>
  )

  // ── Connected ────────────────────────────────────────────────────────────────
  const handleTestDrive = async () => {
    setDriveTest('testing')
    const result = await testDriveUpload(FOLDER_ID)
    setDriveTest(result)
    setTimeout(() => setDriveTest(null), 8000)
  }

  return (
    <div style={{ ...barStyle, flexWrap: 'wrap', gap: 8 }}>
      <HamburgerBtn />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        {sync.syncing
          ? <Loader size={12} color="#4f8ff7" style={{ animation: 'spin 1s linear infinite' }} />
          : <CheckCircle2 size={12} color="#22c55e" />}
        <span style={{ fontSize: 12, fontWeight: 700, color: sync.syncing ? '#4f8ff7' : '#22c55e' }}>
          {sync.syncing ? 'Syncing…' : 'Google Synced'}
        </span>
        {timeStr && (
          <span style={{ fontSize: 11, color: '#2e3a50', fontFamily: 'JetBrains Mono, monospace' }}>
            {timeStr}
          </span>
        )}
      </div>

      {/* Drive test result */}
      {driveTest && driveTest !== 'testing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
          color: driveTest.ok ? '#22c55e' : '#ef4444',
          background: driveTest.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${driveTest.ok ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          borderRadius: 5, padding: '3px 8px', maxWidth: 420,
        }}>
          {driveTest.ok
            ? <><CheckCircle2 size={11} /> Drive + folders OK</>
            : <><AlertCircle size={11} style={{ flexShrink: 0 }} /> {driveTest.error}</>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {/* Test Drive button */}
        <button
          onClick={handleTestDrive}
          disabled={driveTest === 'testing'}
          title="Test Drive upload"
          style={{ ...iconBtn, display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600, color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 5, background: 'rgba(167,139,250,0.06)' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(167,139,250,0.14)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(167,139,250,0.06)'}
        >
          {driveTest === 'testing'
            ? <><Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</>
            : <><FlaskConical size={10} /> Test Drive</>}
        </button>

        <button onClick={handleRefresh} disabled={sync.syncing || working} title="Refresh from sheet"
          style={iconBtn}
          onMouseEnter={(e) => e.currentTarget.style.color = '#4f8ff7'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}>
          <RefreshCw size={12} />
        </button>
        <button onClick={sync.disconnect} title="Disconnect Google"
          style={iconBtn}
          onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#4a5568'}>
          <LogOut size={12} />
        </button>
      </div>

      {sync.error && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11, color: '#ef4444', width: '100%' }}>
          <AlertCircle size={11} />{sync.error}
        </div>
      )}
    </div>
  )
}

const iconBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#4a5568', padding: '3px 5px', display: 'flex', alignItems: 'center',
  borderRadius: 4, transition: 'color 0.15s',
}

function chipBtn(color) {
  return {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '4px 12px', borderRadius: 5,
    border: `1px solid ${color}40`, background: `${color}18`,
    color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
  }
}
