'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PlayerInfo {
  id: string
  email: string
  name: string
}

interface PlayerPosition {
  gridX: number
  gridY: number
  direction: string
}

interface RemotePlayer {
  user_info: PlayerInfo
  position: PlayerPosition
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export function useMultiplayer() {
  const [remotePlayers, setRemotePlayers] = useState<Record<string, RemotePlayer>>({})
  const [isConnected, setIsConnected] = useState(false)
  const [myName, setMyName] = useState<string>('')
  const [myGridPos, setMyGridPos] = useState<{ x: number; y: number } | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return

    setMyName(session.user?.user_metadata?.name || session.user?.email || '')

    const ws = new WebSocket(`${WS_URL}/ws?token=${session.access_token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'init':
          setRemotePlayers(data.players)
          if (data.your_position) {
            setMyGridPos({ x: data.your_position.gridX, y: data.your_position.gridY })
          }
          break
        case 'player_joined':
          setRemotePlayers(prev => ({
            ...prev,
            [data.user_id]: {
              user_info: data.user_info,
              position: data.position
            }
          }))
          break
        case 'player_left':
          setRemotePlayers(prev => {
            const next = { ...prev }
            delete next[data.user_id]
            return next
          })
          break
        case 'player_moved':
          setRemotePlayers(prev => ({
            ...prev,
            [data.user_id]: {
              ...prev[data.user_id],
              position: data.position
            }
          }))
          break
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      // Don't reconnect if auth failed (code 4001)
      if (event.code === 4001) {
        console.warn('WebSocket auth failed, not reconnecting')
        return
      }
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendPosition = useCallback((gridX: number, gridY: number, direction: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'move',
        gridX,
        gridY,
        direction
      }))
    }
  }, [])

  return { remotePlayers, isConnected, sendPosition, myName, myGridPos }
}
