// All Sheets/Drive calls go through the backend — no Google OAuth needed

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

  // Drive upload — accepts a File object
  uploadFile: (file, meta = {}) => {
    const fd = new FormData()
    fd.append('file', file)
    Object.entries(meta).forEach(([k, v]) => v && fd.append(k, v))
    return req('POST', '/drive/upload', fd, true)
  },

  health: () => req('GET', '/health'),
}
