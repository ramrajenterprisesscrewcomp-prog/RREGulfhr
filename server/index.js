require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const express    = require('express')
const cors       = require('cors')

const app = express()

// ── CORS — allow Vite dev server and production origin ───────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) return cb(null, true)
    cb(new Error(`CORS: ${origin} not allowed`))
  },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Request logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/candidates', require('./routes/candidates'))
app.use('/api/tabs',       require('./routes/tabs'))
app.use('/api/drive',      require('./routes/drive'))
app.use('/api/data',       require('./routes/data'))

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    sheet: Boolean(process.env.GOOGLE_SHEET_ID),
    serviceAccount: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
  })
})

// ── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server error]', err.message)
  res.status(500).json({ ok: false, error: err.message })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`RRE HR backend running on http://localhost:${PORT}`)
  console.log(`  Sheet ID   : ${process.env.GOOGLE_SHEET_ID || '(not set)'}`)
  console.log(`  Service Acc: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(not set)'}`)
})
