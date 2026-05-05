import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getPockets, createPocket, updatePocket, deletePocket } from '../controllers/pocketController'

const router = Router()
router.use(authenticate)
router.get('/', getPockets)
router.post('/', createPocket)
router.put('/:id', updatePocket)
router.delete('/:id', deletePocket)
export default router
