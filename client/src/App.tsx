import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { ProposalProvider } from './contexts/ProposalContext'
import Navbar from './components/Layout/Navbar'
import BottomNav from './components/Layout/BottomNav'

const AuthPage           = lazy(() => import('./pages/AuthPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const WalletPage         = lazy(() => import('./pages/WalletPage'))
const SharedFundPage     = lazy(() => import('./pages/SharedFundPage'))
const FamilyPage         = lazy(() => import('./pages/FamilyPage'))
const PlansPage          = lazy(() => import('./pages/PlansPage'))
const CategoriesPage     = lazy(() => import('./pages/CategoriesPage'))
const BudgetPage         = lazy(() => import('./pages/BudgetPage'))
const AdminPage          = lazy(() => import('./pages/AdminPage'))

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-emerald-400"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-8px);opacity:1}}`}</style>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center gap-4">
        <img src="/avocado.png" alt="loading" className="w-48 h-48 object-contain" style={{ animation: 'float 2s ease-in-out infinite' }} />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-bold text-gray-800">Tiền Tui</h1>
          <p className="text-sm text-gray-400">Tiền tui · Tui quản · Tui vui!</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-emerald-400"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
          ))}
        </div>
        <style>{`
          @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:.4} 40%{transform:translateY(-8px);opacity:1} }
          @keyframes float  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        `}</style>
      </div>
    )
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="*" element={<AuthPage />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 sm:pb-0">
      <Navbar />
      <BottomNav />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/personal" element={<WalletPage walletType="PERSONAL" />} />
          <Route path="/shared" element={<SharedFundPage />} />
          <Route path="/family" element={<FamilyPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          {user.isAppAdmin && <Route path="/admin" element={<AdminPage />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ProposalProvider>
            <AppContent />
          </ProposalProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
