'use client'
import { useCallback } from 'react'
import Character from '@/components/Character'
import RemoteCharacter from '@/components/RemoteCharacter'
import { useMultiplayer } from '@/hooks/useMultiplayer'

const eunbinImages = {
  default: '/images/charactor/eunbin/eunbin_default .png',
  up: '/images/charactor/eunbin/eunbin_back.png',
  down: '/images/charactor/eunbin/eunbin_front.png',
  left: '/images/charactor/eunbin/eunbin_left.png',
  right: '/images/charactor/eunbin/eunbin_right.png',
}

export default function Home() {
  const { remotePlayers, isConnected, sendPosition, myName, myGridPos } = useMultiplayer()

  const handlePositionChange = useCallback((gridX: number, gridY: number, direction: string) => {
    sendPosition(gridX, gridY, direction)
  }, [sendPosition])

  return (
    <main className="game-wrapper">
      <div className="game-background" style={{ backgroundImage: 'url(/images/main_home.png)' }} />

      <div style={{
        position: 'fixed', top: 10, right: 10, zIndex: 100,
        padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
        backgroundColor: isConnected ? 'rgba(34,197,94,0.8)' : 'rgba(239,68,68,0.8)',
        color: 'white'
      }}>
        {isConnected ? `온라인 (${Object.keys(remotePlayers).length + 1}명)` : '연결 중...'}
      </div>

      {myGridPos && (
        <Character
          images={eunbinImages}
          initialGridX={myGridPos.x}
          initialGridY={myGridPos.y}
          onPositionChange={handlePositionChange}
          name={myName}
        />
      )}

      {Object.entries(remotePlayers).map(([userId, player]) => (
        <RemoteCharacter
          key={userId}
          userId={userId}
          name={player.user_info.name}
          gridX={player.position.gridX}
          gridY={player.position.gridY}
          direction={player.position.direction}
          images={eunbinImages}
        />
      ))}
    </main>
  )
}
