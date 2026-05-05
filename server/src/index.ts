import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import authRoutes from './routes/auth'
import transactionRoutes from './routes/transactions'
import debtRoutes from './routes/debt'
import recurringRoutes from './routes/recurring'
import savingsRoutes from './routes/savings'
import { setupSocket } from './socket/handlers'
import { authLimiter, apiLimiter } from './middleware/rateLimit'
import { runRecurringScheduler } from './controllers/recurringController'

const app = express()
const httpServer = createServer(app)
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const io = new Server(httpServer, {
  cors: { origin: clientOrigin, credentials: true },
})

app.use(cors({ origin: clientOrigin, credentials: true }))
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

setupSocket(io)

runRecurringScheduler()
setInterval(runRecurringScheduler, 60 * 60 * 1000)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
