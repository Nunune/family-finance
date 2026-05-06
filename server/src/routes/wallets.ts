import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { listWallets, createWallet, deleteWallet, getWalletMonthly } from '../controllers/walletController'

const router = Router()
router.use(authenticate)
router.get('/', listWallets)
router.get('/monthly', getWalletMonthly)
router.post('/', createWallet)
router.delete('/:id', deleteWallet)

export default router
