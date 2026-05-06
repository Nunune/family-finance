import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getRecipients, createRecipient, updateRecipient, deleteRecipient } from '../controllers/recipientController'

const router = Router()
router.use(authenticate)
router.get('/', getRecipients)
router.post('/', createRecipient)
router.patch('/:id', updateRecipient)
router.delete('/:id', deleteRecipient)

export default router
