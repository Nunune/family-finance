import rateLimit from 'express-rate-limit'

// Auth endpoints: login/register/reset — strict, 50 lần / 15 phút
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Quá nhiều yêu cầu, thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
  // Mỗi IP riêng — không cần Redis cho app gia đình nhỏ
  keyGenerator: (req) => req.ip ?? 'unknown',
})

// Forgot password — rất chặt, 5 lần / 15 phút
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Quá nhiều lần thử, thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
})

// Confirmation code — 10 lần / 15 phút
export const confirmCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Quá nhiều lần thử, thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? 'unknown',
})

// API endpoints thông thường — 200 lần / phút
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Quá nhiều yêu cầu, thử lại sau' },
  standardHeaders: true,
  legacyHeaders: false,
})
