import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSocket } from '../../contexts/SocketContext'
import api from '../../services/api'
import EditProfileModal from '../Auth/EditProfileModal'

export default function Navbar() {
  const { user, logout, logoutAll, tokenExpiring, dismissExpiryWarning } = useAuth()
  const { socket } = useSocket()
  const [pendingProposals, setPendingProposals] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function checkProposals() {
      try {
        const { data } = await api.get('/recurring/proposals')
        if (!cancelled) setPendingProposals(data.length)
      } catch {}
    }
    checkProposals()
    const iv = setInterval(checkProposals, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    if (!socket) return
    socket.on('proposals:changed', async () => {
      try {
        const { data } = await api.get('/recurring/proposals')
        setPendingProposals(data.length)
      } catch {}
    })
    return () => { socket.off('proposals:changed') }
  }, [socket])

  return (
    <>
      {tokenExpiring && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
          <span className="text-amber-700">⚠️ Phiên đăng nhập sắp hết hạn. Đăng xuất rồi đăng nhập lại để tiếp tục.</span>
          <button onClick={dismissExpiryWarning} className="text-amber-500 hover:text-amber-700 ml-4 text-xs">✕</button>
        </div>
      )}

      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-1 font-bold text-emerald-600 text-lg">
            💰 <span className="hidden sm:inline">Thu Chi Gia Đình</span>
          </div>

          <div className="flex items-center gap-1">
            <NavLink to="/" end className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-gray-900'}`
            }>Tổng quan</NavLink>

            <NavLink to="/personal" className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-gray-900'}`
            }>Cá nhân</NavLink>

            {user?.familyId && (
              <NavLink to="/shared" className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-gray-900'}`
              }>Quỹ chung</NavLink>
            )}

            <NavLink to="/family" className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-gray-900'}`
            }>Gia đình</NavLink>

            <NavLink to="/plans" className={({ isActive }) =>
              `relative px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:text-gray-900'}`
            }>
              Kế hoạch
              {pendingProposals > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {pendingProposals}
                </span>
              )}
            </NavLink>
          </div>

          <div className="relative flex items-center gap-2">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition px-2 py-1 rounded-lg hover:bg-gray-50"
            >
              <span className="hidden sm:block">{user?.name}</span>
              <span className="text-gray-400">▾</span>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-9 z-50 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[160px]">
                  <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-100">{user?.email}</div>
                  <button onClick={() => { setShowUserMenu(false); setShowEditProfile(true) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                    Chỉnh sửa hồ sơ
                  </button>
                  <button onClick={() => { setShowUserMenu(false); logout() }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                    Đăng xuất
                  </button>
                  <button onClick={() => { setShowUserMenu(false); logoutAll() }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition">
                    Đăng xuất mọi thiết bị
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>
      {showEditProfile && <EditProfileModal onClose={() => setShowEditProfile(false)} />}
    </>
  )
}
