import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { listWallets, createWallet, deleteWallet } from '../controllers/walletController'

const router = Router()
router.use(authenticate)
router.get('/', listWallets)
router.post('/', createWallet)
router.delete('/:id', deleteWallet)

export default router
