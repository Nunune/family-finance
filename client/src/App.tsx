import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import WalletPage from './pages/WalletPage'
import SharedFundPage from './pages/SharedFundPage'
import FamilyPage from './pages/FamilyPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import PlansPage from './pages/PlansPage'
import CategoriesPage from './pages/CategoriesPage'
import Navbar from './components/Layout/Navbar'
import BottomNav from './components/Layout/BottomNav'
import { ProposalProvider } from './contexts/ProposalContext'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 p-4">
          <div className="text-5xl">😵</div>
          <h1 className="text-lg font-bold text-gray-800">Có lỗi xảy ra</h1>
          <p className="text-sm text-gray-500 text-center">Vui lòng tải lại trang để tiếp tục</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-sm font-medium"
          >
            Tải lại
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex flex-col items-center justify-center gap-4">
        <img src="/avocado.png" alt="loading" className="w-48 h-48 object-contain" style={{ animation: 'float 2s ease-in-out infinite' }} />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-bold text-gray-800">Quản lý Thu Chi</h1>
          <p className="text-sm text-gray-400">Gia đình</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-emerald-400"
              style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-8px); opacity: 1; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<AuthPage />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 sm:pb-0">
      <Navbar />
      <BottomNav />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/personal" element={<WalletPage walletType="PERSONAL" />} />
        <Route path="/shared" element={<SharedFundPage />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <ProposalProvider>
            <AppContent />
          </ProposalProvider>
          </SocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
