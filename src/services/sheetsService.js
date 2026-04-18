import { getToken } from './googleAuth'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

// ── Column order matches the user's Google Sheet exactly ─────────────────────
// Visible columns A-K match existing headers; internal fields go in L-O
const COLS = [
  'date_added',    // A  Timestamp
  'name',          // B  Name
  'phone',         // C  Contact Number
  'email',         // D  Email ID
  'role',          // E  Role
  'experience',    // F  Experience
  'education',     // G  Education
  'nationality',   // H  Nationality
  'location',      // I  Location
  'notes',         // J  Short Notes
  'resume_url',    // K  Resume
  'id',            // L  ID  (internal — used for row tracking)
  'category',      // M  Category
  'status',        // N  Status
  'docs_complete', // O  Docs Complete
]

// Human-readable header row written to row 1 of the sheet
const HEADERS = [
  'Timestamp', 'Name', 'Contact Number', 'Email ID', 'Role',
  'Experience', 'Education', 'Nationality', 'Location', 'Short Notes',
  'Resume', 'ID', 'Category', 'Status', 'Docs Complete',
]

// Data starts at row 3 (row 1 = headers, row 2 = blank spacer)
const DATA_START_ROW = 3

let cachedTabId = null   // internal sheetId (gid) of the first tab

function toRow(c) {
  return COLS.map((k) => {
    const v = c[k]
    if (v == null) return ''
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
    return String(v)
  })
}

function fromRow(row) {
  const obj = {}
  COLS.forEach((k, i) => {
    const v = row[i] ?? ''
    obj[k] = k === 'docs_complete' ? v === 'TRUE' : v
  })
  return obj
}

async function req(sheetId, path, opts = {}) {
  const token = getToken()
  if (!token) throw new Error('Not authenticated with Google')
  const res = await fetch(`${BASE}/${sheetId}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `Sheets API ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

// Get the internal tab sheetId (gid) — cached after first call
async function getTabId(sheetId) {
  if (cachedTabId !== null) return cachedTabId
  const meta = await req(sheetId, '?fields=sheets.properties')
  cachedTabId = meta?.sheets?.[0]?.properties?.sheetId ?? 0
  return cachedTabId
}

// ── Init: write header row if not present ─────────────────────────────────────
export async function initSheet(sheetId) {
  const data = await req(sheetId, '/values/A1:A1')
  if (data?.values?.[0]?.[0] !== 'Timestamp') {
    await req(sheetId, '/values/A1:O1?valueInputOption=RAW', {
      method: 'PUT',
      body: JSON.stringify({ values: [HEADERS] }),
    })
  }
}

// ── Load all candidates from sheet (row 3 onwards) ────────────────────────────
export async function loadCandidates(sheetId) {
  await initSheet(sheetId)
  const data = await req(sheetId, `/values/A${DATA_START_ROW}:O`)
  return (data?.values || []).map(fromRow).filter((r) => r.id)
}

// ── Insert a single candidate at the TOP of data (row 3) ─────────────────────
// Pushes all existing rows down by 1.
export async function insertAtTop(sheetId, candidate) {
  const tabId = await getTabId(sheetId)
  // Insert a blank row at index 2 (0-based = row 3, 1-based)
  await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        insertDimension: {
          range: { sheetId: tabId, dimension: 'ROWS', startIndex: 2, endIndex: 3 },
          inheritFromBefore: false,
        },
      }],
    }),
  })
  // Write candidate data to row 3
  await req(sheetId, `/values/A${DATA_START_ROW}:O${DATA_START_ROW}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [toRow(candidate)] }),
  })
}

// ── Insert many candidates at the TOP (bulk) ──────────────────────────────────
// Inserts N rows at once then writes all data — most recent (index 0) at row 3.
export async function insertManyAtTop(sheetId, candidates) {
  if (!candidates.length) return
  const tabId = await getTabId(sheetId)
  const n = candidates.length
  // Insert N blank rows starting at index 2 (0-based)
  await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        insertDimension: {
          range: { sheetId: tabId, dimension: 'ROWS', startIndex: 2, endIndex: 2 + n },
          inheritFromBefore: false,
        },
      }],
    }),
  })
  // Write all candidates starting at row 3
  await req(sheetId, `/values/A${DATA_START_ROW}:O${DATA_START_ROW + n - 1}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: candidates.map(toRow) }),
  })
}

