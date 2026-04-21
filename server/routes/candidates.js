const router = require('express').Router()
const { getCandidates, addCandidate, updateCandidate, deleteCandidate, bulkSetCandidates } = require('../lib/sheets')

router.get('/', async (req, res) => {
  try {
    const list = await getCandidates()
    res.json({ ok: true, data: list })
  } catch (e) {
    console.error('[candidates GET]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const candidate = await addCandidate(req.body)
    res.json({ ok: true, data: candidate })
  } catch (e) {
    console.error('[candidates POST]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

router.post('/bulk', async (req, res) => {
  try {
    await bulkSetCandidates(req.body)
    res.json({ ok: true })
  } catch (e) {
    console.error('[candidates POST /bulk]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const updated = await updateCandidate(req.params.id, req.body)
    res.json({ ok: true, data: updated })
  } catch (e) {
    console.error('[candidates PUT]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await deleteCandidate(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    console.error('[candidates DELETE]', e.message)
    res.status(500).json({ ok: false, error: e.message })
  }
})

module.exports = router
