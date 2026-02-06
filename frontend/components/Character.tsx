'use client'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from '@/lib/gameConfig'

type Direction = 'up' | 'down' | 'left' | 'right' | 'default'

interface CharacterImages {
  default: string
  up: string
  down: string
  left: string
  right: string
}

interface CharacterProps {
  images: CharacterImages
  initialGridX?: number
  initialGridY?: number
  name?: string
  onPositionChange?: (gridX: number, gridY: number, direction: Direction) => void
}

export default function Character({
  images,
  initialGridX = 5,
  initialGridY = 5,
  name,
  onPositionChange,
}: CharacterProps) {
  const [gridPos, setGridPos] = useState({ x: initialGridX, y: initialGridY })
  const [displayPos, setDisplayPos] = useState({ x: initialGridX * TILE_SIZE, y: initialGridY * TILE_SIZE })
  const [direction, setDirection] = useState<Direction>('default')

  const isMoving = useRef(false)
  const animFrameRef = useRef<number | null>(null)
  const targetPixelPos = useRef({ x: initialGridX * TILE_SIZE, y: initialGridY * TILE_SIZE })
  const onPositionChangeRef = useRef(onPositionChange)
  const keysPressed = useRef<Set<string>>(new Set())
  const lastKeyRef = useRef<string>('')

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  // Update initialGridX/Y when they change (e.g., from server init)
  useEffect(() => {
    setGridPos({ x: initialGridX, y: initialGridY })
    const px = initialGridX * TILE_SIZE
    const py = initialGridY * TILE_SIZE
    setDisplayPos({ x: px, y: py })
    targetPixelPos.current = { x: px, y: py }
  }, [initialGridX, initialGridY])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setDisplayPos(prev => {
        const dx = targetPixelPos.current.x - prev.x
        const dy = targetPixelPos.current.y - prev.y

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          isMoving.current = false
          // If keys still held, trigger next move
          if (keysPressed.current.size > 0) {
            setTimeout(tryMove, 0)
          }
          return { x: targetPixelPos.current.x, y: targetPixelPos.current.y }
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

  // Move in the direction of the last pressed key only
  const tryMove = () => {
    if (isMoving.current) return

    const lastKey = lastKeyRef.current
    if (!lastKey || !keysPressed.current.has(lastKey)) return

    setGridPos(prev => {
      let newX = prev.x
      let newY = prev.y
      let newDir: Direction = 'default'

      switch (lastKey) {
        case 'ArrowUp':
          newY = Math.max(0, prev.y - 1)
          newDir = 'up'
          break
        case 'ArrowDown':
          newY = Math.min(GRID_HEIGHT - 1, prev.y + 1)
          newDir = 'down'
          break
        case 'ArrowLeft':
          newX = Math.max(0, prev.x - 1)
          newDir = 'left'
          break
        case 'ArrowRight':
          newX = Math.min(GRID_WIDTH - 1, prev.x + 1)
          newDir = 'right'
          break
      }

      setDirection(newDir)

      if (newX !== prev.x || newY !== prev.y) {
        isMoving.current = true
        targetPixelPos.current = { x: newX * TILE_SIZE, y: newY * TILE_SIZE }
        onPositionChangeRef.current?.(newX, newY, newDir)
      }

      return { x: newX, y: newY }
    })
  }

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space key: switch to default pose
      if (e.key === ' ') {
        e.preventDefault()
        setDirection('default')
        setGridPos(prev => {
          onPositionChangeRef.current?.(prev.x, prev.y, 'default')
          return prev
        })
        return
      }
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      e.preventDefault()
      keysPressed.current.add(e.key)
      lastKeyRef.current = e.key
      tryMove()
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const currentImage = images[direction]

  // Center character (100px) on tile (64px): offset = (100 - 64) / 2 = 18
  const charOffset = (100 - TILE_SIZE) / 2

  return (
    <div
      className="character"
      style={{
        left: `${displayPos.x - charOffset}px`,
        top: `${displayPos.y - charOffset}px`,
      }}
    >
      <Image src={currentImage} alt="character" width={100} height={100} priority />
      {name && (
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
      )}
    </div>
  )
}
