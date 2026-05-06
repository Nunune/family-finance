import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getPockets, createPocket, updatePocket, deletePocket, getEntries, addEntry, deleteEntry, transferToMain } from '../controllers/pocketController'

const router = Router()
router.use(authenticate)
router.get('/', getPockets)
router.post('/', createPocket)
router.put('/:id', updatePocket)
router.delete('/:id', deletePocket)
router.get('/:id/entries', getEntries)
router.post('/:id/entries', addEntry)
router.delete('/:id/entries/:entryId', deleteEntry)
router.post('/:id/transfer', transferToMain)
export default router
