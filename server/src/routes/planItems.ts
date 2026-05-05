import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getPlanItems,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
  toggleCompletion,
  getUpcomingReminders,
} from '../controllers/planController'

const router = Router()
router.use(authenticate)

router.get('/', getPlanItems)
router.get('/reminders', getUpcomingReminders)
router.post('/', createPlanItem)
router.put('/:id', updatePlanItem)
router.delete('/:id', deletePlanItem)
router.post('/:id/completion', toggleCompletion)

export default router
