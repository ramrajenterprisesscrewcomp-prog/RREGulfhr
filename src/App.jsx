import { useCallback, useEffect, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Candidates from './components/Candidates'
import Interviews from './components/Interviews'
import Documents from './components/Documents'
import { initialCandidates, initialInterviews, initialProjects } from './data/mockData'
import { useGoogleSync } from './hooks/useGoogleSync'
import GoogleTopBar from './components/GoogleTopBar'
export default function App() {
  return <AppMain />
}

function AppMain() {
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

  // ── Auto-load all data on silent reconnect (page refresh with saved token) ───
  const autoLoadDone = useRef(false)
  useEffect(() => {
    if (!googleSync.connected) { autoLoadDone.current = false; return }
    if (autoLoadDone.current) return
    autoLoadDone.current = true
    // Candidates already loaded by GoogleTopBar's handleConnect on explicit connect.
    // This branch fires only for silent auto-reconnect (no button click).
    googleSync.fetchCandidates().then((list) => { if (list?.length) setCandidates(list) }).catch(() => {})
    googleSync.fetchProjects().then((p)     => { if (p?.length)    setProjects(p)    }).catch(() => {})
    googleSync.fetchInterviews().then((ivs) => { if (ivs?.length)  setInterviews(ivs)}).catch(() => {})
    googleSync.fetchDocuments().then((result) => {
      if (!result) return
      if (result.docs?.length)      setDocuments(result.docs)
      if (result.checklist && Object.keys(result.checklist).length) setDocChecklist(result.checklist)
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
    // Strip the _resumeFile helper property before storing in state
    const { _resumeFile, ...clean } = candidate
    const actualFile = file || _resumeFile || null

    // Add to local state immediately so UI is instant
    setCandidates((prev) => [clean, ...prev])

    // Background sync: append to Sheets + upload resume to Drive
    if (googleSync.connected) {
      googleSync.syncAdd(clean, actualFile).then((synced) => {
        // If Drive upload gave us a real URL, update the candidate in state
        if (synced.resume_url && synced.resume_url !== clean.resume_url) {
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
    setProjects((prev) => [project, ...prev])
    if (googleSync.connected) {
      googleSync.syncAddProject(project, candidates).catch(console.warn)
    }
  }, [googleSync, candidates])

  const handleUpdateProject = useCallback((projectId, roleId, updates) => {
    let updatedProject = null
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      updatedProject = {
        ...p,
        roles: roleId
          ? p.roles.map((r) => (r.id === roleId ? { ...r, ...updates } : r))
          : p.roles,
        ...(roleId ? {} : updates),
      }
      return updatedProject
    }))
    if (googleSync.connected && updatedProject) {
      googleSync.syncUpdateProject(updatedProject, candidates).catch(console.warn)
    }
  }, [googleSync, candidates])

  const handleAddCandidateToRole = useCallback((projectId, roleId, candidateId) => {
    let updatedProject = null
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      updatedProject = {
        ...p,
        roles: p.roles.map((r) => {
          if (r.id !== roleId) return r
          if (r.selectedCandidates.includes(candidateId)) return r
          const next = [...r.selectedCandidates, candidateId]
          const roleStatus = next.length >= r.required ? 'Filled' : next.length > 0 ? 'In Progress' : 'Open'
          return { ...r, selectedCandidates: next, roleStatus }
        }),
      }
      return updatedProject
    }))
    if (googleSync.connected && updatedProject) {
      googleSync.syncUpdateProject(updatedProject, candidates).catch(console.warn)
    }
  }, [googleSync, candidates])

  const handleRemoveCandidateFromRole = useCallback((projectId, roleId, candidateId) => {
    let updatedProject = null
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      updatedProject = {
        ...p,
        roles: p.roles.map((r) => {
          if (r.id !== roleId) return r
          const next = r.selectedCandidates.filter((id) => id !== candidateId)
          const roleStatus = next.length >= r.required ? 'Filled' : next.length > 0 ? 'In Progress' : 'Open'
          return { ...r, selectedCandidates: next, roleStatus }
        }),
      }
      return updatedProject
    }))
    if (googleSync.connected && updatedProject) {
      googleSync.syncUpdateProject(updatedProject, candidates).catch(console.warn)
    }
  }, [googleSync, candidates])

  const handleAddRole = useCallback((projectId, role) => {
    let updatedProject = null
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      updatedProject = { ...p, roles: [...p.roles, role] }
      return updatedProject
    }))
    if (googleSync.connected && updatedProject) {
      googleSync.syncUpdateProject(updatedProject, candidates).catch(console.warn)
    }
  }, [googleSync, candidates])

  const handleDeleteRole = useCallback((projectId, roleId) => {
    let updatedProject = null
    setProjects((prev) => prev.map((p) => {
      if (p.id !== projectId) return p
      updatedProject = { ...p, roles: p.roles.filter((r) => r.id !== roleId) }
      return updatedProject
    }))
    if (googleSync.connected && updatedProject) {
      googleSync.syncUpdateProject(updatedProject, candidates).catch(console.warn)
    }
  }, [googleSync, candidates])

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
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <Sidebar
        candidates={candidates}
        interviews={interviews}
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); setDrawerCandidate(null) }}
        onCandidateClick={handleOpenDrawer}
        googleSync={googleSync}
        onLoadCandidates={handleLoadCandidates}
      />

      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
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
