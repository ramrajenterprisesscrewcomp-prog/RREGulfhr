import { useState, useEffect, useCallback, useRef } from 'react'
import { initGoogleAuth, requestToken, revokeToken, isConnected, getToken, wasConnected } from '../services/googleAuth'
import {
  loadCandidates, insertAtTop, insertManyAtTop, updateRow, deleteRow, findRow, pushAll,
  createProjectTab, writeProjectTabSafe, deleteProjectTab, readProjectsFromSheet,
  writeInterviewsTab, readInterviewsFromSheet,
  writeDocumentsTab, readDocumentsFromSheet,
} from '../services/sheetsService'
import { uploadToDrive } from '../services/driveService'

const SHEET_ID  = import.meta.env.VITE_GOOGLE_SHEET_ID
const FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || null

export function useGoogleSync() {
  const [ready,     setReady]     = useState(false)
  // Start as connected if sessionStorage already has a valid token (survives refresh)
  const [connected, setConnected] = useState(isConnected)
  const [syncing,   setSyncing]   = useState(false)
  const [lastSync,  setLastSync]  = useState(null)
  const [error,     setError]     = useState('')

  const rowMap = useRef({})  // candidateId → 1-based sheet row number

  // ── Load Google Identity Services script + auto-reconnect if previously used ──
  useEffect(() => {
    const onReady = () => {
      initGoogleAuth()
      setReady(true)
      // If user connected before and sessionStorage token is gone (new browser session),
      // attempt a silent token request — no popup, just works if Google session is active.
      if (!isConnected() && wasConnected()) {
        requestToken(true).catch(() => {})   // silent: fail quietly, show Connect button
      }
    }
    if (window.google?.accounts?.oauth2) { onReady(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = onReady
    document.head.appendChild(s)
  }, [])

  // ── Auto-trigger connect (no popup) after GIS is ready ───────────────────────
  useEffect(() => {
    if (!ready || connected || !wasConnected()) return
    // Short delay so tokenClient is fully initialised
    const t = setTimeout(() => {
      requestToken(true).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [ready])

  // ── Listen for auth changes (login / logout events) ──────────────────────────
  useEffect(() => {
    const handler = (e) => {
      setConnected(e.detail)
      if (!e.detail) rowMap.current = {}
    }
    window.addEventListener('gauth', handler)
    return () => window.removeEventListener('gauth', handler)
  }, [])

  // ── When connected, rebuild rowMap from sheet so updates always hit the right row ──
  useEffect(() => {
    if (!connected || !SHEET_ID) return
    loadCandidates(SHEET_ID)
      .then((list) => {
        const map = {}
        list.forEach((c, i) => { map[c.id] = i + 3 })   // row 3 = DATA_START_ROW
        rowMap.current = map
      })
      .catch(() => {})  // silent — rowMap stays empty, findRow used as fallback
  }, [connected])

  // ── Watch for token expiry while app is open (check every 30 s) ──────────────
  useEffect(() => {
    if (!connected) return
    const id = setInterval(() => {
      if (!getToken()) {
        // Token expired — try silent refresh first, fall back to Connect button
        requestToken(true).catch(() => setConnected(false))
      }
    }, 30_000)
    return () => clearInterval(id)
  }, [connected])

  // ── Public: sign in (always triggered by a user click → popup allowed) ───────
  const connect = useCallback(async () => {
    setError('')
    try {
      await requestToken(false)   // false = show full consent if needed
    } catch (e) {
      setError(e.message)
      throw e
    }
  }, [])

  const disconnect = useCallback(() => {
    revokeToken()
    rowMap.current = {}
  }, [])

  // ── Fetch all candidates from sheet ─────────────────────────────────────────
  const fetchCandidates = useCallback(async () => {
    if (!SHEET_ID) return null
    setSyncing(true); setError('')
    try {
      const list = await loadCandidates(SHEET_ID)
      rowMap.current = {}
      list.forEach((c, i) => { rowMap.current[c.id] = i + 3 })  // data starts at row 3
      setLastSync(new Date())
      return list
    } catch (e) { setError(e.message); return null }
    finally { setSyncing(false) }
  }, [])

  // ── Export local candidates to sheet (first-time push) ───────────────────────
  const exportAll = useCallback(async (candidates) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      await pushAll(SHEET_ID, candidates)
      rowMap.current = {}
      candidates.forEach((c, i) => { rowMap.current[c.id] = i + 3 })  // data starts at row 3
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [])

  const getRow = useCallback(async (id) => {
    let row = rowMap.current[id]
    if (!row && SHEET_ID) {
      row = await findRow(SHEET_ID, id)
      if (row > 0) rowMap.current[id] = row
    }
    return row || -1
  }, [])

  // ── Sync add: upload resume to Drive → insert row at TOP of sheet ──────────
  const syncAdd = useCallback(async (candidate, file) => {
    if (!SHEET_ID) return candidate
    setSyncing(true); setError('')
    try {
      let final = { ...candidate }
      if (file) {
        try { final.resume_url = await uploadToDrive(file, FOLDER_ID, final.role) }
        catch (e) { setError(`Resume upload failed: ${e.message}`) }
      }
      // Insert at top — all existing rows shift down by 1
      await insertAtTop(SHEET_ID, final)
      for (const k of Object.keys(rowMap.current)) rowMap.current[k]++
      rowMap.current[final.id] = 3   // new row is always row 3 (top of data)
      setLastSync(new Date())
      return final
    } catch (e) { setError(e.message); return candidate }
    finally { setSyncing(false) }
  }, [])

  // ── Sync add many: bulk Drive uploads → insert all at TOP of sheet ──────────
  const syncAddMany = useCallback(async (candidates) => {
    if (!SHEET_ID) return candidates
    setSyncing(true); setError('')
    const results = []
    try {
      // Upload all resumes to Drive first
      for (const cand of candidates) {
        const { _resumeFile, ...clean } = cand
        let final = { ...clean }
        if (_resumeFile) {
          try { final.resume_url = await uploadToDrive(_resumeFile, FOLDER_ID, final.role) }
          catch (e) { setError(`Resume upload failed for ${clean.name}: ${e.message}`) }
        }
        results.push(final)
        await new Promise((r) => setTimeout(r, 150))
      }
      // Insert all at top in one batch operation (most recent = row 3)
      await insertManyAtTop(SHEET_ID, results)
      // Shift existing cache entries down by results.length
      for (const k of Object.keys(rowMap.current)) rowMap.current[k] += results.length
      // New rows start at row 3
      results.forEach((c, i) => { rowMap.current[c.id] = 3 + i })
      setLastSync(new Date())
      return results
    } catch (e) { setError(e.message); return results.length ? results : candidates }
    finally { setSyncing(false) }
  }, [])

  // ── Sync update ──────────────────────────────────────────────────────────────
  const syncUpdate = useCallback(async (id, full) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      const row = await getRow(id)
      if (row > 0) await updateRow(SHEET_ID, row, full)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [getRow])

  // ── Sync delete ──────────────────────────────────────────────────────────────
  const syncDelete = useCallback(async (id) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      const row = await getRow(id)
      if (row > 0) {
        await deleteRow(SHEET_ID, row)
        delete rowMap.current[id]
        for (const k of Object.keys(rowMap.current)) {
          if (rowMap.current[k] > row) rowMap.current[k]--
        }
      }
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [getRow])

  // ── Build a id→candidate lookup map from current candidates array ───────────
  // candidatesArray is passed in by App.jsx at call time so it's always fresh
  const makeCandMap = (candidatesArray) =>
    Object.fromEntries((candidatesArray || []).map((c) => [c.id, c]))

  // ── Sync add project: create tab + write data ────────────────────────────────
  const syncAddProject = useCallback(async (project, candidatesArray) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      await createProjectTab(SHEET_ID, project.title)
      await writeProjectTabSafe(SHEET_ID, project, makeCandMap(candidatesArray))
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [])

  // ── Sync update project: rewrite tab with latest state ──────────────────────
  const syncUpdateProject = useCallback(async (project, candidatesArray) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      await writeProjectTabSafe(SHEET_ID, project, makeCandMap(candidatesArray))
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [])

  // ── Sync delete project: remove tab ─────────────────────────────────────────
  const syncDeleteProject = useCallback(async (projectTitle) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      await deleteProjectTab(SHEET_ID, projectTitle)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [])

  // ── Fetch all projects from their sheet tabs ─────────────────────────────────
  const fetchProjects = useCallback(async () => {
    if (!SHEET_ID) return null
    setSyncing(true); setError('')
    try {
      const list = await readProjectsFromSheet(SHEET_ID)
      setLastSync(new Date())
      return list
    } catch (e) { setError(e.message); return null }
    finally { setSyncing(false) }
  }, [])

  // ── Fetch all interviews from the Interview schedule tab ─────────────────────
  const fetchInterviews = useCallback(async () => {
    if (!SHEET_ID) return null
    setSyncing(true); setError('')
    try {
      const list = await readInterviewsFromSheet(SHEET_ID)
      setLastSync(new Date())
      return list
    } catch (e) { setError(e.message); return null }
    finally { setSyncing(false) }
  }, [])

  // ── Sync interviews: rewrite the entire Interview Schedule tab ───────────────
  const syncInterviews = useCallback(async (interviewsArray, candidatesArray) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      await writeInterviewsTab(SHEET_ID, interviewsArray, makeCandMap(candidatesArray))
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [])

  // ── Sync documents: rewrite the Documents tab (docs + checklist) ─────────
  const syncDocuments = useCallback(async (docsArray, checklist = {}) => {
    if (!SHEET_ID) return
    setSyncing(true); setError('')
    try {
      await writeDocumentsTab(SHEET_ID, docsArray, checklist)
      setLastSync(new Date())
    } catch (e) { setError(e.message) }
    finally { setSyncing(false) }
  }, [])

  // ── Fetch documents + checklist from the Documents tab ───────────────────
  const fetchDocuments = useCallback(async () => {
    if (!SHEET_ID) return null
    setSyncing(true); setError('')
    try {
      const result = await readDocumentsFromSheet(SHEET_ID)
      setLastSync(new Date())
      return result   // { docs, checklist }
    } catch (e) { setError(e.message); return null }
    finally { setSyncing(false) }
  }, [])

  return {
    ready, connected, syncing, lastSync, error,
    hasConfig: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID && SHEET_ID),
    wasConnected,
    connect, disconnect, fetchCandidates, exportAll,
    syncAdd, syncAddMany, syncUpdate, syncDelete,
    syncAddProject, syncUpdateProject, syncDeleteProject,
    fetchProjects, fetchInterviews, syncInterviews,
    syncDocuments, fetchDocuments,
  }
}
