import { getToken } from './googleAuth'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

// Accept PDF, Word docs, and any image type
function isResumeMime(mime = '', filename = '') {
  const m = mime.toLowerCase()
  const ext = filename.toLowerCase().split('.').pop()
  return (
    m === 'application/pdf' ||
    m === 'application/msword' ||
    m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    m.startsWith('image/') ||
    ['pdf','doc','docx','jpg','jpeg','png','webp','gif','bmp','tiff','tif','heic','avif'].includes(ext)
  )
}

async function gReq(path, opts = {}) {
  const token = getToken()
  if (!token) throw new Error('Not authenticated with Google')
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `Gmail API ${res.status}`)
  }
  return res.json()
}

// Decode base64url string to plain text
function b64ToString(b64) {
  try {
    return decodeURIComponent(escape(atob(b64.replace(/-/g, '+').replace(/_/g, '/'))))
  } catch {
    return atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  }
}

// Recursively extract readable text from a MIME part tree
function extractBodyText(part, prefer = 'text/plain') {
  if (!part) return ''
  if (part.mimeType === prefer && part.body?.data)
    return b64ToString(part.body.data)
  // Try sub-parts
  if (part.parts) {
    for (const p of part.parts) {
      const t = extractBodyText(p, prefer)
      if (t) return t
    }
    // Fall back to html if no plain found
    if (prefer === 'text/plain') {
      for (const p of part.parts) {
        const t = extractBodyText(p, 'text/html')
        if (t) return t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      }
    }
  }
  if (part.mimeType === 'text/html' && part.body?.data)
    return b64ToString(part.body.data).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return ''
}

// Convert base64url → Uint8Array → File
function b64ToFile(b64, filename, mimeType) {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mimeType })
}

function getHeader(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

// Recursively find attachment parts in a MIME message
function findAttachmentParts(part, parts = []) {
  if (!part) return parts
  if (isResumeMime(part.mimeType, part.filename) && part.filename && part.body) {
    parts.push(part)
  }
  if (part.parts) part.parts.forEach((p) => findAttachmentParts(p, parts))
  return parts
}

/**
 * Scan Gmail inbox for emails with resume attachments.
 * @param {number} maxResults - how many emails to scan (default 20)
 * @param {number} daysBack   - how far back to look (default 30)
 * @returns Array of { messageId, subject, from, date, attachments: [{ filename, mimeType, attachmentId, size }] }
 */
export async function scanEmailsForResumes(maxResults = 30, daysBack = 30) {
  const after = Math.floor((Date.now() - daysBack * 86400000) / 1000)
  const q = encodeURIComponent(`has:attachment after:${after}`)
  const listData = await gReq(`/messages?maxResults=${maxResults}&q=${q}`)
  const messages = listData.messages || []

  const results = []
  for (const msg of messages) {
    try {
      const detail = await gReq(`/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
      const hdrs   = detail.payload?.headers || []
      const from    = getHeader(hdrs, 'From')
      const subject = getHeader(hdrs, 'Subject')
      const date    = getHeader(hdrs, 'Date')

      // Get full message structure to find attachment parts
      const full  = await gReq(`/messages/${msg.id}?format=full`)
      const parts = findAttachmentParts(full.payload)
      if (parts.length === 0) continue

      const attachments = parts.map((p) => ({
        filename:     p.filename,
        mimeType:     p.mimeType,
        attachmentId: p.body.attachmentId,
        size:         p.body.size || 0,
      }))

      results.push({ messageId: msg.id, subject, from, date, attachments })
    } catch (e) {
      console.warn('[Gmail] skip message', msg.id, e.message)
    }
  }
  return results
}

/**
 * Download a specific attachment and return it as a File object.
 */
export async function downloadAttachment(messageId, attachmentId, filename, mimeType) {
  const data = await gReq(`/messages/${messageId}/attachments/${attachmentId}`)
  return b64ToFile(data.data, filename, mimeType)
}

/**
 * Fetch the plain-text body of an email message.
 * Returns an empty string if the message has no readable body.
 */
export async function getEmailBody(messageId) {
  const full = await gReq(`/messages/${messageId}?format=full`)
  return extractBodyText(full.payload)
}
