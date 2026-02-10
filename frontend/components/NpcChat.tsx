'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface NpcChatProps {
  npcName: string
  onClose: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function NpcChat({ npcName, onClose }: NpcChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: `안녕하세요! 저는 ${npcName}입니다. 무엇이든 물어보세요!` },
  ])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 스크롤 맨 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 열릴 때 인풋 포커스
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // ESC로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setIsStreaming(true)

    // 어시스턴트 빈 메시지 추가 (스트리밍 용)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: '인증이 필요합니다. 다시 로그인해주세요.' }
          return updated
        })
        setIsStreaming(false)
        return
      }

      const response = await fetch(`${API_URL}/api/npc/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let buffer = ''
      let fullAnswer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'tag_result' && event.data?.answer) {
              // TAG 경로 (직원수, 메뉴 등 즉시 응답)
              fullAnswer = event.data.answer
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullAnswer }
                return updated
              })
            } else if (event.type === 'token' && (event.token || event.content)) {
              fullAnswer += event.token || event.content
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullAnswer }
                return updated
              })
            } else if (event.type === 'complete' && event.answer) {
              fullAnswer = event.answer
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullAnswer }
                return updated
              })
            } else if (event.type === 'error') {
              fullAnswer = event.error || '오류가 발생했습니다.'
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: fullAnswer }
                return updated
              })
            }
          } catch {
            // JSON 파싱 실패 무시
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `연결 오류: ${(err as Error).message}`,
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: 400,
        zIndex: 300,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#E8852C',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 'bold' }}>{npcName}</span>
          <span style={{ fontSize: 11, opacity: 0.8 }}>NPC</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: 20,
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          &times;
        </button>
      </div>

      {/* 메시지 목록 */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                ...(msg.role === 'user'
                  ? { backgroundColor: '#E8852C', color: 'white', borderBottomRightRadius: 4 }
                  : { backgroundColor: '#f3f4f6', color: '#1f2937', borderBottomLeftRadius: 4 }),
              }}
            >
              {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${npcName}에게 질문하기...`}
          disabled={isStreaming}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #d1d5db',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: isStreaming || !input.trim() ? '#d1d5db' : '#E8852C',
            color: 'white',
            fontSize: 13,
            cursor: isStreaming || !input.trim() ? 'default' : 'pointer',
          }}
        >
          전송
        </button>
      </div>
    </div>
  )
}
