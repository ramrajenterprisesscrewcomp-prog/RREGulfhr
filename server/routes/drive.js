const router = require('express').Router()
const multer = require('multer')
const { uploadFile } = require('../lib/drive')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
})

// POST /api/drive/upload
// Form fields: file (binary), jobRole?, candidateName?, docType?
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No file provided' })

    const subfolders = []
    if (req.body.jobRole)       subfolders.push(req.body.jobRole)
    if (req.body.candidateName) subfolders.push(req.body.candidateName)
    if (req.body.docType)       subfolders.push(req.body.docType)

    const { id, url } = await uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      subfolders,
    )
    res.json({ ok: true, fileId: id, url })
  } catch (e) {
    console.error('[drive POST /upload]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
