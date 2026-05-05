import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'

interface SocketContextType {
  socket: Socket | null
}

const SocketContext = createContext<SocketContextType>({ socket: null })

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!user || !token) { socket?.disconnect(); setSocket(null); return }

    const s = io(import.meta.env.VITE_API_URL || undefined, { auth: { token } })
    setSocket(s)
    return () => { s.disconnect() }
  }, [user])

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>
}

export const useSocket = () => useContext(SocketContext)