// ── Update a specific row ─────────────────────────────────────────────────────
export async function updateRow(sheetId, rowNum, candidate) {
  await req(sheetId, `/values/A${rowNum}:O${rowNum}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [toRow(candidate)] }),
  })
}

// ── Delete a specific row ─────────────────────────────────────────────────────
export async function deleteRow(sheetId, rowNum) {
  const tabId = await getTabId(sheetId)
  await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: tabId, dimension: 'ROWS',
            startIndex: rowNum - 1,   // 0-based
            endIndex: rowNum,
          },
        },
      }],
    }),
  })
}

// ── Find a candidate's row number by ID (searches column L) ──────────────────
export async function findRow(sheetId, candidateId) {
  const data = await req(sheetId, '/values/L:L')   // ID is in column L
  const rows = data?.values || []
  const idx  = rows.findIndex((r) => r[0] === candidateId)
  return idx === -1 ? -1 : idx + 1   // 1-based
}

// ── Initial export: write all candidates starting at row 3 ───────────────────
export async function pushAll(sheetId, candidates) {
  await initSheet(sheetId)
  if (!candidates.length) return
  const lastRow = DATA_START_ROW + candidates.length - 1
  await req(sheetId, `/values/A${DATA_START_ROW}:O${lastRow}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: candidates.map(toRow) }),
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// PROJECT TAB FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

function sanitizeTabTitle(title) {
  // Remove characters forbidden in Google Sheets tab names
  return (title || 'Project').replace(/[\[\]\*\?\/\\:]/g, '').trim().slice(0, 100) || 'Project'
}

// Get internal sheetId (gid) of a tab by its title; returns null if not found
async function getTabIdByTitle(sheetId, title) {
  const meta = await req(sheetId, '?fields=sheets.properties')
  const sheet = meta?.sheets?.find((s) => s.properties.title === title)
  return sheet?.properties?.sheetId ?? null
}

// ── Create a new tab for a project ───────────────────────────────────────────
export async function createProjectTab(sheetId, title) {
  const safeTitle = sanitizeTabTitle(title)
  // Check if tab already exists
  const existing = await getTabIdByTitle(sheetId, safeTitle)
  if (existing !== null) return existing

  const res = await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: safeTitle } } }],
    }),
  })
  return res?.replies?.[0]?.addSheet?.properties?.sheetId ?? null
}

// ── Write project tab with all current data (includes IDs for round-trip read) ─
export async function writeProjectTabSafe(sheetId, project, candidateMap) {
  const safeTitle = sanitizeTabTitle(project.title)

  // Ensure tab exists
  let tabGid = await getTabIdByTitle(sheetId, safeTitle)
  if (tabGid === null) {
    tabGid = await createProjectTab(sheetId, project.title)
  }

  const totalRequired = project.roles.reduce((s, r) => s + (r.required || 0), 0)
  const totalFilled   = project.roles.reduce((s, r) => s + Math.min((r.selectedCandidates || []).length, r.required || 0), 0)
  const overallPct    = totalRequired > 0 ? Math.round((totalFilled / totalRequired) * 100) : 0

  // Row 1: machine-readable marker + display info (A1 = PROJECT:[id] for detection on read)
  const rows = [
    [`PROJECT:${project.id}`, project.title, `CLIENT:${project.client || ''}`, `STATUS:${project.status || ''}`, `OVERALL:${overallPct}%`],
    [''],
    ['S.No', 'Job Title', 'Salary', 'Required', 'Filled', 'Progress %', 'Selected Candidates', 'Role Status', 'Role ID', 'Candidate IDs'],
    ...(project.roles || []).map((role, i) => {
      const filled     = Math.min((role.selectedCandidates || []).length, role.required || 0)
      const rolePct    = role.required > 0 ? Math.round((filled / role.required) * 100) : 0
      const names      = (role.selectedCandidates || []).map((id) => candidateMap[id]?.name || id).join(', ')
      const candIds    = (role.selectedCandidates || []).join(',')
      return [i + 1, role.jobTitle || '', role.salary || '', role.required || 0, filled, `${rolePct}%`, names, role.roleStatus || 'Open', role.id || '', candIds]
    }),
  ]

  await req(sheetId, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [{ range: `'${safeTitle}'!A1:J${rows.length}`, values: rows }],
    }),
  })
}

