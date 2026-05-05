import { Router } from 'express'
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  setInitialBalance,
  exportTransactions,
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
router.get('/export/csv', exportTransactions)
router.get('/categories/all', getCategories)
router.post('/categories', createCategory)
router.put('/categories/:id', updateCategory)
router.delete('/categories/:id', deleteCategory)
router.put('/wallet/balance', setInitialBalance)

export default router
