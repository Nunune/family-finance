import { NavLink } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePendingProposals } from '../../contexts/ProposalContext'

export default function BottomNav() {
  const { user } = useAuth()
  const pending = usePendingProposals()

  const links = [
    { to: '/', icon: '🏠', label: 'Tổng quan', end: true },
    { to: '/personal', icon: '👤', label: 'Cá nhân', end: false },
    ...(user?.familyId ? [{ to: '/shared', icon: '🏦', label: 'Quỹ chung', end: false }] : []),
    { to: '/family', icon: '👨‍👩‍👧', label: 'Gia đình', end: false },
    { to: '/plans', icon: '📋', label: 'Kế hoạch', end: false, badge: pending },
    { to: '/budget', icon: '💰', label: 'Ngân sách', end: false },
    { to: '/categories', icon: '📊', label: 'Danh mục', end: false },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 sm:hidden safe-area-bottom">
      <div className="flex items-stretch">
        {links.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 relative transition-colors ${
                isActive ? 'text-emerald-600' : 'text-gray-400 active:text-gray-600'
              }`
            }
          >
            <span className="text-xl leading-none">{link.icon}</span>
            <span className="text-[10px] mt-0.5 leading-none font-medium">{link.label}</span>
            {(link.badge ?? 0) > 0 && (
              <span className="absolute top-1 right-[calc(50%-18px)] min-w-[16px] h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {link.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
