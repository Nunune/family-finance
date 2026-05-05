import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import WalletPage from './pages/WalletPage'
import FamilyPage from './pages/FamilyPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import PlansPage from './pages/PlansPage'
import Navbar from './components/Layout/Navbar'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-emerald-500 text-2xl animate-pulse">💰</div>
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/personal" element={<WalletPage walletType="PERSONAL" />} />
        <Route path="/shared" element={
          user.familyId ? <WalletPage walletType="SHARED" /> : <Navigate to="/family" />
        } />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
