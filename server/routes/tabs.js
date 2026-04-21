const router = require('express').Router()
const { readTab, writeTab } = require('../lib/sheets')

// Generic tab read — GET /api/tabs/:name
router.get('/:name', async (req, res) => {
  try {
    const rows = await readTab(req.params.name)
    res.json({ ok: true, data: rows })
  } catch (e) {
    console.error('[tabs GET]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// Generic tab write — POST /api/tabs/:name  body: { rows: [[...]] }
router.post('/:name', async (req, res) => {
  try {
    await writeTab(req.params.name, req.body.rows || [])
    res.json({ ok: true })
  } catch (e) {
    console.error('[tabs POST]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
