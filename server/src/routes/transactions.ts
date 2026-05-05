import { Router } from 'express'
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getCategories,
  setInitialBalance,
} from '../controllers/transactionController'
import { authenticate } from '../middleware/auth'
import { idempotency } from '../middleware/idempotency'

const router = Router()

router.use(authenticate)
router.get('/', getTransactions)
router.post('/', idempotency, createTransaction)
router.put('/:id', updateTransaction)
router.delete('/:id', deleteTransaction)
router.get('/summary/stats', getSummary)
router.get('/categories/all', getCategories)
router.put('/wallet/balance', setInitialBalance)

export default router
