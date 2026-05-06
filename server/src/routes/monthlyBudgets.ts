import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getMonthlyBudget, upsertMonthlyBudget, deleteMonthlyBudget } from '../controllers/monthlyBudgetController'

const router = Router()
router.use(authenticate)
router.get('/', getMonthlyBudget)
router.put('/', upsertMonthlyBudget)
router.delete('/:month', deleteMonthlyBudget)

export default router