// ── Read all projects back from their tabs ────────────────────────────────────
export async function readProjectsFromSheet(sheetId) {
  const meta    = await req(sheetId, '?fields=sheets.properties')
  const allTabs = meta?.sheets || []
  const skipLower = ['candidate data', 'interview schedule', 'documents']

  const projects = []
  for (const tab of allTabs) {
    const tabTitle = tab.properties.title
    if (skipLower.includes(tabTitle.toLowerCase())) continue

    try {
      const range = encodeURIComponent(`'${tabTitle}'!A1:J100`)
      const data  = await req(sheetId, `/values/${range}`)
      const rows  = data?.values || []
      if (!rows.length) continue

      const a1 = rows[0]?.[0] || ''
      if (!a1.startsWith('PROJECT:')) continue   // not a project tab

      const projectId = a1.slice('PROJECT:'.length).trim()
      const title     = rows[0][1] || tabTitle
      const client    = (rows[0][2] || '').replace('CLIENT:', '').trim()
      const status    = (rows[0][3] || '').replace('STATUS:', '').trim()

      const roles = []
      // rows[0]=info, rows[1]=blank, rows[2]=headers, rows[3+]=role data
      for (let i = 3; i < rows.length; i++) {
        const r   = rows[i]
        if (!r?.[0] || r[0] === 'S.No') continue
        if (isNaN(parseInt(r[0]))) continue
        const roleId      = r[8] || `r_${projectId}_${i}`
        const candidateIds = r[9] ? r[9].split(',').map((s) => s.trim()).filter(Boolean) : []
        const required    = parseInt(r[3]) || 0
        const filled      = Math.min(candidateIds.length, required)
        const roleStatus  = r[7] || (filled >= required && required > 0 ? 'Filled' : filled > 0 ? 'In Progress' : 'Open')
        roles.push({ id: roleId, jobTitle: r[1] || '', salary: r[2] || '', required, roleStatus, selectedCandidates: candidateIds })
      }

      projects.push({ id: projectId, title, client, status, roles })
    } catch (e) {
      console.warn(`[Sheets] skip tab "${tabTitle}":`, e.message)
    }
  }
  return projects
}

// ══════════════════════════════════════════════════════════════════════════════
// INTERVIEW SCHEDULE TAB
// ══════════════════════════════════════════════════════════════════════════════

const INTERVIEW_TAB = 'Interview schedule'

// Ensure the interview tab exists; finds it case-insensitively, creates if missing
async function ensureInterviewTab(sheetId) {
  const meta = await req(sheetId, '?fields=sheets.properties')
  const found = meta?.sheets?.find(
    (s) => s.properties.title.toLowerCase() === INTERVIEW_TAB.toLowerCase()
  )
  if (found) return  // already exists (any casing)
  await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: INTERVIEW_TAB } } }],
    }),
  })
}

// Resolve the actual tab title (handles casing differences)
async function resolveInterviewTabTitle(sheetId) {
  const meta = await req(sheetId, '?fields=sheets.properties')
  const found = meta?.sheets?.find(
    (s) => s.properties.title.toLowerCase() === INTERVIEW_TAB.toLowerCase()
  )
  return found?.properties?.title ?? INTERVIEW_TAB
}

// ── Write all interviews to "Interview schedule" tab (includes IDs for read-back) ─
export async function writeInterviewsTab(sheetId, interviews, candidateMap) {
  await ensureInterviewTab(sheetId)
  const tabTitle = await resolveInterviewTabTitle(sheetId)

  const rows = []
  // Col headers — col I holds the ID
  rows.push(['S.No', 'Interview Title', 'Type', 'Date', 'Time', 'Interviewer', 'Status', 'Notes', 'ID'])
  rows.push(['', 'Candidates →', 'Candidate Name', 'Attend Status', '', '', '', '', 'Cand ID'])

  let sno = 1
  for (const iv of interviews) {
    // Interview row — col I = interview id
    rows.push([sno++, iv.title || '', iv.type || '', iv.date || '', iv.time || '', iv.interviewer || '', iv.status || '', iv.notes || '', iv.id || ''])
    // Candidate rows — col B = '→' marker, col I = candidate id
    const cands = iv.candidates || []
    if (cands.length === 0) {
      rows.push(['', '→', '— No candidates assigned —', '', '', '', '', '', ''])
    } else {
      for (const c of cands) {
        const name = candidateMap[c.id]?.name || c.id
        rows.push(['', '→', name, c.attendStatus || '', '', '', '', '', c.id || ''])
      }
    }
    rows.push(['', '', '', '', '', '', '', '', ''])  // blank separator
  }

  if (rows.length === 2) {
    rows.push(['', '', '— No interviews scheduled —', '', '', '', '', '', ''])
  }

  await req(sheetId, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [{ range: `'${tabTitle}'!A1:I${rows.length + 10}`, values: rows }],
    }),
  })
}

