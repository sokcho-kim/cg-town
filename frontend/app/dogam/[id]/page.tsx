'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCharacterImageUrl, getEmailPrefix } from '@/lib/gameConfig'
import Link from 'next/link'

const DIRECTIONS = ['default', 'front', 'back', 'left', 'right'] as const
const DIRECTION_LABELS: Record<string, string> = {
  default: '기본포즈',
  front: '정면',
  back: '뒷모습',
  left: '왼쪽',
  right: '오른쪽',
}

interface Profile {
  id: string
  email: string
  username: string
  department: string
  position: string
  field: string
  project: string
  projects: string[]
  tmi: string
  tech_stack: string[]
  status_message: string
  is_admin: boolean
}

export default function DogamDetailPage() {
  const params = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Slider state
  const [activeSlide, setActiveSlide] = useState(0)

  // Image editor modal state
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [dirMapping, setDirMapping] = useState<Record<string, string>>({
    default: 'default',
    front: 'front',
    back: 'back',
    left: 'left',
    right: 'right',
  })
  const [swapping, setSwapping] = useState(false)
  const [cacheBust, setCacheBust] = useState('')

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()

      // Get current authenticated user + admin check
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: me } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        if (me?.is_admin) setIsAdmin(true)
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', params.id)
        .single()
      if (data) setProfile(data)
      setLoading(false)
    }
    if (params.id) fetchProfile()
  }, [params.id])

  // Auto-rotate slider every 3 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % DIRECTIONS.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const isOwnProfile = currentUserId === profile?.id
  const canEdit = isOwnProfile || isAdmin

  // Resolve projects
  const resolvedProjects: string[] = profile
    ? Array.isArray(profile.projects) && profile.projects.length > 0
      ? profile.projects
      : profile.project
        ? [profile.project]
        : []
    : []

  const emailPrefix = profile?.email ? getEmailPrefix(profile.email) : ''

  // Image URL with cache busting
  const getImgUrl = useCallback((dir: string) => {
    const url = getCharacterImageUrl(emailPrefix, dir)
    return cacheBust ? `${url}?t=${cacheBust}` : url
  }, [emailPrefix, cacheBust])

  // Direction remapping handlers
  const handleDirChange = (currentDir: string, newDir: string) => {
    setDirMapping((prev) => {
      const updated = { ...prev }
      // Find conflicting slot and swap
      const conflicting = Object.entries(updated).find(([k, v]) => v === newDir && k !== currentDir)
      if (conflicting) {
        updated[conflicting[0]] = updated[currentDir]
      }
      updated[currentDir] = newDir
      return updated
    })
  }

  const hasChanges = Object.entries(dirMapping).some(([k, v]) => k !== v)

  const handleSwap = async () => {
    if (!profile?.email) return
    setSwapping(true)
    try {
      const supabase = createClient()
      const prefix = getEmailPrefix(profile.email)

      // Step 1: Download all 5 images as blobs
      const downloads: Record<string, Blob> = {}
      for (const dir of DIRECTIONS) {
        const { data, error } = await supabase.storage
          .from('characters')
          .download(`${prefix}/${dir}.png`)
        if (error) throw new Error(`${dir} 다운로드 실패: ${error.message}`)
        downloads[dir] = data
      }

      // Step 2: Re-upload each blob to its new direction path
      for (const [originalDir, targetDir] of Object.entries(dirMapping)) {
        if (originalDir === targetDir) continue
        const blob = downloads[originalDir]
        const { error } = await supabase.storage
          .from('characters')
          .upload(`${prefix}/${targetDir}.png`, blob, {
            contentType: 'image/png',
            upsert: true,
          })
        if (error) throw new Error(`${targetDir} 업로드 실패: ${error.message}`)
      }

      // Reset mapping and bust cache
      setDirMapping({
        default: 'default', front: 'front', back: 'back', left: 'left', right: 'right',
      })
      setCacheBust(Date.now().toString())
      setShowImageEditor(false)
    } catch (err) {
      alert('이미지 교체 실패: ' + (err as Error).message)
    } finally {
      setSwapping(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center gap-4">
        <p className="text-white text-lg">프로필을 찾을 수 없습니다</p>
        <Link href="/dogam" className="text-indigo-400 hover:underline">
          도감으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button + Edit buttons */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dogam"
            className="inline-flex items-center text-gray-400 hover:text-white transition"
          >
            &larr; 도감 목록
          </Link>

          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowImageEditor(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"
              >
                이미지 편집
              </button>
              <Link
                href={isOwnProfile ? '/dogam/edit' : `/dogam/edit?id=${profile.id}`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
              >
                프로필 편집
              </Link>
            </div>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-[#16213e] rounded-2xl border border-gray-800 overflow-hidden">
          {/* Top Section: Character Slider + Name */}
          <div className="bg-gradient-to-b from-indigo-900/30 to-transparent p-8 flex flex-col items-center">

            {/* Character Image Slider */}
            <div className="relative mb-4">
              <div className="w-48 h-48 bg-[#0f3460]/30 rounded-2xl flex items-center justify-center overflow-hidden">
                {emailPrefix ? (
                  <img
                    key={`${DIRECTIONS[activeSlide]}-${cacheBust}`}
                    src={getImgUrl(DIRECTIONS[activeSlide])}
                    alt={`${profile.username} - ${DIRECTION_LABELS[DIRECTIONS[activeSlide]]}`}
                    className="w-3/4 h-3/4 object-contain"
                    style={{ imageRendering: 'pixelated' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="text-6xl">&#x1F464;</div>
                )}
              </div>

              {/* Direction label */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 rounded text-xs text-white">
                {DIRECTION_LABELS[DIRECTIONS[activeSlide]]}
              </div>
            </div>

            {/* Dot indicators */}
            <div className="flex justify-center gap-2 mb-4">
              {DIRECTIONS.map((dir, i) => (
                <button
                  key={dir}
                  onClick={() => setActiveSlide(i)}
                  className={`w-2.5 h-2.5 rounded-full transition ${
                    i === activeSlide ? 'bg-indigo-400 scale-110' : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>

            <h1 className="text-2xl font-bold text-white">
              {profile.username || '이름 없음'}
            </h1>

            {/* Status Message */}
            {profile.status_message && (
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-gray-300 text-sm italic">
                  {profile.status_message}
                </span>
              </div>
            )}

            {/* Badges: Department, Position, Field */}
            <div className="flex gap-2 mt-3 flex-wrap justify-center">
              {profile.department && (
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm">
                  {profile.department}
                </span>
              )}
              {profile.position && (
                <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm">
                  {profile.position}
                </span>
              )}
              {profile.field && (
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm">
                  {profile.field}
                </span>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="p-6 space-y-6">
            {/* Projects */}
            {resolvedProjects.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-2">현재 프로젝트</h3>
                <div className="flex flex-wrap gap-2">
                  {resolvedProjects.map((proj, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm"
                    >
                      {proj}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tech Stack */}
            {profile.tech_stack && profile.tech_stack.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-2">기술스택</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.tech_stack.map((tech, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-lg text-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* TMI */}
            {profile.tmi && (
              <div>
                <h3 className="text-gray-400 text-sm font-medium mb-2">TMI</h3>
                <div className="bg-[#0f3460]/20 rounded-xl p-4 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {profile.tmi}
                </div>
              </div>
            )}

            {/* No info yet */}
            {!profile.tmi && (!profile.tech_stack || profile.tech_stack.length === 0) && resolvedProjects.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <p>아직 작성된 정보가 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Editor Modal */}
      {showImageEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#16213e] rounded-2xl border border-gray-800 p-6 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-white">이미지 방향 편집</h2>
              <button
                onClick={() => {
                  setShowImageEditor(false)
                  setDirMapping({ default: 'default', front: 'front', back: 'back', left: 'left', right: 'right' })
                }}
                className="text-gray-400 hover:text-white text-xl"
              >
                &times;
              </button>
            </div>

            {/* 5 images grid */}
            <div className="grid grid-cols-5 gap-4">
              {DIRECTIONS.map((dir) => (
                <div key={dir} className="flex flex-col items-center">
                  <div className="w-full aspect-[1/2] bg-[#0f3460]/30 rounded-lg flex items-center justify-center overflow-hidden mb-2">
                    <img
                      src={getImgUrl(dir)}
                      alt={dir}
                      className="w-full h-full object-contain"
                      style={{ imageRendering: 'pixelated' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 mb-1">현재: {DIRECTION_LABELS[dir]}</span>
                  <select
                    value={dirMapping[dir]}
                    onChange={(e) => handleDirChange(dir, e.target.value)}
                    className="w-full bg-gray-800 text-white text-xs rounded px-2 py-1.5 border border-gray-700 focus:border-indigo-500 focus:outline-none"
                  >
                    {DIRECTIONS.map((d) => (
                      <option key={d} value={d}>{DIRECTION_LABELS[d]}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Save button */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowImageEditor(false)
                  setDirMapping({ default: 'default', front: 'front', back: 'back', left: 'left', right: 'right' })
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition"
              >
                취소
              </button>
              <button
                onClick={handleSwap}
                disabled={swapping || !hasChanges}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {swapping ? '저장 중...' : '방향 매핑 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
