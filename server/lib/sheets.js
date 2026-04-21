const { getSheetsClient } = require('./auth')

const SHEET_ID     = process.env.GOOGLE_SHEET_ID
const CAND_SHEET   = 'Candidates'
const DATA_ROW     = 3   // row where data starts (row 1=title, row 2=headers)

const HEADERS = [
  'id','name','phone','email','role','experience','education',
  'location','nationality','category','status','date_added',
  'resume_url','docs_complete','notes',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToObj(row) {
  const obj = {}
  HEADERS.forEach((h, i) => { obj[h] = row[i] ?? '' })
  obj.docs_complete = obj.docs_complete === 'true' || obj.docs_complete === true
  return obj
}

function objToRow(obj) {
  return HEADERS.map((h) => {
    const v = obj[h]
    if (v === undefined || v === null) return ''
    return String(v)
  })
}

async function ensureSheet() {
  const sheets = await getSheetsClient()
  // Check if Candidates sheet exists; create if not
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const exists = meta.data.sheets.some((s) => s.properties.title === CAND_SHEET)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: CAND_SHEET } } }],
      },
    })
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${CAND_SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['RRE HR — Candidate Database'], HEADERS] },
    })
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getCandidates() {
  const sheets = await getSheetsClient()
  await ensureSheet()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${CAND_SHEET}!A${DATA_ROW}:O`,
  })
  return (res.data.values || []).filter((r) => r[0]).map(rowToObj)
}

async function addCandidate(candidate) {
  const sheets = await getSheetsClient()
  await ensureSheet()
  const row = objToRow(candidate)
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${CAND_SHEET}!A${DATA_ROW}`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
  return candidate
}

async function updateCandidate(id, data) {
  const sheets = await getSheetsClient()
  const all = await getCandidates()
  const idx = all.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error(`Candidate ${id} not found`)
  const rowNum = idx + DATA_ROW
  const merged = { ...all[idx], ...data }
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${CAND_SHEET}!A${rowNum}:O${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [objToRow(merged)] },
  })
  return merged
}

async function deleteCandidate(id) {
  const sheets = await getSheetsClient()
  const all = await getCandidates()
  const idx = all.findIndex((c) => c.id === id)
  if (idx === -1) throw new Error(`Candidate ${id} not found`)
  const rowNum = idx + DATA_ROW

  // Get sheetId for the Candidates tab
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const sheetMeta = meta.data.sheets.find((s) => s.properties.title === CAND_SHEET)
  const sheetGid = sheetMeta.properties.sheetId

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: { sheetId: sheetGid, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
        },
      }],
    },
  })
}

async function bulkSetCandidates(candidates) {
  const sheets = await getSheetsClient()
  await ensureSheet()
  // Clear existing data rows
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${CAND_SHEET}!A${DATA_ROW}:O`,
  })
  if (candidates.length === 0) return
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${CAND_SHEET}!A${DATA_ROW}`,
    valueInputOption: 'RAW',
    requestBody: { values: candidates.map(objToRow) },
  })
}

// ── Generic tab read/write for projects, interviews, documents ────────────────

async function readTab(tabName) {
  const sheets = await getSheetsClient()
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1:ZZ`,
    })
    return res.data.values || []
  } catch {
    return []
  }
}

async function writeTab(tabName, rows) {
  const sheets = await getSheetsClient()
  // Ensure tab exists
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const exists = meta.data.sheets.some((s) => s.properties.title === tabName)
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: tabName } } }] },
    })
  }
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: `${tabName}!A1:ZZ` })
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    })
  }
}

module.exports = { getCandidates, addCandidate, updateCandidate, deleteCandidate, bulkSetCandidates, readTab, writeTab }
