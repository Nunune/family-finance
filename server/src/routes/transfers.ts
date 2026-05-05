import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getTransferWallets, createTransfer } from '../controllers/transferController'

const router = Router()
router.use(authenticate)
router.get('/wallets', getTransferWallets)
router.post('/', createTransfer)

export default router
