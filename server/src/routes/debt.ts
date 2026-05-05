import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getDebts, createDebt, updateDebt, deleteDebt,
  addPayment, deletePayment, addViewer, removeViewer,
} from '../controllers/debtController'

const router = Router()
router.use(authenticate)

router.get('/', getDebts)
router.post('/', createDebt)
router.put('/:id', updateDebt)
router.delete('/:id', deleteDebt)
router.post('/:id/payments', addPayment)
router.delete('/:id/payments/:paymentId', deletePayment)
router.post('/:id/viewers', addViewer)
router.delete('/:id/viewers/:viewerUserId', removeViewer)

export default router
