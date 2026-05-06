import { useEffect, useState } from 'react'
import { Debt, RecurringTransaction, TransactionProposal, FamilyMember, SavingsGoal, Hui } from '../types'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import DebtList from '../components/Debt/DebtList'
import DebtForm from '../components/Debt/DebtForm'
import RecurringList from '../components/Recurring/RecurringList'
import RecurringForm from '../components/Recurring/RecurringForm'
import ProposalCard from '../components/Recurring/ProposalCard'
import SavingsGoalList from '../components/Savings/SavingsGoalList'
import SavingsGoalForm from '../components/Savings/SavingsGoalForm'
import PlanItemList from '../components/Plan/PlanItemList'
import HuiList from '../components/Hui/HuiList'
import HuiForm from '../components/Hui/HuiForm'

type Tab = 'debts' | 'recurring' | 'proposals' | 'savings' | 'forecast' | 'hui'

export default function PlansPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('debts')

  const [debts, setDebts] = useState<Debt[]>([])
  const [recurrings, setRecurrings] = useState<RecurringTransaction[]>([])
  const [proposals, setProposals] = useState<TransactionProposal[]>([])
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | undefined>()
  const [huis, setHuis] = useState<Hui[]>([])
  const [showHuiForm, setShowHuiForm] = useState(false)

  const [showDebtForm, setShowDebtForm] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [showSavingsForm, setShowSavingsForm] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [dRes, rRes, pRes, sRes, hRes] = await Promise.all([
          api.get('/debts'),
          api.get('/recurring'),
          api.get('/recurring/proposals'),
          api.get('/savings'),
          api.get('/hui'),
        ])
        setDebts(dRes.data)
        setRecurrings(rRes.data)
        setProposals(pRes.data)
        setSavingsGoals(sRes.data)
        setHuis(hRes.data)

        if (user?.familyId) {
          const fRes = await api.get('/auth/family')
          setFamilyMembers(fRes.data?.members ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.familyId])

  const pendingCount = proposals.length

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'forecast', label: '📅 Dự thu/chi' },
    { key: 'savings', label: '🎯 Quỹ' },
    { key: 'hui', label: '🔄 Hụi' },
    { key: 'debts', label: 'Nợ & Vay' },
    { key: 'recurring', label: 'Định kỳ' },
    { key: 'proposals', label: 'Chờ XN', badge: pendingCount },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-800">Kế hoạch</h1>
        {tab === 'savings' && (
          <button onClick={() => { setEditingGoal(undefined); setShowSavingsForm(true) }}
            className="text-sm bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition">
            + Tạo quỹ
          </button>
        )}
        {tab === 'debts' && (
          <button onClick={() => setShowDebtForm(true)}
            className="text-sm bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition">
            + Thêm nợ
          </button>
        )}
        {tab === 'hui' && (
          <button onClick={() => setShowHuiForm(true)}
            className="text-sm bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition">
            + Thêm hụi
          </button>
        )}
        {tab === 'recurring' && (
          <button onClick={() => setShowRecurringForm(true)}
            className="text-sm bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition">
            + Thêm định kỳ
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition relative ${
              tab === t.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
            }`}>
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-300 text-3xl animate-pulse">⏳</div>
      ) : (
        <>
          {tab === 'forecast' && <PlanItemList />}

          {tab === 'hui' && (
            <HuiList
              huis={huis}
              onUpdate={h => setHuis(prev => prev.map(x => x.id === h.id ? h : x))}
              onDelete={id => setHuis(prev => prev.filter(x => x.id !== id))}
            />
          )}

          {tab === 'savings' && (
            <SavingsGoalList
              goals={savingsGoals}
              onUpdate={g => setSavingsGoals(prev => prev.map(x => x.id === g.id ? g : x))}
              onDelete={id => setSavingsGoals(prev => prev.filter(x => x.id !== id))}
              onEdit={g => { setEditingGoal(g); setShowSavingsForm(true) }}
            />
          )}

          {tab === 'debts' && (
            <DebtList
              debts={debts}
              userId={user!.id}
              onUpdate={updated => setDebts(prev => prev.map(d => d.id === updated.id ? updated : d))}
              onDelete={id => setDebts(prev => prev.filter(d => d.id !== id))}
              onBulkUpdate={updated => setDebts(prev => prev.map(d => updated.find(u => u.id === d.id) ?? d))}
            />
          )}

          {tab === 'recurring' && (
            <RecurringList
              items={recurrings}
              userId={user!.id}
              onUpdate={updated => setRecurrings(prev => prev.map(r => r.id === updated.id ? updated : r))}
              onDelete={id => setRecurrings(prev => prev.filter(r => r.id !== id))}
            />
          )}

          {tab === 'proposals' && (
            <div className="space-y-3">
              {proposals.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-4xl mb-2">✅</div>
                  <p className="text-sm">Không có giao dịch nào chờ xác nhận</p>
                </div>
              ) : (
                proposals.map(p => (
                  <ProposalCard
                    key={p.id}
                    proposal={p}
                    onConfirmed={id => setProposals(prev => prev.filter(x => x.id !== id))}
                    onDismissed={id => setProposals(prev => prev.filter(x => x.id !== id))}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {showDebtForm && (
        <DebtForm
          userId={user!.id}
          familyMembers={familyMembers}
          onSave={debt => { setDebts(prev => [debt, ...prev]); setShowDebtForm(false) }}
          onClose={() => setShowDebtForm(false)}
        />
      )}

      {showSavingsForm && (
        <SavingsGoalForm
          editing={editingGoal}
          onSave={goal => {
            setSavingsGoals(prev => editingGoal
              ? prev.map(x => x.id === goal.id ? goal : x)
              : [...prev, goal]
            )
            setShowSavingsForm(false)
            setEditingGoal(undefined)
          }}
          onClose={() => { setShowSavingsForm(false); setEditingGoal(undefined) }}
        />
      )}

      {showHuiForm && (
        <HuiForm
          onSaved={h => { setHuis(prev => [h, ...prev]); setShowHuiForm(false) }}
          onClose={() => setShowHuiForm(false)}
        />
      )}

      {showRecurringForm && (
        <RecurringForm
          hasFamilyWallet={!!user?.familyId}
          onSave={r => { setRecurrings(prev => [...prev, r]); setShowRecurringForm(false) }}
          onClose={() => setShowRecurringForm(false)}
        />
      )}
    </div>
  )
}
