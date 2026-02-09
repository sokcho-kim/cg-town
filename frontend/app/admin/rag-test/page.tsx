'use client'

import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import Link from 'next/link'

// ===== Types =====

interface ChatMessage {
  role: 'user' | 'npc'
  content: string
  route?: string
  intent?: string
  sources?: { source: string; content: string }[]
}

interface DocumentInfo {
  filename: string
  chunk_count: number
}

interface Settings {
  system_prompt: string
  chunk_size: number
  chunk_overlap: number
  embedding_model: string
  chat_model: string
  chat_temperature: number
  retrieval_k: number
  show_sources: boolean
}

// ===== Main Component =====

export default function HobiTrainerPage() {
  // Tab state
  const [leftTab, setLeftTab] = useState<'knowledge' | 'settings'>('knowledge')

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Knowledge base state
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [totalChunks, setTotalChunks] = useState(0)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)
  const [docContent, setDocContent] = useState('')
  const [docEditing, setDocEditing] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocContent, setNewDocContent] = useState('')
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)

  // Settings state
  const [settings, setSettings] = useState<Settings>({
    system_prompt: '',
    chunk_size: 500,
    chunk_overlap: 50,
    embedding_model: 'text-embedding-3-small',
    chat_model: 'gpt-4o-mini',
    chat_temperature: 0.3,
    retrieval_k: 3,
    show_sources: true,
  })
  const [settingsSaving, setSettingsSaving] = useState(false)

  // ===== Effects =====

  useEffect(() => {
    fetchDocuments()
    fetchSettings()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ===== API calls =====

  async function fetchDocuments() {
    try {
      const data = await api.get('/api/npc/documents')
      setDocuments(data.files || [])
      setTotalChunks(data.total_chunks || 0)
    } catch { /* ignore */ }
  }

  async function fetchSettings() {
    try {
      const data = await api.get('/api/npc/settings')
      setSettings(data)
    } catch { /* ignore */ }
  }

  async function fetchDocContent(filename: string) {
    try {
      const data = await api.get(`/api/npc/documents/${encodeURIComponent(filename)}`)
      setDocContent(data.content)
      setSelectedDoc(filename)
      setDocEditing(false)
    } catch { /* ignore */ }
  }

  async function handleSend() {
    const question = input.trim()
    if (!question || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const data = await api.post('/api/npc/chat', { message: question })
      setMessages((prev) => [
        ...prev,
        {
          role: 'npc',
          content: data.answer,
          route: data.route,
          intent: data.intent,
          sources: data.sources,
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'npc', content: `오류가 발생했습니다: ${err}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveDoc() {
    if (!selectedDoc) return
    try {
      await api.put(`/api/npc/documents/${encodeURIComponent(selectedDoc)}`, {
        title: selectedDoc,
        content: docContent,
      })
      setDocEditing(false)
      await fetchDocuments()
    } catch (err) {
      alert(`저장 실패: ${err}`)
    }
  }

  async function handleCreateDoc() {
    if (!newDocTitle.trim() || !newDocContent.trim()) return
    try {
      await api.post('/api/npc/documents', {
        title: newDocTitle.trim(),
        content: newDocContent,
      })
      setShowNewDoc(false)
      setNewDocTitle('')
      setNewDocContent('')
      await fetchDocuments()
    } catch (err) {
      alert(`생성 실패: ${err}`)
    }
  }

  async function handleDeleteDoc(filename: string) {
    if (!confirm(`"${filename}" 문서를 삭제하시겠습니까?`)) return
    try {
      await api.delete(`/api/npc/documents/${encodeURIComponent(filename)}`)
      if (selectedDoc === filename) {
        setSelectedDoc(null)
        setDocContent('')
      }
      await fetchDocuments()
    } catch (err) {
      alert(`삭제 실패: ${err}`)
    }
  }

  async function handleRebuildIndex() {
    if (rebuilding) return
    setRebuilding(true)
    try {
      const data = await api.post('/api/npc/rebuild-index', {})
      alert(data.message || '인덱스 재빌드 완료')
      await fetchDocuments()
    } catch (err) {
      alert(`재빌드 실패: ${err}`)
    } finally {
      setRebuilding(false)
    }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true)
    try {
      const data = await api.put('/api/npc/settings', settings)
      setSettings(data)
      alert('설정이 저장되었습니다.')
    } catch (err) {
      alert(`저장 실패: ${err}`)
    } finally {
      setSettingsSaving(false)
    }
  }

  // ===== Render =====

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* 헤더 - iHOPPER 스타일 */}
      <header className="text-center py-4 border-b bg-white">
        <h1 className="text-xl font-bold">
          호비 <span className="text-orange-500">AI</span> 트레이너
        </h1>
        <p className="text-sm text-blue-600">호비 똑똑하게 만들기</p>
        <div className="absolute right-6 top-4 flex gap-3 text-sm">
          <Link href="/" className="text-gray-500 hover:text-gray-900">게임</Link>
          <Link href="/dogam" className="text-gray-500 hover:text-gray-900">도감</Link>
        </div>
      </header>

      {/* 메인 2패널 */}
      <div className="flex-1 flex">
        {/* ===== 왼쪽 패널 ===== */}
        <div className="w-[480px] border-r bg-white flex flex-col">
          {/* 탭 바 */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[#1e2a3a]">
            <button
              onClick={() => setLeftTab('knowledge')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                leftTab === 'knowledge'
                  ? 'bg-white text-[#1e2a3a]'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              지식베이스
            </button>
            <button
              onClick={() => setLeftTab('settings')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                leftTab === 'settings'
                  ? 'bg-white text-[#1e2a3a]'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              설정
            </button>
          </div>

          {/* 탭 내용 */}
          <div className="flex-1 overflow-y-auto p-4">
            {leftTab === 'knowledge' ? (
              <KnowledgeBasePanel
                documents={documents}
                totalChunks={totalChunks}
                selectedDoc={selectedDoc}
                docContent={docContent}
                docEditing={docEditing}
                showNewDoc={showNewDoc}
                newDocTitle={newDocTitle}
                newDocContent={newDocContent}
                rebuilding={rebuilding}
                onSelectDoc={fetchDocContent}
                onSetDocContent={setDocContent}
                onSetDocEditing={setDocEditing}
                onSaveDoc={handleSaveDoc}
                onDeleteDoc={handleDeleteDoc}
                onSetShowNewDoc={setShowNewDoc}
                onSetNewDocTitle={setNewDocTitle}
                onSetNewDocContent={setNewDocContent}
                onCreateDoc={handleCreateDoc}
                onRebuildIndex={handleRebuildIndex}
              />
            ) : (
              <SettingsPanel
                settings={settings}
                saving={settingsSaving}
                onChange={setSettings}
                onSave={handleSaveSettings}
              />
            )}
          </div>
        </div>

        {/* ===== 오른쪽 패널 (대화) ===== */}
        <div className="flex-1 flex flex-col bg-white">
          {/* 대화 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1e2a3a] text-white">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMessages([])}
                className="text-sm flex items-center gap-1 text-gray-300 hover:text-white"
              >
                <span className="text-orange-400">+</span> 새 대화
              </button>
            </div>
            <span className="font-semibold">대화</span>
            <div className="w-20" />
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 && (
              <div className="text-gray-400 text-center mt-32">
                <div className="text-5xl mb-4 opacity-30">💬</div>
                <p>호비에게 질문해 보세요</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
                <div
                  className={`inline-block max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#1e2a3a] text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {msg.role === 'npc' && msg.route && (
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        msg.route === 'tag'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {msg.route.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">{msg.intent}</span>
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <details className="mt-2 text-left">
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                      참조 문서 ({msg.sources.length}개)
                    </summary>
                    <div className="mt-1 space-y-1">
                      {msg.sources.map((src, j) => (
                        <div key={j} className="text-xs bg-gray-50 border rounded p-2">
                          <span className="text-orange-600 font-medium">{src.source}</span>
                          <p className="text-gray-500 mt-1">{src.content}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}

            {loading && (
              <div className="mb-4">
                <div className="inline-block bg-gray-100 px-4 py-3 rounded-2xl">
                  <span className="animate-pulse text-gray-400 text-sm">호비가 생각하는 중...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="border-t p-4">
            <div className="flex items-center gap-2 bg-gray-50 border rounded-xl px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                placeholder="호비에게 질문하기..."
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-400"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="text-[#1e2a3a] disabled:text-gray-300 hover:text-orange-500 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== 지식베이스 패널 =====

function KnowledgeBasePanel({
  documents, totalChunks, selectedDoc, docContent, docEditing,
  showNewDoc, newDocTitle, newDocContent, rebuilding,
  onSelectDoc, onSetDocContent, onSetDocEditing, onSaveDoc, onDeleteDoc,
  onSetShowNewDoc, onSetNewDocTitle, onSetNewDocContent, onCreateDoc, onRebuildIndex,
}: {
  documents: DocumentInfo[]
  totalChunks: number
  selectedDoc: string | null
  docContent: string
  docEditing: boolean
  showNewDoc: boolean
  newDocTitle: string
  newDocContent: string
  rebuilding: boolean
  onSelectDoc: (f: string) => void
  onSetDocContent: (c: string) => void
  onSetDocEditing: (b: boolean) => void
  onSaveDoc: () => void
  onDeleteDoc: (f: string) => void
  onSetShowNewDoc: (b: boolean) => void
  onSetNewDocTitle: (t: string) => void
  onSetNewDocContent: (c: string) => void
  onCreateDoc: () => void
  onRebuildIndex: () => void
}) {
  return (
    <div className="space-y-4">
      {/* 문서 목록 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">문서 목록</h3>
          <p className="text-xs text-gray-400 mt-0.5">총 {totalChunks}개 청크</p>
        </div>
        <button
          onClick={() => onSetShowNewDoc(!showNewDoc)}
          className="text-xs bg-[#1e2a3a] text-white px-3 py-1.5 rounded-lg hover:bg-[#2a3a4e] transition-colors"
        >
          + 문서 추가
        </button>
      </div>

      {/* 새 문서 입력 */}
      {showNewDoc && (
        <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
          <input
            type="text"
            value={newDocTitle}
            onChange={(e) => onSetNewDocTitle(e.target.value)}
            placeholder="문서 제목 (예: 복리후생)"
            className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={newDocContent}
            onChange={(e) => onSetNewDocContent(e.target.value)}
            placeholder="문서 내용을 입력하세요..."
            rows={6}
            className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:border-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onCreateDoc}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              생성
            </button>
            <button
              onClick={() => onSetShowNewDoc(false)}
              className="text-xs bg-gray-200 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-300"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 문서 리스트 */}
      <div className="space-y-1">
        {documents.map((doc) => (
          <div
            key={doc.filename}
            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
              selectedDoc === doc.filename
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-gray-50'
            }`}
            onClick={() => onSelectDoc(doc.filename)}
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-400">📄</span>
              <span>{doc.filename}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{doc.chunk_count}청크</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteDoc(doc.filename) }}
                className="text-red-400 hover:text-red-600 text-xs"
              >
                삭제
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">등록된 문서가 없습니다</p>
        )}
      </div>

      {/* 문서 내용 보기/편집 */}
      {selectedDoc && (
        <div className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{selectedDoc}</h4>
            <div className="flex gap-2">
              {docEditing ? (
                <>
                  <button onClick={onSaveDoc} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">저장</button>
                  <button onClick={() => onSetDocEditing(false)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">취소</button>
                </>
              ) : (
                <button onClick={() => onSetDocEditing(true)} className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded hover:bg-gray-300">편집</button>
              )}
            </div>
          </div>
          {docEditing ? (
            <textarea
              value={docContent}
              onChange={(e) => onSetDocContent(e.target.value)}
              rows={12}
              className="w-full text-sm border rounded px-3 py-2 focus:outline-none focus:border-blue-500 resize-none font-mono"
            />
          ) : (
            <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap">
              {docContent}
            </pre>
          )}
        </div>
      )}

      {/* 인덱스 재빌드 */}
      <button
        onClick={onRebuildIndex}
        disabled={rebuilding}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white text-sm px-4 py-2.5 rounded-lg transition-colors font-medium"
      >
        {rebuilding ? '재빌드 중...' : '인덱스 재빌드'}
      </button>
    </div>
  )
}

// ===== 설정 패널 =====

function SettingsPanel({
  settings, saving, onChange, onSave,
}: {
  settings: Settings
  saving: boolean
  onChange: (s: Settings) => void
  onSave: () => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-sm mb-1">RAG 설정</h3>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <span>ℹ️</span> 설정 변경 후 인덱스 재빌드가 필요할 수 있습니다
        </p>
      </div>

      {/* 검색 결과 수 (TOP-K) */}
      <div>
        <label className="text-sm font-medium text-gray-700">검색 결과 수 (TOP-K)</label>
        <input
          type="number"
          min={1}
          max={20}
          value={settings.retrieval_k}
          onChange={(e) => onChange({ ...settings, retrieval_k: parseInt(e.target.value) || 3 })}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">RAG에 사용할 문서 청크 개수 (1-20)</p>
      </div>

      {/* 청크 사이즈 */}
      <div>
        <label className="text-sm font-medium text-gray-700">청크 사이즈</label>
        <input
          type="number"
          min={100}
          max={2000}
          value={settings.chunk_size}
          onChange={(e) => onChange({ ...settings, chunk_size: parseInt(e.target.value) || 500 })}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">문서 분할 시 청크 크기 (100-2000자)</p>
      </div>

      {/* 청크 오버랩 */}
      <div>
        <label className="text-sm font-medium text-gray-700">청크 오버랩</label>
        <input
          type="number"
          min={0}
          max={500}
          value={settings.chunk_overlap}
          onChange={(e) => onChange({ ...settings, chunk_overlap: parseInt(e.target.value) || 50 })}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
        />
        <p className="text-xs text-gray-400 mt-1">인접 청크 간 겹침 크기 (0-500자)</p>
      </div>

      {/* 챗 모델 */}
      <div>
        <label className="text-sm font-medium text-gray-700">챗 모델</label>
        <select
          value={settings.chat_model}
          onChange={(e) => onChange({ ...settings, chat_model: e.target.value })}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
        >
          <option value="gpt-4o-mini">gpt-4o-mini (빠르고 저렴)</option>
          <option value="gpt-4o">gpt-4o (고성능)</option>
          <option value="gpt-4-turbo">gpt-4-turbo</option>
          <option value="gpt-3.5-turbo">gpt-3.5-turbo (가장 저렴)</option>
        </select>
      </div>

      {/* 임베딩 모델 */}
      <div>
        <label className="text-sm font-medium text-gray-700">임베딩 모델</label>
        <select
          value={settings.embedding_model}
          onChange={(e) => onChange({ ...settings, embedding_model: e.target.value })}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:border-blue-500"
        >
          <option value="text-embedding-3-small">text-embedding-3-small (저렴)</option>
          <option value="text-embedding-3-large">text-embedding-3-large (고성능)</option>
          <option value="text-embedding-ada-002">text-embedding-ada-002 (레거시)</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">변경 시 인덱스 재빌드 필요</p>
      </div>

      {/* Temperature 슬라이더 */}
      <div>
        <label className="text-sm font-medium text-gray-700">Temperature</label>
        <div className="flex items-center gap-3 mt-1">
          <input
            type="range"
            min={0}
            max={100}
            value={settings.chat_temperature * 100}
            onChange={(e) => onChange({ ...settings, chat_temperature: parseInt(e.target.value) / 100 })}
            className="flex-1"
          />
          <span className="text-sm font-mono w-10 text-right">{settings.chat_temperature.toFixed(2)}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">낮을수록 사실 기반, 높을수록 창의적</p>
      </div>

      {/* 시스템 프롬프트 */}
      <div>
        <label className="text-sm font-medium text-gray-700">시스템 프롬프트</label>
        <textarea
          value={settings.system_prompt}
          onChange={(e) => onChange({ ...settings, system_prompt: e.target.value })}
          rows={6}
          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-blue-50 border-blue-200 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* 출처 표시 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">출처 표시</span>
          <p className="text-xs text-gray-400">답변에 참조된 문서 출처 포함</p>
        </div>
        <button
          onClick={() => onChange({ ...settings, show_sources: !settings.show_sources })}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            settings.show_sources ? 'bg-blue-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              settings.show_sources ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={onSave}
        disabled={saving}
        className="w-full bg-[#1e2a3a] hover:bg-[#2a3a4e] disabled:bg-gray-300 text-white text-sm px-4 py-2.5 rounded-lg transition-colors font-medium"
      >
        {saving ? '저장 중...' : '설정 저장'}
      </button>
    </div>
  )
}
