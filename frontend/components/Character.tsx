'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

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
  initialX?: number
  initialY?: number
  speed?: number
}

export default function Character({
  images,
  initialX = 50,
  initialY = 50,
  speed = 5,
}: CharacterProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY })
  const [direction, setDirection] = useState<Direction>('default')

  const keysPressed = useRef<Set<string>>(new Set())
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const updatePosition = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }

    const deltaTime = (timestamp - lastTimeRef.current) / 16 // 60fps 기준 정규화
    lastTimeRef.current = timestamp

    const keys = keysPressed.current

    if (keys.size === 0) {
      setDirection('default')
      animationFrameRef.current = requestAnimationFrame(updatePosition)
      return
    }

    setPosition((prev) => {
      let newX = prev.x
      let newY = prev.y
      const moveSpeed = speed * deltaTime

      if (keys.has('ArrowUp')) {
        newY = Math.max(0, prev.y - moveSpeed)
        setDirection('up')
      }
      if (keys.has('ArrowDown')) {
        newY = Math.min(window.innerHeight - 100, prev.y + moveSpeed)
        setDirection('down')
      }
      if (keys.has('ArrowLeft')) {
        newX = Math.max(0, prev.x - moveSpeed)
        setDirection('left')
      }
      if (keys.has('ArrowRight')) {
        newX = Math.min(window.innerWidth - 100, prev.x + moveSpeed)
        setDirection('right')
      }

      return { x: newX, y: newY }
    })

    animationFrameRef.current = requestAnimationFrame(updatePosition)
  }, [speed])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        keysPressed.current.add(e.key)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key)
      if (keysPressed.current.size === 0) {
        setDirection('default')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // 애니메이션 루프 시작
    animationFrameRef.current = requestAnimationFrame(updatePosition)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [updatePosition])

  const currentImage = images[direction]

  return (
    <div
      className="character"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <Image
        src={currentImage}
        alt="character"
        width={100}
        height={100}
        priority
      />
    </div>
  )
}
