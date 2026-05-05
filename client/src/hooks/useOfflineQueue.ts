import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { WalletType } from '../types'

export interface QueuedTx {
  idempotencyKey: string
  data: {
    amount: number
    type: string
    date: string
    note: string
    categoryId: string
    walletType: WalletType
  }
  queuedAt: string
  status: 'pending' | 'syncing' | 'failed'
  failReason?: string
}

const QUEUE_KEY = 'ff_offline_queue'

function loadQueue(): QueuedTx[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') }
  catch { return [] }
}

function saveQueue(q: QueuedTx[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function useOfflineQueue(onSynced?: () => void) {
  const [queue, setQueue] = useState<QueuedTx[]>(loadQueue)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const lastSyncRef = useRef<number>(0)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const sync = useCallback(async () => {
    const current = loadQueue()
    const pending = current.filter(q => q.status === 'pending')
    if (!pending.length) return

    for (const item of pending) {
      const updated = loadQueue()
      const idx = updated.findIndex(q => q.idempotencyKey === item.idempotencyKey)
      if (idx === -1) continue

      updated[idx].status = 'syncing'
      saveQueue(updated)
      setQueue([...updated])

      try {
        await api.post('/transactions', item.data, {
          headers: { 'Idempotency-Key': item.idempotencyKey },
        })
        const after = loadQueue().filter(q => q.idempotencyKey !== item.idempotencyKey)
        saveQueue(after)
        setQueue([...after])
        onSynced?.()
      } catch (err: any) {
        // 409 = đã xử lý rồi (idempotent) → cũng xóa khỏi queue
        if (err.response?.status === 409) {
          const after = loadQueue().filter(q => q.idempotencyKey !== item.idempotencyKey)
          saveQueue(after)
          setQueue([...after])
          onSynced?.()
          continue
        }
        const after = loadQueue()
        const i = after.findIndex(q => q.idempotencyKey === item.idempotencyKey)
        if (i !== -1) { after[i].status = 'failed'; after[i].failReason = err.message }
        saveQueue(after)
        setQueue([...after])
      }
    }
  }, [onSynced])

  const debouncedSync = useCallback(() => {
    const now = Date.now()
    if (now - lastSyncRef.current < 2000) {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      syncTimerRef.current = setTimeout(() => { lastSyncRef.current = Date.now(); sync() }, 2000)
      return
    }
    lastSyncRef.current = now
    sync()
  }, [sync])

  // Auto-sync khi có mạng trở lại
  useEffect(() => {
    if (isOnline) debouncedSync()
  }, [isOnline, debouncedSync])

  function enqueue(item: Omit<QueuedTx, 'queuedAt' | 'status'>): void {
    const entry: QueuedTx = { ...item, queuedAt: new Date().toISOString(), status: 'pending' }
    const updated = [...loadQueue(), entry]
    saveQueue(updated)
    setQueue(updated)

    if (isOnline) debouncedSync()
  }

  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'syncing').length
  const failedCount = queue.filter(q => q.status === 'failed').length

  function retryFailed() {
    const updated = loadQueue().map(q => q.status === 'failed' ? { ...q, status: 'pending' as const } : q)
    saveQueue(updated)
    setQueue(updated)
    sync()
  }

  return { enqueue, pendingCount, failedCount, retryFailed, isOnline, queue }
}
