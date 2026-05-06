import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getExchangeRates, upsertExchangeRate } from '../controllers/exchangeRateController'

const router = Router()
router.use(authenticate)
router.get('/', getExchangeRates)
router.put('/', upsertExchangeRate)

export default router
