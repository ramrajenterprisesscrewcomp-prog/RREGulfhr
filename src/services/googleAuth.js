const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const LS_TOKEN  = 'rre_gauth_token'   // localStorage — survives tab close
const LS_EXPIRY = 'rre_gauth_expiry'
const LS_FLAG   = 'rre_gauth'

let tokenClient = null
let accessToken  = null
let tokenExpiry  = 0
let refreshTimer = null

// ── Restore token from localStorage on module load ───────────────────────────
function restore() {
  const t = localStorage.getItem(LS_TOKEN)
  const e = parseInt(localStorage.getItem(LS_EXPIRY) || '0')
  if (t && Date.now() < e) {
    accessToken = t
    tokenExpiry = e
    scheduleRefresh()
    return true
  }
  return false
}
restore()

// ── Save token to localStorage ───────────────────────────────────────────────
function save(token, expiresIn) {
  accessToken = token
  tokenExpiry = Date.now() + (expiresIn - 60) * 1000
  localStorage.setItem(LS_TOKEN,  token)
  localStorage.setItem(LS_EXPIRY, String(tokenExpiry))
  localStorage.setItem(LS_FLAG,   '1')
  scheduleRefresh()
}

// ── Auto-refresh token 5 min before expiry ───────────────────────────────────
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  const msLeft = tokenExpiry - Date.now() - 5 * 60 * 1000   // 5 min before expiry
  if (msLeft > 0) {
    refreshTimer = setTimeout(() => {
      requestToken(true).catch(() => {})
    }, msLeft)
  }
}

export function initGoogleAuth() {
  if (!window.google?.accounts?.oauth2 || !CLIENT_ID) return false
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  })
  return true
}

/**
 * Request an access token.
 * silent=true → no popup (auto-reconnect on page load / token refresh)
 * silent=false → show consent screen (first-time connect)
 */
export function requestToken(silent = false) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google auth not initialised — check VITE_GOOGLE_CLIENT_ID'))
      return
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        reject(new Error(resp.error_description || resp.error))
        return
      }
      save(resp.access_token, resp.expires_in)
      window.dispatchEvent(new CustomEvent('gauth', { detail: true }))
      resolve(accessToken)
    }
    tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' })
  })
}

export function revokeToken() {
  if (refreshTimer) clearTimeout(refreshTimer)
  if (accessToken) window.google?.accounts.oauth2.revoke(accessToken)
  accessToken = null
  tokenExpiry  = 0
  localStorage.removeItem(LS_TOKEN)
  localStorage.removeItem(LS_EXPIRY)
  localStorage.removeItem(LS_FLAG)
  window.dispatchEvent(new CustomEvent('gauth', { detail: false }))
}

export function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  if (restore()) return accessToken
  return null
}

export function isConnected() { return Boolean(getToken()) }
export function wasConnected() { return localStorage.getItem(LS_FLAG) === '1' }
