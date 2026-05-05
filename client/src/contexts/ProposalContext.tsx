import { createContext, useContext, useEffect, useState } from 'react'
import { useSocket } from './SocketContext'
import api from '../services/api'

const ProposalContext = createContext(0)

export function ProposalProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)
  const { socket } = useSocket()

  useEffect(() => {
    let cancelled = false
    function refresh() {
      api.get('/recurring/proposals').then(r => { if (!cancelled) setCount(r.data.length) }).catch(() => {})
    }
    refresh()
    const iv = setInterval(refresh, 5 * 60 * 1000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  useEffect(() => {
    if (!socket) return
    function refresh() {
      api.get('/recurring/proposals').then(r => setCount(r.data.length)).catch(() => {})
    }
    socket.on('proposals:changed', refresh)
    return () => { socket.off('proposals:changed', refresh) }
  }, [socket])

  return <ProposalContext.Provider value={count}>{children}</ProposalContext.Provider>
}

export const usePendingProposals = () => useContext(ProposalContext)
