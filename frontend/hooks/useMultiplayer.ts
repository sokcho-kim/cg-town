'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PlayerInfo {
  id: string
  email: string
  email_prefix: string
  name: string
  status_message?: string
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
  const [myEmailPrefix, setMyEmailPrefix] = useState<string>('')
  const [myStatusMessage, setMyStatusMessage] = useState<string>('')
  const [myGridPos, setMyGridPos] = useState<{ x: number; y: number } | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // React Strict Mode 중복 연결 방지를 위한 연결 상태 추적
  const isConnectingRef = useRef<boolean>(false)

  const connect = useCallback(async () => {
    // 이미 연결 중이거나 연결된 상태면 스킵 (Strict Mode 중복 호출 방지)
    if (isConnectingRef.current || wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return
    }
    isConnectingRef.current = true

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      isConnectingRef.current = false
      return
    }

    setMyName(session.user?.user_metadata?.username || session.user?.user_metadata?.name || session.user?.email || '')

    const ws = new WebSocket(`${WS_URL}/ws?token=${session.access_token}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      isConnectingRef.current = false
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'init':
          setRemotePlayers(data.players)
          if (data.your_position) {
            setMyGridPos({ x: data.your_position.gridX, y: data.your_position.gridY })
          }
          if (data.your_email_prefix) {
            setMyEmailPrefix(data.your_email_prefix)
          }
          if (data.your_status_message !== undefined) {
            setMyStatusMessage(data.your_status_message || '')
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
      isConnectingRef.current = false
      wsRef.current = null
      // 인증 실패 시 재연결 안 함 (code 4001)
      if (event.code === 4001) {
        console.warn('WebSocket auth failed, not reconnecting')
        return
      }
      // 3초 후 재연결
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    ws.onerror = () => {
      isConnectingRef.current = false
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

  return { remotePlayers, isConnected, sendPosition, myName, myEmailPrefix, myStatusMessage, myGridPos }
}
