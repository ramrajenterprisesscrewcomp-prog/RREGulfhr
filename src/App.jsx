import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Candidates from './components/Candidates'
import Interviews from './components/Interviews'
import Documents from './components/Documents'
import { initialCandidates, initialInterviews, initialProjects } from './data/mockData'
import { useGoogleSync } from './hooks/useGoogleSync'
import GoogleTopBar from './components/GoogleTopBar'
import { useIsMobile } from './hooks/useWindowSize'

export default function App() {
  return <AppMain />
}

function AppMain() {
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [candidates, setCandidates] = useState(initialCandidates)
  const [interviews, setInterviews] = useState(initialInterviews)
  const [projects, setProjects] = useState(initialProjects)
  const [documents, setDocuments] = useState([])
  const [docChecklist, setDocChecklist] = useState({})
  const [drawerCandidate, setDrawerCandidate] = useState(null)
  const [candidateFilter, setCandidateFilter] = useState({ status: '', category: '' })

  // ── Google Sheets + Drive sync ───────────────────────────────────────────────
  const googleSync = useGoogleSync()

  // Called by GoogleTopBar after connect: replace local state with sheet data
  const handleLoadCandidates = useCallback((sheetCandidates) => {
    setCandidates(sheetCandidates)
    setDrawerCandidate(null)
  }, [])
  const handleLoadProjects   = useCallback((p)   => setProjects(p),   [])
  const handleLoadInterviews = useCallback((ivs) => setInterviews(ivs), [])
  const handleLoadDocuments  = useCallback((result) => {
    // result can be { docs, checklist } from sheet, or a plain array (local)
    if (Array.isArray(result)) { setDocuments(result); return }
    if (result?.docs)      setDocuments(result.docs)
    if (result?.checklist) setDocChecklist(result.checklist)
  }, [])

  // ── Auto-load all data on connect — single batchGet, 60s throttle ───────────
  const autoLoadDone = useRef(false)
  const lastFetch    = useRef(0)
  useEffect(() => {
    if (!googleSync.connected) { autoLoadDone.current = false; return }
    if (autoLoadDone.current) return
    const now = Date.now()
    if (now - lastFetch.current < 60_000) return   // throttle: max once per minute
    autoLoadDone.current = true
    lastFetch.current = now
    googleSync.fetchAll().then((d) => {
      if (!d) return
      // Always replace with sheet data — even empty arrays — so mock data never persists
      setCandidates(d.candidates  ?? [])
      setProjects(d.projects      ?? [])
      setInterviews(d.interviews  ?? [])
      if (d.docs)      setDocuments(d.docs)
      if (d.checklist) setDocChecklist(d.checklist)
    }).catch(() => {})
  }, [googleSync.connected])

  // ── Navigation ───────────────────────────────────────────────────────────────
  const handleNavigateToCandidates = useCallback((filter) => {
    setActiveTab('candidates')
    setCandidateFilter(filter)
    setDrawerCandidate(null)
  }, [])

  const handleNavigateToInterviews = useCallback(() => {
    setActiveTab('interviews')
    setDrawerCandidate(null)
  }, [])

  // ── Drawer ───────────────────────────────────────────────────────────────────
  const handleOpenDrawer  = useCallback((candidate) => setDrawerCandidate(candidate), [])
  const handleCloseDrawer = useCallback(() => setDrawerCandidate(null), [])

  // ── Candidate CRUD + Google Sync ─────────────────────────────────────────────
  const handleAddCandidate = useCallback((candidate, file) => {
    const { _resumeFile, ...clean } = candidate
    const actualFile = file || _resumeFile || null
    setCandidates((prev) => [clean, ...prev])
    if (googleSync.connected) {
      googleSync.syncAdd(clean, actualFile).then((synced) => {
        if (synced?.resume_url && synced.resume_url !== clean.resume_url) {
          setCandidates((prev) =>
            prev.map((c) => (c.id === synced.id ? { ...c, resume_url: synced.resume_url } : c))
          )
        }
      }).catch(console.warn)
    }
  }, [googleSync])

  const handleUpdateCandidate = useCallback((id, updates) => {
    // Build fullCandidate from the current candidates array (not from the setState updater,
    // which runs asynchronously in React 18 concurrent mode and would be null by sync time)
    const existing = candidates.find((c) => c.id === id)
    if (!existing) return
    const fullCandidate = { ...existing, ...updates }

    setCandidates((prev) => prev.map((c) => (c.id !== id ? c : fullCandidate)))
    setDrawerCandidate((prev) => (prev?.id === id ? { ...prev, ...updates } : prev))

    if (googleSync.connected) {
      googleSync.syncUpdate(id, fullCandidate).catch(console.warn)
    }
  }, [googleSync, candidates])

  const handleDeleteCandidate = useCallback((id) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id))
    setDrawerCandidate((prev) => (prev?.id === id ? null : prev))

    if (googleSync.connected) {
      googleSync.syncDelete(id).catch(console.warn)
    }
  }, [googleSync])

  // ── Bulk add (from BulkUploadModal) ─────────────────────────────────────────
  const handleBulkAdd = useCallback((newCandidates) => {
    // Strip _resumeFile, add to state immediately
    const clean = newCandidates.map(({ _resumeFile, ...c }) => c)
    setCandidates((prev) => [...clean, ...prev])

    // Sync all to Sheets + Drive in background
    if (googleSync.connected) {
      googleSync.syncAddMany(newCandidates).then((synced) => {
        // Update any candidates whose resume_url changed (Drive upload)
        setCandidates((prev) =>
          prev.map((c) => {
            const s = synced.find((x) => x.id === c.id)
            return s && s.resume_url !== c.resume_url ? { ...c, resume_url: s.resume_url } : c
          })
        )
      }).catch(console.warn)
    }
  }, [googleSync])

  // ── Project CRUD + Google Sync ───────────────────────────────────────────────
  const handleAddProject = useCallback((project) => {
    const next = [project, ...projects]
    setProjects(next)
    if (googleSync.connected) googleSync.syncProjects(next, candidates).catch(console.warn)
  }, [googleSync, candidates, projects])

  const handleUpdateProject = useCallback((projectId, roleId, updates) => {
    const next = projects.map((p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        roles: roleId ? p.roles.map((r) => (r.id === roleId ? { ...r, ...updates } : r)) : p.roles,
        ...(roleId ? {} : updates),
      }
    })
    setProjects(next)
    if (googleSync.connected) googleSync.syncProjects(next, candidates).catch(console.warn)
  }, [googleSync, candidates, projects])

  const handleAddCandidateToRole = useCallback((projectId, roleId, candidateId) => {
    const next = projects.map((p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        roles: p.roles.map((r) => {
          if (r.id !== roleId) return r
          if (r.selectedCandidates.includes(candidateId)) return r
          const sel = [...r.selectedCandidates, candidateId]
          return { ...r, selectedCandidates: sel, roleStatus: sel.length >= r.required ? 'Filled' : 'In Progress' }
        }),
      }
    })
    setProjects(next)
    if (googleSync.connected) googleSync.syncProjects(next, candidates).catch(console.warn)
  }, [googleSync, candidates, projects])

  const handleRemoveCandidateFromRole = useCallback((projectId, roleId, candidateId) => {
    const next = projects.map((p) => {
      if (p.id !== projectId) return p
      return {
        ...p,
        roles: p.roles.map((r) => {
          if (r.id !== roleId) return r
          const sel = r.selectedCandidates.filter((id) => id !== candidateId)
          return { ...r, selectedCandidates: sel, roleStatus: sel.length >= r.required ? 'Filled' : sel.length > 0 ? 'In Progress' : 'Open' }
        }),
      }
    })
    setProjects(next)
    if (googleSync.connected) googleSync.syncProjects(next, candidates).catch(console.warn)
  }, [googleSync, candidates, projects])

  const handleAddRole = useCallback((projectId, role) => {
    const next = projects.map((p) => p.id !== projectId ? p : { ...p, roles: [...p.roles, role] })
    setProjects(next)
    if (googleSync.connected) googleSync.syncProjects(next, candidates).catch(console.warn)
  }, [googleSync, candidates, projects])

  const handleDeleteRole = useCallback((projectId, roleId) => {
    const next = projects.map((p) => p.id !== projectId ? p : { ...p, roles: p.roles.filter((r) => r.id !== roleId) })
    setProjects(next)
    if (googleSync.connected) googleSync.syncProjects(next, candidates).catch(console.warn)
  }, [googleSync, candidates, projects])

  // ── Interview CRUD + Google Sync ─────────────────────────────────────────────
  const handleAddInterview = useCallback((iv) => {
    setInterviews((prev) => {
      const next = [iv, ...prev]
      if (googleSync.connected) googleSync.syncInterviews(next, candidates).catch(console.warn)
      return next
    })
  }, [googleSync, candidates])

  const handleUpdateInterview = useCallback((id, updates) => {
    setInterviews((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, ...updates } : i))
      if (googleSync.connected) googleSync.syncInterviews(next, candidates).catch(console.warn)
      return next
    })
  }, [googleSync, candidates])

  const handleDeleteInterview = useCallback((id) => {
    setInterviews((prev) => {
      const next = prev.filter((i) => i.id !== id)
      if (googleSync.connected) googleSync.syncInterviews(next, candidates).catch(console.warn)
      return next
    })
  }, [googleSync, candidates])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#0d1117', fontFamily: 'DM Sans, sans-serif' }}>
      <GoogleTopBar
        sync={googleSync}
        candidates={candidates}
        onLoadCandidates={handleLoadCandidates}
        onLoadProjects={handleLoadProjects}
        onLoadInterviews={handleLoadInterviews}
        onLoadDocuments={handleLoadDocuments}
        onMenuClick={() => setSidebarOpen(o => !o)}
        isMobile={isMobile}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 199, backdropFilter: 'blur(2px)' }}
          />
        )}

      <Sidebar
        candidates={candidates}
        interviews={interviews}
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setDrawerCandidate(null); if (isMobile) setSidebarOpen(false) }}
        onCandidateClick={handleOpenDrawer}
        googleSync={googleSync}
        onLoadCandidates={handleLoadCandidates}
        isMobile={isMobile}
        isOpen={isMobile ? sidebarOpen : true}
        onClose={() => setSidebarOpen(false)}
      />

      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', marginLeft: isMobile ? 0 : 0 }}>
        {activeTab === 'dashboard' && (
          <Dashboard
            candidates={candidates}
            interviews={interviews}
            projects={projects}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onAddRole={handleAddRole}
            onDeleteRole={handleDeleteRole}
            onAddCandidateToRole={handleAddCandidateToRole}
            onRemoveCandidateFromRole={handleRemoveCandidateFromRole}
            onNavigateToCandidates={handleNavigateToCandidates}
            onNavigateToInterviews={handleNavigateToInterviews}
          />
        )}

        {activeTab === 'candidates' && (
          <Candidates
            candidates={candidates}
            interviews={interviews}
            onAddCandidate={handleAddCandidate}
            onUpdateCandidate={handleUpdateCandidate}
            onDeleteCandidate={handleDeleteCandidate}
            onAddInterview={handleAddInterview}
            externalFilter={candidateFilter}
            onClearExternalFilter={() => setCandidateFilter({ status: '', category: '' })}
            drawerCandidate={drawerCandidate}
            onOpenDrawer={handleOpenDrawer}
            onCloseDrawer={handleCloseDrawer}
            googleSyncing={googleSync.syncing}
          />
        )}

        {activeTab === 'interviews' && (
          <Interviews
            candidates={candidates}
            interviews={interviews}
            onAddInterview={handleAddInterview}
            onUpdateInterview={handleUpdateInterview}
            onDeleteInterview={handleDeleteInterview}
            onUpdateCandidate={handleUpdateCandidate}
            onCandidateClick={(candidateId) => {
              const c = candidates.find((x) => x.id === candidateId)
              if (c) { setActiveTab('candidates'); handleOpenDrawer(c) }
            }}
          />
        )}

        {activeTab === 'documents' && (
          <Documents
            candidates={candidates}
            documents={documents}
            docChecklist={docChecklist}
            onAddDocument={(doc) => {
              const next = [doc, ...documents]
              setDocuments(next)
              if (googleSync.connected) googleSync.syncDocuments(next, docChecklist).catch(console.warn)
            }}
            onToggleDocCheck={(candidateId, docType, checked) => {
              const next = {
                ...docChecklist,
                [candidateId]: { ...(docChecklist[candidateId] || {}), [docType]: checked },
              }
              setDocChecklist(next)
              if (googleSync.connected) googleSync.syncDocuments(documents, next).catch(console.warn)
            }}
            googleSync={googleSync}
          />
        )}
      </main>
      </div>
    </div>
  )
}
