import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { confirmCodeLimiter } from '../middleware/rateLimit'
import {
  getRecurrings, createRecurring, updateRecurring, deleteRecurring,
  getProposals, confirmProposal, dismissProposal,
} from '../controllers/recurringController'

const router = Router()
router.use(authenticate)

router.get('/proposals', getProposals)
router.post('/proposals/:id/confirm', confirmCodeLimiter, confirmProposal)
router.post('/proposals/:id/dismiss', dismissProposal)
router.get('/', getRecurrings)
router.post('/', createRecurring)
router.put('/:id', updateRecurring)
router.delete('/:id', deleteRecurring)

export default router
