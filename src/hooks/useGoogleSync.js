import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/apiService'

// Helpers to parse tab rows back into objects ─────────────────────────────────

function parseProjectsFromRows(rows) {
  // Reuse same format as old sheetsService writeProjectTabSafe
  const projects = []
  let cur = null
  for (const row of rows) {
    if (!row[0]) continue
    if (row[0] === 'PROJECT') {
      if (cur) projects.push(cur)
      cur = { id: row[1], title: row[2], client: row[3], deadline: row[4], notes: row[5], roles: [] }
    } else if (row[0] === 'ROLE' && cur) {
      cur.roles.push({
        id: row[1], title: row[2], required: Number(row[3]) || 1,
        roleStatus: row[4], selectedCandidates: row[5] ? row[5].split(',').filter(Boolean) : [],
      })
    }
  }
  if (cur) projects.push(cur)
  return projects
}

function buildProjectRows(project, candMap) {
  const rows = [['PROJECT', project.id, project.title, project.client || '', project.deadline || '', project.notes || '']]
  for (const role of project.roles || []) {
    const names = (role.selectedCandidates || []).map((id) => candMap[id]?.name || id).join(', ')
    rows.push(['ROLE', role.id, role.title, role.required, role.roleStatus, role.selectedCandidates.join(','), names])
  }
  return rows
}

const IV_HEADERS = ['id','candidateId','candidateName','date','time','type','location','status','notes','attendStatus']
function parseInterviewsFromRows(rows) {
  if (rows.length < 2) return []
  return rows.slice(1).filter((r) => r[0]).map((r) => {
    const obj = {}
    IV_HEADERS.forEach((h, i) => { obj[h] = r[i] ?? '' })
    return obj
  })
}
function buildInterviewRows(interviews, candMap) {
  const rows = [IV_HEADERS]
  for (const iv of interviews) {
    const c = candMap[iv.candidateId]
    rows.push(IV_HEADERS.map((h) => h === 'candidateName' ? (c?.name || iv.candidateName || '') : (iv[h] ?? '')))
  }
  return rows
}

