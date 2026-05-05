import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { exportBackup } from '../controllers/adminController'

const router = Router()
router.use(authenticate)
router.get('/export', exportBackup)

export default router
