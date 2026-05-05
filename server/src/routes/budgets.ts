import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getBudgets, upsertBudget, deleteBudget } from '../controllers/budgetController'

const router = Router()
router.use(authenticate)
router.get('/', getBudgets)
router.put('/:categoryId', upsertBudget)
router.delete('/:categoryId', deleteBudget)

export default router