function parseDocumentsFromRows(rows) {
  const docs = []; const checklist = {}; let inCheck = false
  for (const row of rows) {
    if (!row[0]) continue
    if (row[0] === '---CHECKLIST---') { inCheck = true; continue }
    if (inCheck) {
      const docId = row[3] || ''
      if (docId.startsWith('CHECK:')) {
        const [, candId, docType] = docId.split(':')
        if (!checklist[candId]) checklist[candId] = {}
        checklist[candId][docType] = row[4] === 'true' || row[4] === true
      }
    } else {
      docs.push({ id: row[0], candidateId: row[1], candidateName: row[2], docId: row[3], docType: row[4], filename: row[5], url: row[6], uploadedAt: row[7] })
    }
  }
  return { docs, checklist }
}
function buildDocumentRows(docs, checklist) {
  const rows = docs.map((d) => [d.id, d.candidateId, d.candidateName, d.docId, d.docType, d.filename, d.url, d.uploadedAt])
  rows.push(['---CHECKLIST---'])
  for (const [candId, types] of Object.entries(checklist)) {
    for (const [docType, checked] of Object.entries(types)) {
      rows.push(['', '', '', `CHECK:${candId}:${docType}`, String(checked)])
    }
  }
  return rows
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useGoogleSync() {
  const [connected, setConnected] = useState(false)
  const [syncing,   setSyncing]   = useState(false)
  const [lastSync,  setLastSync]  = useState(null)
  const [error,     setError]     = useState('')

  // Check backend health on mount → set connected
  useEffect(() => {
    api.health()
      .then(() => setConnected(true))
      .catch(() => setConnected(false))
  }, [])

  const run = useCallback(async (fn) => {
    setSyncing(true); setError('')
    try {
      const result = await fn()
      setLastSync(new Date())
      return result
    } catch (e) {
      setError(e.message)
      return null
    } finally { setSyncing(false) }
  }, [])

  // ── Batch fetch all tabs in one API call ─────────────────────────────────────
  const fetchAll = useCallback(() =>
    run(async () => {
      const res = await api.fetchAll()
      return {
        candidates: res.candidates || [],
        projects:   parseProjectsFromRows(res.projectRows || []),
        interviews: parseInterviewsFromRows(res.interviewRows || []),
        ...parseDocumentsFromRows(res.documentRows || []),
      }
    }), [run])

  // ── Candidates ───────────────────────────────────────────────────────────────
  const fetchCandidates = useCallback(() =>
    run(async () => {
      const { data } = await api.getCandidates()
      return data
    }), [run])

  const exportAll = useCallback((candidates) =>
    run(() => api.bulkSetCandidates(candidates)), [run])

  const syncAdd = useCallback((candidate) =>
    run(async () => {
      await api.addCandidate(candidate)
      return candidate
    }), [run])

  const syncAddMany = useCallback((candidates) =>
    run(async () => {
      const results = []
      for (const cand of candidates) {
        const { _resumeFile, ...clean } = cand
        await api.addCandidate(clean)
        results.push(clean)
      }
      return results
    }), [run])

  const syncUpdate = useCallback((id, full) =>
    run(() => api.updateCandidate(id, full)), [run])

  const syncDelete = useCallback((id) =>
    run(() => api.deleteCandidate(id)), [run])

  // ── Projects ─────────────────────────────────────────────────────────────────
  const fetchProjects = useCallback(() =>
    run(async () => {
      const { data } = await api.readTab('Projects')
      return parseProjectsFromRows(data)
    }), [run])

  const makeCandMap = (arr) => Object.fromEntries((arr || []).map((c) => [c.id, c]))

  const syncAddProject = useCallback((project, candidatesArray) =>
    run(() => {
      const rows = buildProjectRows(project, makeCandMap(candidatesArray))
      return api.writeTab(`project_${project.id}`, rows)
    }), [run])

  const syncUpdateProject = useCallback((project, candidatesArray) =>
    run(() => {
      const rows = buildProjectRows(project, makeCandMap(candidatesArray))
      return api.writeTab(`project_${project.id}`, rows)
    }), [run])

  const syncDeleteProject = useCallback((_projectTitle) =>
    Promise.resolve(), [])   // tab cleanup not critical — skip for now

  // ── Interviews ───────────────────────────────────────────────────────────────
  const fetchInterviews = useCallback(() =>
    run(async () => {
      const { data } = await api.readTab('Interviews')
      return parseInterviewsFromRows(data)
    }), [run])

  const syncInterviews = useCallback((interviews, candidatesArray) =>
    run(() => {
      const rows = buildInterviewRows(interviews, makeCandMap(candidatesArray))
      return api.writeTab('Interviews', rows)
    }), [run])

  // ── Documents ────────────────────────────────────────────────────────────────
  const fetchDocuments = useCallback(() =>
    run(async () => {
      const { data } = await api.readTab('Documents')
      return parseDocumentsFromRows(data)
    }), [run])

  const syncDocuments = useCallback((docs, checklist = {}) =>
    run(() => {
      const rows = buildDocumentRows(docs, checklist)
      return api.writeTab('Documents', rows)
    }), [run])

  return {
    ready: true,
    connected,
    syncing,
    lastSync,
    error,
    hasConfig: true,
    connect:    async () => { const ok = await api.health().then(() => true).catch(() => false); setConnected(ok) },
    disconnect: () => setConnected(false),
    fetchAll, fetchCandidates, exportAll,
    syncAdd, syncAddMany, syncUpdate, syncDelete,
    syncAddProject, syncUpdateProject, syncDeleteProject,
    fetchProjects, fetchInterviews, syncInterviews,
    syncDocuments, fetchDocuments,
  }
}
