import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getHuis, createHui, updateHui, deleteHui, toggleRound } from '../controllers/huiController'

const router = Router()
router.use(authenticate)
router.get('/', getHuis)
router.post('/', createHui)
router.patch('/:id', updateHui)
router.delete('/:id', deleteHui)
router.post('/:id/rounds/:roundNo/toggle', toggleRound)

export default router
