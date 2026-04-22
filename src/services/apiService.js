// Sheets → service account backend (always connected)
// Drive uploads → browser OAuth (user's quota, one-time popup)

import { uploadToDrive } from './driveUploadService'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function req(method, path, body, isFormData = false) {
  const opts = {
    method,
    headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    body: body
      ? isFormData ? body : JSON.stringify(body)
      : undefined,
  }
  const res = await fetch(`${BASE}${path}`, opts)
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
  if (!json.ok) throw new Error(json.error || `API error ${res.status}`)
  return json
}

export const api = {
  getCandidates:    ()           => req('GET',    '/candidates'),
  addCandidate:     (c)          => req('POST',   '/candidates', c),
  updateCandidate:  (id, data)   => req('PUT',    `/candidates/${id}`, data),
  deleteCandidate:  (id)         => req('DELETE', `/candidates/${id}`),
  bulkSetCandidates:(list)       => req('POST',   '/candidates/bulk', list),

  readTab:  (name)       => req('GET',  `/tabs/${name}`),
  writeTab: (name, rows) => req('POST', `/tabs/${name}`, { rows }),

  // Drive upload via browser OAuth — uses user's Drive quota, not service account
  uploadFile: (file, meta = {}) => uploadToDrive(file, meta),

  fetchAll: () => req('GET', '/data/all'),
  health:   () => req('GET', '/health'),
}
