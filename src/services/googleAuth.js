const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/gmail.readonly',
].join(' ')

const CLIENT_ID  = import.meta.env.VITE_GOOGLE_CLIENT_ID
const LS_FLAG    = 'rre_gauth'          // persists across browser restarts
const SS_TOKEN   = 'rre_gauth_token'    // survives page refresh
const SS_EXPIRY  = 'rre_gauth_expiry'   // survives page refresh

let tokenClient = null
let accessToken  = null
let tokenExpiry  = 0

// ── Restore token from sessionStorage on module load (page refresh) ──────────
function restore() {
  const t = sessionStorage.getItem(SS_TOKEN)
  const e = parseInt(sessionStorage.getItem(SS_EXPIRY) || '0')
  if (t && Date.now() < e) {
    accessToken = t
    tokenExpiry = e
    return true
  }
  return false
}
restore()   // runs immediately when the module is imported

// ── Save token to sessionStorage + set persistent flag ───────────────────────
function save(token, expiresIn) {
  accessToken = token
  tokenExpiry = Date.now() + (expiresIn - 60) * 1000
  sessionStorage.setItem(SS_TOKEN,  token)
  sessionStorage.setItem(SS_EXPIRY, String(tokenExpiry))
  localStorage.setItem(LS_FLAG, '1')
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
 * silent=true → no popup if user already granted access (used for auto-reconnect)
 * silent=false → show full consent screen (first connect)
 */
export function requestToken(silent = false) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google auth not initialised — check VITE_GOOGLE_CLIENT_ID'))
      return
    }
    tokenClient.callback = (resp) => {
      if (resp.error) {
        if (silent) localStorage.removeItem(LS_FLAG)
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
  if (accessToken) window.google?.accounts.oauth2.revoke(accessToken)
  accessToken = null
  tokenExpiry  = 0
  sessionStorage.removeItem(SS_TOKEN)
  sessionStorage.removeItem(SS_EXPIRY)
  localStorage.removeItem(LS_FLAG)
  window.dispatchEvent(new CustomEvent('gauth', { detail: false }))
}

export function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken
  if (restore()) return accessToken   // try sessionStorage if in-memory expired
  return null
}

export function isConnected() {
  return Boolean(getToken())
}

export function wasConnected() {
  return localStorage.getItem(LS_FLAG) === '1'
}
