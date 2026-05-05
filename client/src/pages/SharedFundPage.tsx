import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import WalletPage from './WalletPage'
import SubFundWalletPage from './SubFundWalletPage'
import type { SubFund } from '../types'

export default function SharedFundPage() {
  const { user } = useAuth()
  const [subFunds, setSubFunds] = useState<SubFund[]>([])
  const [activeTab, setActiveTab] = useState<'MAIN' | string>('MAIN')

  useEffect(() => {
    if (user?.familyId) {
      api.get('/sub-funds').then(r => setSubFunds(r.data)).catch(() => {})
    }
  }, [user?.familyId])

  if (!user?.familyId) return <Navigate to="/family" />

  const activeFund = subFunds.find(f => f.id === activeTab)

  return (
    <div>
      {/* Tab strip — chỉ hiện khi có quỹ phụ */}
      {subFunds.length > 0 && (
        <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 pt-2 pb-0">
          <div className="flex gap-1 overflow-x-auto scrollbar-none max-w-2xl mx-auto">
            <button
              onClick={() => setActiveTab('MAIN')}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
                activeTab === 'MAIN'
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🏦 Quỹ chính
            </button>
            {subFunds.map(fund => (
              <button
                key={fund.id}
                onClick={() => setActiveTab(fund.id)}
                className={`shrink-0 px-4 py-2 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
                  activeTab === fund.id
                    ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {fund.icon} {fund.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'MAIN' || !activeFund
        ? <WalletPage walletType="SHARED" />
        : <SubFundWalletPage fund={activeFund} onFundUpdate={updated => setSubFunds(prev => prev.map(f => f.id === updated.id ? updated : f))} />
      }
    </div>
  )
}
