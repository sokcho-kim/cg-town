'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { createClient } from '@/lib/supabase/client'
import { getEmailPrefix, NPC_POSITIONS } from '@/lib/gameConfig'
import NpcChat from '@/components/NpcChat'

// PhaserGame 컴포넌트를 dynamic import로 로드 (SSR 비활성화)
const PhaserGame = dynamic(() => import('@/components/PhaserGame'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#ffffff',
        color: '#E8852C',
        fontSize: '18px',
      }}
    >
      사무실로 가는 중...
    </div>
  ),
})

interface NpcProfile {
  id: string
  email: string
  username: string
  status_message: string | null
}

export default function Home() {
  const router = useRouter()

  // 멀티플레이어 훅 사용
  const { remotePlayers, isConnected, sendPosition, myName, myEmailPrefix, myStatusMessage, myGridPos } = useMultiplayer()

  // NPC 프로필 + 대화 상태
  const [npcProfiles, setNpcProfiles] = useState<NpcProfile[]>([])
  const [chatNpc, setChatNpc] = useState<{ npcId: string; npcName: string } | null>(null)

  // NPC 프로필 로드
  useEffect(() => {
    async function fetchNpcs() {
      const supabase = createClient()
      const { data } = await supabase
        .from('profiles')
        .select('id, email, username, status_message')
        .eq('is_npc', true)
      if (data) setNpcProfiles(data)
    }
    fetchNpcs()
  }, [])

  // NPC를 remotePlayers 형태로 변환 + 합성
  const allPlayers = useMemo(() => {
    const npcEntries: Record<string, {
      user_info: { id: string; email: string; email_prefix: string; name: string; status_message?: string; is_npc?: boolean }
      position: { gridX: number; gridY: number; direction: string }
    }> = {}

    npcProfiles.forEach((npc, i) => {
      const emailPrefix = getEmailPrefix(npc.email)
      const pos = NPC_POSITIONS[emailPrefix] || { x: 20 + i, y: 3 }
      npcEntries[`npc_${npc.id}`] = {
        user_info: {
          id: npc.id,
          email: npc.email,
          email_prefix: emailPrefix,
          name: npc.username,
          status_message: npc.status_message || '',
          is_npc: true,
        },
        position: {
          gridX: pos.x,
          gridY: pos.y,
          direction: 'down',
        },
      }
    })

    return { ...remotePlayers, ...npcEntries }
  }, [remotePlayers, npcProfiles])

  // NPC 대화 이벤트 핸들링 (EventBus는 SSR 방지를 위해 dynamic import)
  useEffect(() => {
    let cleanup: (() => void) | undefined
    import('@/lib/EventBus').then(({ EventBus, GameEvents }) => {
      const handleNpcInteract = (data: { npcId: string; npcName: string }) => {
        setChatNpc(data)
        EventBus.emit(GameEvents.CHAT_OPEN, true)
      }
      EventBus.on(GameEvents.NPC_INTERACT, handleNpcInteract)
      cleanup = () => { EventBus.off(GameEvents.NPC_INTERACT, handleNpcInteract) }
    })
    return () => { cleanup?.() }
  }, [])

  const handleCloseChat = useCallback(() => {
    setChatNpc(null)
    import('@/lib/EventBus').then(({ EventBus, GameEvents }) => {
      EventBus.emit(GameEvents.CHAT_OPEN, false)
    })
  }, [])

  // 로그아웃 핸들러
  const handleLogout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }, [router])

  // 플레이어 위치 변경 핸들러 (Phaser -> WebSocket)
  const handlePositionChange = useCallback(
    (gridX: number, gridY: number, direction: string) => {
      sendPosition(gridX, gridY, direction)
    },
    [sendPosition]
  )

  return (
    <>
      {/* 상단 우측 고정 UI: 연결 상태 + 로그아웃 */}
      <div
        style={{
          position: 'fixed',
          top: 6,
          right: 6,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          maxWidth: 'calc(100vw - 12px)',
        }}
      >
        {/* 연결 상태 표시 */}
        <div
          style={{
            padding: '3px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            backgroundColor: isConnected ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)',
            color: 'white',
            whiteSpace: 'nowrap',
          }}
        >
          {isConnected ? `온라인 (${Object.keys(remotePlayers).length + 1}명)` : '연결 중...'}
        </div>

        {/* 도감 버튼 */}
        <button
          onClick={() => router.push('/dogam')}
          style={{
            padding: '3px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            backgroundColor: 'rgba(59,130,246,0.8)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(37,99,235,0.9)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.8)')}
        >
          도감
        </button>

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          style={{
            padding: '3px 8px',
            borderRadius: '10px',
            fontSize: '11px',
            backgroundColor: 'rgba(220,38,38,0.8)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(185,28,28,0.9)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(220,38,38,0.8)')}
        >
          로그아웃
        </button>
      </div>

      {/* Phaser 게임 컴포넌트 */}
      <PhaserGame
        remotePlayers={allPlayers}
        isConnected={isConnected}
        myName={myName}
        myEmailPrefix={myEmailPrefix}
        myStatusMessage={myStatusMessage}
        myGridPos={myGridPos}
        onPositionChange={handlePositionChange}
      />

      {/* NPC 대화창 */}
      {chatNpc && (
        <NpcChat npcName={chatNpc.npcName} onClose={handleCloseChat} />
      )}
    </>
  )
}