// ── Read all interviews back from the Interview schedule tab ──────────────────
export async function readInterviewsFromSheet(sheetId) {
  const meta  = await req(sheetId, '?fields=sheets.properties')
  const found = meta?.sheets?.find((s) => s.properties.title.toLowerCase() === INTERVIEW_TAB.toLowerCase())
  if (!found) return []

  const tabTitle = found.properties.title
  const range    = encodeURIComponent(`'${tabTitle}'!A1:I500`)
  const data     = await req(sheetId, `/values/${range}`)
  const rows     = data?.values || []

  const interviews = []
  let current = null

  for (const row of rows) {
    const colA = row[0] ?? ''
    const colB = row[1] ?? ''
    const colI = row[8] ?? ''

    if (colA === 'S.No' || colB === 'Candidates →') continue  // header rows

    if (colB === '→') {
      // Candidate row under current interview
      if (current && colI) {
        current.candidates.push({ id: colI, attendStatus: row[3] || 'Shortlist' })
      }
    } else if (colA !== '' && !isNaN(parseInt(colA)) && parseInt(colA) > 0 && colI) {
      // Interview row
      if (current) interviews.push(current)
      current = {
        id:          colI,
        title:       row[1] || '',
        type:        row[2] || '',
        date:        row[3] || '',
        time:        row[4] || '',
        interviewer: row[5] || '',
        status:      row[6] || 'Scheduled',
        notes:       row[7] || '',
        candidates:  [],
      }
    }
    // else: blank separator — skip
  }
  if (current) interviews.push(current)
  return interviews
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════

const DOCS_TAB = 'Documents'
const DOCS_HEADERS = ['Date', 'Candidate', 'Candidate ID', 'Doc Type', 'File Name', 'Condition', 'Drive URL', 'Doc ID']

async function ensureDocsTab(sheetId) {
  const existing = await getTabIdByTitle(sheetId, DOCS_TAB)
  if (existing !== null) return
  await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: DOCS_TAB } } }] }),
  })
}

// ── Write all documents + checklist to the "Documents" tab (full overwrite) ───
// checklist: { [candidateId]: { [docType]: boolean } }
export async function writeDocumentsTab(sheetId, documents, checklist = {}) {
  await ensureDocsTab(sheetId)
  const rows = [DOCS_HEADERS]
  for (const d of documents) {
    rows.push([
      d.createDate    || '',
      d.candidateName || '',
      d.candidateId   || '',
      d.docType       || '',
      d.fileName      || '',
      d.condition     || '',
      d.fileUrl       || '',
      String(d.id     || ''),
    ])
  }
  // Checklist section separator
  rows.push(['', '', '', '', '', '', '', ''])
  rows.push(['---CHECKLIST---', '', '', '', '', '', '', ''])
  rows.push(['Candidate Name', 'Candidate ID', 'Doc Type', 'Checked', '', '', '', ''])
  for (const [candId, checks] of Object.entries(checklist)) {
    for (const [docType, checked] of Object.entries(checks)) {
      rows.push([
        '',                       // leave name blank — looked up on read
        candId,
        docType,
        checked ? 'TRUE' : 'FALSE',
        '', '', '',
        `CHECK:${candId}:${docType}`,  // special ID so we can identify on read
      ])
    }
  }
  await req(sheetId, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [{ range: `'${DOCS_TAB}'!A1:H${Math.max(rows.length + 5, 20)}`, values: rows }],
    }),
  })
}

// ── Read documents + checklist from the "Documents" tab ─────────────────────
// Returns { docs: [], checklist: {} }
export async function readDocumentsFromSheet(sheetId) {
  const meta  = await req(sheetId, '?fields=sheets.properties')
  const found = meta?.sheets?.find((s) => s.properties.title === DOCS_TAB)
  if (!found) return { docs: [], checklist: {} }
  const range = encodeURIComponent(`'${DOCS_TAB}'!A2:H2000`)
  const data  = await req(sheetId, `/values/${range}`)
  const docs = []
  const checklist = {}
  for (const r of (data?.values || [])) {
    const id = r[7] || ''
    if (!id) continue
    if (id.startsWith('CHECK:')) {
      // Checklist row: r[1]=candId, r[2]=docType, r[3]=checked
      const candId  = r[1] || ''
      const docType = r[2] || ''
      const checked = r[3] === 'TRUE'
      if (candId && docType) {
        if (!checklist[candId]) checklist[candId] = {}
        checklist[candId][docType] = checked
      }
    } else if (id !== '---CHECKLIST---') {
      docs.push({
        createDate:    r[0] || '',
        candidateName: r[1] || '',
        candidateId:   r[2] || '',
        docType:       r[3] || '',
        fileName:      r[4] || '',
        condition:     r[5] || '',
        fileUrl:       r[6] || '',
        id,
        driveUploaded: Boolean(r[6]?.includes('drive.google.com')),
      })
    }
  }
  return { docs, checklist }
}

// ── Delete a project's tab ─────────────────────────────────────────────────
export async function deleteProjectTab(sheetId, title) {
  const safeTitle = sanitizeTabTitle(title)
  const tabGid = await getTabIdByTitle(sheetId, safeTitle)
  if (tabGid === null) return  // already gone

  await req(sheetId, ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ deleteSheet: { sheetId: tabGid } }],
    }),
  })
}
