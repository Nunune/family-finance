import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getGoals, createGoal, updateGoal, deleteGoal, addContribution, deleteContribution, respondWithdrawal, cancelWithdrawal } from '../controllers/savingsController'

const router = Router()

router.use(authenticate)

router.get('/', getGoals)
router.post('/', createGoal)
router.put('/:id', updateGoal)
router.delete('/:id', deleteGoal)
router.post('/:id/contributions', addContribution)
router.delete('/:id/contributions/:cid', deleteContribution)
router.post('/:id/withdrawal-requests/:rid/respond', respondWithdrawal)
router.delete('/:id/withdrawal-requests/:rid', cancelWithdrawal)

export default router
