// Uploads files directly from the browser using the user's OAuth token.
// This avoids service account quota issues — files are owned by the user.

const CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID
const FOLDER_ID   = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

let cachedToken  = null
let tokenExpiry  = 0

function loadGIS() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = resolve
    document.head.appendChild(s)
  })
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  if (!CLIENT_ID) throw new Error('Google Client ID not configured — add VITE_GOOGLE_CLIENT_ID in Vercel env vars')
  await loadGIS()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error_description || resp.error))
        cachedToken = resp.access_token
        tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000
        resolve(cachedToken)
      },
      error_callback: (err) => reject(new Error(err.message || 'Google auth failed')),
    })
    // No prompt override — let Google show popup naturally on first use
    client.requestAccessToken()
  })
}

async function driveReq(path, opts = {}) {
  const token = await getToken()
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json
}

async function getOrCreateFolder(parentId, name) {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  const found = await driveReq(`/files?q=${encodeURIComponent(q)}&fields=files(id)`)
  if (found.files?.length) return found.files[0].id
  const token = await getToken()
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.id
}

// Call this directly from a button click to pre-authorize before uploading
export async function authorizeDrive() {
  cachedToken = null   // force fresh auth
  tokenExpiry = 0
  return getToken()
}

export function isDriveAuthorized() {
  return Boolean(cachedToken && Date.now() < tokenExpiry)
}

export async function uploadToDrive(file, meta = {}) {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID not set')
  if (!FOLDER_ID) throw new Error('VITE_GOOGLE_DRIVE_FOLDER_ID not set')

  const token = await getToken()

  // Build subfolder path: RRE HR / jobRole / candidateName
  let parentId = FOLDER_ID
  if (meta.jobRole)       parentId = await getOrCreateFolder(parentId, meta.jobRole)

  // Multipart upload
  const metadata = { name: file.name, parents: [parentId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)

  // Make publicly readable
  await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  return { ok: true, url: data.webViewLink, fileId: data.id }
}
