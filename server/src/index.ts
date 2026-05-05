import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { createServer } from 'http'
import { Server } from 'socket.io'
import authRoutes from './routes/auth'
import transactionRoutes from './routes/transactions'
import debtRoutes from './routes/debt'
import recurringRoutes from './routes/recurring'
import savingsRoutes from './routes/savings'
import adminRoutes from './routes/admin'
import pocketRoutes from './routes/pockets'
import budgetRoutes from './routes/budgets'
import planItemRoutes from './routes/planItems'
import subFundRoutes from './routes/subFunds'
import { setupSocket } from './socket/handlers'
import { authLimiter, apiLimiter } from './middleware/rateLimit'
import { runRecurringScheduler } from './controllers/recurringController'

const app = express()
app.set('trust proxy', 1)
const httpServer = createServer(app)
const isProd = process.env.NODE_ENV === 'production'
const corsOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, credentials: true },
})

app.use(cors({ origin: corsOrigin, credentials: true }))
app.use(express.json({ limit: '100kb' }))

app.use((req: any, _res, next) => {
  req.io = io
  next()
})

app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/transactions', apiLimiter, transactionRoutes)
app.use('/api/debts', apiLimiter, debtRoutes)
app.use('/api/recurring', apiLimiter, recurringRoutes)
app.use('/api/savings', apiLimiter, savingsRoutes)
app.use('/api/admin', apiLimiter, adminRoutes)
app.use('/api/pockets', apiLimiter, pocketRoutes)
app.use('/api/budgets', apiLimiter, budgetRoutes)
app.use('/api/plan-items', apiLimiter, planItemRoutes)
app.use('/api/sub-funds', apiLimiter, subFundRoutes)

// Serve React client in production
const clientDist = path.join(__dirname, '../../client/dist')
if (isProd && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
}

setupSocket(io)

runRecurringScheduler()
setInterval(runRecurringScheduler, 60 * 60 * 1000)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
