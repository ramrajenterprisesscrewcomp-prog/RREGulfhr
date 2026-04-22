// Uploads files directly from the browser using the user's OAuth token.
// GIS is loaded in index.html at startup so requestAccessToken runs
// synchronously inside a user-gesture context (no popup blocking).

const CLIENT_ID   = import.meta.env.VITE_GOOGLE_CLIENT_ID
const FOLDER_ID   = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

let cachedToken = null
let tokenExpiry = 0
let tokenClient = null

function buildTokenClient(callback, errorCallback) {
  return window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: DRIVE_SCOPE,
    callback,
    error_callback: errorCallback,
  })
}

// Called directly from a button click — no awaits before requestAccessToken
// so the browser popup is not blocked.
export function authorizeDrive() {
  cachedToken = null
  tokenExpiry = 0
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) return reject(new Error('VITE_GOOGLE_CLIENT_ID not configured'))
    if (!window.google?.accounts?.oauth2) return reject(new Error('Google Sign-In library not loaded yet — please refresh the page'))
    tokenClient = buildTokenClient(
      (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error))
        cachedToken = resp.access_token
        tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000
        resolve(cachedToken)
      },
      (err) => reject(new Error(err.message || 'Google auth failed')),
    )
    // prompt:'select_account consent' forces account picker + permission screen
    tokenClient.requestAccessToken({ prompt: 'select_account consent' })
  })
}

export function isDriveAuthorized() {
  return Boolean(cachedToken && Date.now() < tokenExpiry)
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  // Token expired — caller must click Connect Drive again
  throw new Error('Drive not authorized — click "Connect Drive" in the top bar first')
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
  const found = await driveReq(`/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true`)
  if (found.files?.length) return found.files[0].id
  const token = await getToken()
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  return json.id
}

export async function uploadToDrive(file, meta = {}) {
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID not set')

  const token = await getToken()

  // Try to upload into the configured folder; fall back to Drive root if inaccessible
  let parents = []
  if (FOLDER_ID) {
    try {
      const check = await fetch(`https://www.googleapis.com/drive/v3/files/${FOLDER_ID}?fields=id&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const checkJson = await check.json()
      if (!checkJson.error) {
        let parentId = FOLDER_ID
        if (meta.jobRole) parentId = await getOrCreateFolder(parentId, meta.jobRole)
        parents = [parentId]
      }
    } catch (_) { /* fall through to root upload */ }
  }

  // Multipart upload
  const metadata = { name: file.name, ...(parents.length ? { parents } : {}) }
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
