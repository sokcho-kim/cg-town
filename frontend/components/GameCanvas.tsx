'use client'

import { useEffect, useRef } from 'react'

interface GameCanvasProps {
  backgroundSrc: string
}

export default function GameCanvas({ backgroundSrc }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const backgroundImage = new Image()
    backgroundImage.src = backgroundSrc

    const resizeCanvas = () => {
      // 캔버스 크기를 화면 크기에 맞춤
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      // 픽셀 아트 스타일을 위해 이미지 스무딩 비활성화
      ctx.imageSmoothingEnabled = false

      // 배경을 화면에 꽉 차게 그리기
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
    }

    backgroundImage.onload = () => {
      resizeCanvas()
    }

    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [backgroundSrc])

  return (
    <div className="game-container">
      <canvas
        ref={canvasRef}
        className="game-canvas"
      />
    </div>
  )
}
