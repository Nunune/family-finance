import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingProposals } from '../../contexts/ProposalContext'
import EditProfileModal from '../Auth/EditProfileModal'

export default function Navbar() {
  const { user, logout, logoutAll, tokenExpiring, dismissExpiryWarning } = useAuth()
  const navigate = useNavigate()
  const pendingProposals = usePendingProposals()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [fontScale, setFontScale] = useState(() => localStorage.getItem('fontScale') || 'md')

  function applyFontScale(scale: string) {
    const sizes: Record<string, string> = { sm: '14px', md: '16px', lg: '18px', xl: '20px' }
    document.documentElement.style.fontSize = sizes[scale] ?? '16px'
    localStorage.setItem('fontScale', scale)
    setFontScale(scale)
  }

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

          <div className="hidden sm:flex items-center gap-1">
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
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-1.5">Cỡ chữ</p>
                    <div className="flex gap-1">
                      {([
                        { key: 'sm', label: 'A', cls: 'text-xs' },
                        { key: 'md', label: 'A', cls: 'text-sm' },
                        { key: 'lg', label: 'A', cls: 'text-base' },
                        { key: 'xl', label: 'A', cls: 'text-lg' },
                      ] as const).map(({ key, label, cls }) => (
                        <button
                          key={key}
                          onClick={() => applyFontScale(key)}
                          className={`flex-1 py-1 rounded-lg font-bold leading-none transition ${cls} ${fontScale === key ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => { setShowUserMenu(false); setShowEditProfile(true) }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                    Chỉnh sửa hồ sơ
                  </button>
                  <button onClick={() => { setShowUserMenu(false); navigate('/categories') }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                    Quản lý danh mục
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
