// Sheets via service account backend; file uploads via Cloudinary (no OAuth needed)

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

// ── Candidates ────────────────────────────────────────────────────────────────
export const api = {
  getCandidates:    ()            => req('GET',    '/candidates'),
  addCandidate:     (c)           => req('POST',   '/candidates', c),
  updateCandidate:  (id, data)    => req('PUT',    `/candidates/${id}`, data),
  deleteCandidate:  (id)          => req('DELETE', `/candidates/${id}`),
  bulkSetCandidates:(list)        => req('POST',   '/candidates/bulk', list),

  // Generic tab ops (projects, interviews, documents)
  readTab:  (name)        => req('GET',  `/tabs/${name}`),
  writeTab: (name, rows)  => req('POST', `/tabs/${name}`, { rows }),

  // Resume upload via Cloudinary — no OAuth, no quota issues, always connected
  uploadFile: async (file, meta = {}) => {
    const cloud  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
    const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
    if (!cloud || !preset) throw new Error('Cloudinary not configured (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET missing)')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', preset)
    fd.append('folder', `rre-hr/${meta.jobRole || 'resumes'}`)
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, { method: 'POST', body: fd })
    const json = await res.json()
    if (json.error) throw new Error(json.error.message)
    return { ok: true, url: json.secure_url }
  },

  health: () => req('GET', '/health'),
}
