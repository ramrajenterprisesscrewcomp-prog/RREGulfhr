import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

// Vite resolves this URL and copies the worker to the build output
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY

export const hasApiKey = () => Boolean(OPENAI_KEY && OPENAI_KEY.trim())

/**
 * Extract plain text from a PDF file (up to 4 pages)
 */
export async function extractPDFText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let text = ''
  const pages = Math.min(pdf.numPages, 4)
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((it) => it.str).join(' ') + '\n\n'
  }
  return text.trim()
}

/**
 * Convert a File to base64 string (without data URI prefix)
 */
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const EXTRACT_PROMPT = `You are an expert HR recruiter assistant.
Extract candidate information from the resume and return ONLY valid JSON — no markdown, no explanation.
Use null for any field you cannot determine with reasonable confidence.

Required JSON schema:
{
  "name":       "full name of the candidate",
  "phone":      "phone number formatted as +[country_code]-[number] e.g. +91-9123456789 or +971-501234567",
  "email":      "email address",
  "role":       "most recent or target job title / position",
  "experience": "professional experience summary in 2-3 concise sentences highlighting years and key skills",
  "education":  "highest qualification with institution and year if available",
  "location":    "city and country of current residence",
  "nationality": "citizenship / nationality e.g. Indian, Saudi, Filipino",
  "category":    "MUST be exactly one of: Engineering | IT | Oil & Gas | Non-Technical"
}`

/**
 * Call OpenAI with a text resume (gpt-4o-mini)
 */
async function callOpenAIText(resumeText, prompt = EXTRACT_PROMPT) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${resumeText.slice(0, 4500)}`,
        },
      ],
    }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error?.message || `OpenAI error ${resp.status}`)
  }
  const data = await resp.json()
  return JSON.parse(data.choices[0].message.content)
}

/**
 * Call OpenAI Vision with an image resume (gpt-4o)
 */
async function callOpenAIVision(file) {
  const b64 = await toBase64(file)
  const mime = file.type || 'image/jpeg'
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACT_PROMPT },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${b64}`, detail: 'high' },
            },
          ],
        },
      ],
    }),
  })
  if (!resp.ok) {
    const e = await resp.json().catch(() => ({}))
    throw new Error(e.error?.message || `OpenAI error ${resp.status}`)
  }
  const data = await resp.json()
  return JSON.parse(data.choices[0].message.content)
}

/**
 * Extract plain text from a .docx file using mammoth
 */
export async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value?.trim() || ''
}

// Detect file category from MIME type or extension
function detectFileType(file) {
  const mime = (file.type || '').toLowerCase()
  const ext  = (file.name || '').toLowerCase().split('.').pop()

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'

  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/msword' ||
    ext === 'docx' || ext === 'doc'
  ) return 'docx'

  // Any image type — covers jpg, jpeg, png, webp, gif, bmp, tiff, heic, avif, svg, etc.
  if (mime.startsWith('image/') || ['jpg','jpeg','png','webp','gif','bmp','tiff','tif','heic','heif','avif','jfif'].includes(ext))
    return 'image'

  return 'unknown'
}

/**
 * Main entry point — accepts PDF, DOCX/DOC, or any image format
 */
export async function analyzeResume(file) {
  if (!hasApiKey()) throw new Error('No API key')

  const type = detectFileType(file)

  if (type === 'pdf') {
    const text = await extractPDFText(file)
    if (!text || text.length < 30) throw new Error('Could not extract text from PDF')
    return callOpenAIText(text)
  }

  if (type === 'docx') {
    const text = await extractDocxText(file)
    if (!text || text.length < 30) throw new Error('Could not extract text from Word document')
    return callOpenAIText(text)
  }

  if (type === 'image') return callOpenAIVision(file)

  throw new Error(`Unsupported file type: .${file.name.split('.').pop()} — use PDF, DOCX, or an image file`)
}

const EMAIL_PROMPT = `You are an expert HR recruiter assistant.
Extract candidate information from this email and return ONLY valid JSON — no markdown, no explanation.
Use null for any field you cannot determine. The email may be a job application, CV submission, or candidate introduction.

Required JSON schema:
{
  "name":       "full name of the candidate",
  "phone":      "phone number formatted as +[country_code]-[number] e.g. +91-9123456789",
  "email":      "email address",
  "role":       "job title or position applied for",
  "experience": "professional experience summary in 2-3 concise sentences",
  "education":  "highest qualification with institution and year if available",
  "location":   "city and country of current residence",
  "nationality": "citizenship / nationality e.g. Indian, Saudi, Filipino",
  "category":   "MUST be exactly one of: Engineering | IT | Oil & Gas | Non-Technical"
}

Email content:`

/**
 * Extract candidate info from email body text (fallback when no usable attachment)
 */
export async function analyzeEmailContent(emailText, subject = '', from = '') {
  if (!hasApiKey()) throw new Error('No API key')
  const context = [
    subject && `Subject: ${subject}`,
    from    && `From: ${from}`,
    emailText,
  ].filter(Boolean).join('\n\n')
  return callOpenAIText(context, EMAIL_PROMPT)
}
