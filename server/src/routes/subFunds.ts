import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getSubFunds,
  createSubFund,
  updateSubFund,
  deleteSubFund,
  addMember,
  removeMember,
  getSubFundWallet,
} from '../controllers/subFundController'

const router = Router()
router.use(authenticate)

router.get('/', getSubFunds)
router.post('/', createSubFund)
router.put('/:id', updateSubFund)
router.delete('/:id', deleteSubFund)
router.get('/:id/wallet', getSubFundWallet)
router.post('/:id/members', addMember)
router.delete('/:id/members/:memberId', removeMember)

export default router
