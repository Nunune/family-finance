import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { exportBackup, getStats, promoteUser } from '../controllers/adminController'

const router = Router()

// Promote endpoint: no auth required — protected by ADMIN_SECRET env var
router.post('/promote', promoteUser)

router.use(authenticate)
router.get('/stats', getStats)
router.get('/export', exportBackup)

export default router
