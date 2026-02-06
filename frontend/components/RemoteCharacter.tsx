'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { TILE_SIZE } from '@/lib/gameConfig'

interface RemoteCharacterProps {
  userId: string
  name: string
  gridX: number
  gridY: number
  direction: string
  images: Record<string, string>
}

export default function RemoteCharacter({ userId, name, gridX, gridY, direction, images }: RemoteCharacterProps) {
  const targetPixel = { x: gridX * TILE_SIZE, y: gridY * TILE_SIZE }
  const [displayPos, setDisplayPos] = useState(targetPixel)
  const targetPos = useRef(targetPixel)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    targetPos.current = { x: gridX * TILE_SIZE, y: gridY * TILE_SIZE }
  }, [gridX, gridY])

  useEffect(() => {
    const animate = () => {
      setDisplayPos(prev => {
        const dx = targetPos.current.x - prev.x
        const dy = targetPos.current.y - prev.y

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          return { x: targetPos.current.x, y: targetPos.current.y }
        }

        return {
          x: prev.x + dx * 0.25,
          y: prev.y + dy * 0.25
        }
      })
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  const currentImage = images[direction] || images['default']
  const charOffset = (100 - TILE_SIZE) / 2

  return (
    <div
      className="character"
      style={{
        left: `${displayPos.x - charOffset}px`,
        top: `${displayPos.y - charOffset}px`,
      }}
    >
      <Image src={currentImage} alt={name} width={100} height={100} priority />
      <div style={{
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 'bold',
        color: 'white',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        marginTop: '-5px'
      }}>
        {name}
      </div>
    </div>
  )
}
