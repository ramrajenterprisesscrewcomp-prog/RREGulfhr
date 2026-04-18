import { getToken } from './googleAuth'

const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const API    = 'https://www.googleapis.com/drive/v3/files'

// Cache: roleName → folderId  (avoids repeated Drive searches per session)
const folderCache = {}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

async function doUpload(token, meta, mimeType, base64) {
  const boundary = 'rre_hr_' + Date.now()
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    base64,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body,
  })

  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `Drive upload ${res.status}`)
  }
  return res.json()
}

// ── Find or create a subfolder by name inside parentId ───────────────────────
async function getOrCreateFolder(token, parentId, name) {
  const cacheKey = `${parentId}::${name}`
  if (folderCache[cacheKey]) return folderCache[cacheKey]

  // Search for existing folder
  const q = `name = '${name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`
  const searchRes = await fetch(
    `${API}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (searchRes.ok) {
    const data = await searchRes.json()
    if (data.files?.length > 0) {
      folderCache[cacheKey] = data.files[0].id
      return data.files[0].id
    }
  }

  // Create new folder
  const createRes = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })

  if (!createRes.ok) {
    const e = await createRes.json().catch(() => ({}))
    throw new Error(e.error?.message || `Folder create failed ${createRes.status}`)
  }

  const folder = await createRes.json()
  folderCache[cacheKey] = folder.id
  return folder.id
}

// ── Upload resume: saved inside a job-role subfolder ─────────────────────────
// Structure: resumesFolder / <jobRole> / file.pdf
export async function uploadToDrive(file, mainFolderId, jobRole) {
  const token = getToken()
  if (!token) throw new Error('Not authenticated with Google')

  const mimeType = file.type || 'application/octet-stream'
  const base64   = await fileToBase64(file)

  const resumesFolderId = import.meta.env.VITE_GOOGLE_DRIVE_RESUMES_FOLDER_ID || mainFolderId || null

  // Determine target folder — create role subfolder if we have a parent
  let targetId = resumesFolderId
  if (resumesFolderId && jobRole?.trim()) {
    try {
      targetId = await getOrCreateFolder(token, resumesFolderId, jobRole.trim())
    } catch {
      // Fall back to flat upload into resumesFolder
      targetId = resumesFolderId
    }
  }

  const meta = targetId
    ? { name: file.name, mimeType, parents: [targetId] }
    : { name: file.name, mimeType }

  const fileData = await doUpload(token, meta, mimeType, base64)

  // Make publicly readable
  await fetch(`${API}/${fileData.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => {})

  return fileData.webViewLink
}

// ── Upload a document for a candidate: MainFolder/CandidateName/Documents/ ───
export async function uploadDocumentToDrive(file, mainFolderId, candidateName) {
  const token = getToken()
  if (!token) throw new Error('Not authenticated with Google')

  const parentId = mainFolderId || null
  if (!parentId) throw new Error('No Drive folder configured')

  const mimeType = file.type || 'application/octet-stream'
  const base64   = await fileToBase64(file)

  // MainFolder / CandidateName / Documents /
  const safeName   = (candidateName || 'Unknown').replace(/[/\\:*?"<>|]/g, '_').trim()
  const candFolder = await getOrCreateFolder(token, parentId, safeName)
  const docsFolder = await getOrCreateFolder(token, candFolder, 'Documents')

  const fileData = await doUpload(token, { name: file.name, mimeType, parents: [docsFolder] }, mimeType, base64)

  // Make publicly readable
  await fetch(`${API}/${fileData.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }).catch(() => {})

  return fileData.webViewLink
}

// ── Test Drive upload ─────────────────────────────────────────────────────────
export async function testDriveUpload(mainFolderId) {
  const token = getToken()
  if (!token) return { ok: false, error: 'Not connected to Google' }

  const resumesFolderId = import.meta.env.VITE_GOOGLE_DRIVE_RESUMES_FOLDER_ID || mainFolderId || null

  try {
    const fileData = await doUpload(
      token,
      { name: 'rre_test.txt', mimeType: 'text/plain', ...(resumesFolderId ? { parents: [resumesFolderId] } : {}) },
      'text/plain',
      btoa('RRE HR test')
    )
    await fetch(`${API}/${fileData.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
