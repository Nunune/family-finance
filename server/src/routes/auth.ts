import { Router } from 'express'
import {
  register, login, getMe,
  verifyRecoveryCode, resetPassword,
  createFamily, createInvite, revokeInvite, getInvites, joinFamily, getFamilyInfo,
  leaveFamily, transferAdmin,
  logoutAll, updateProfile, getFamilyReport, changePassword,
} from '../controllers/authController'
import { authenticate } from '../middleware/auth'
import { forgotPasswordLimiter } from '../middleware/rateLimit'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', authenticate, getMe)

router.post('/forgot-password/verify', forgotPasswordLimiter, verifyRecoveryCode)
router.post('/forgot-password/reset', forgotPasswordLimiter, resetPassword)

router.post('/family/create', authenticate, createFamily)
router.post('/family/invite', authenticate, createInvite)
router.delete('/family/invite/:inviteCode', authenticate, revokeInvite)
router.get('/family/invites', authenticate, getInvites)
router.post('/family/join', authenticate, joinFamily)
router.get('/family', authenticate, getFamilyInfo)
router.get('/family/report', authenticate, getFamilyReport)
router.post('/family/leave', authenticate, leaveFamily)
router.post('/family/transfer-admin', authenticate, transferAdmin)
router.post('/logout-all', authenticate, logoutAll)
router.patch('/profile', authenticate, updateProfile)
router.post('/change-password', authenticate, changePassword)

export default router
