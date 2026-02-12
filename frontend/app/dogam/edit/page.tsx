'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Profile {
  id: string
  username: string
  department: string
  position: string
  field: string
  projects: string[]
  tmi: string
  tech_stack: string[]
  status_message: string
}

export default function DogamEditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><p className="text-gray-900 text-lg">Loading...</p></div>}>
      <DogamEditContent />
    </Suspense>
  )
}

function DogamEditContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetId = searchParams.get('id') // 관리자가 다른 유저 편집 시
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [techInput, setTechInput] = useState('')
  const [projectInput, setProjectInput] = useState('')

  // 폼 상태
  const [field, setField] = useState('')
  const [projects, setProjects] = useState<string[]>([])
  const [tmi, setTmi] = useState('')
  const [techStack, setTechStack] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState('')

  // 원본 값 (변경 감지용)
  const [original, setOriginal] = useState<{
    field: string
    project: string
    tmi: string
    tech_stack: string[]
    status_message: string
  } | null>(null)

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      // 관리자가 다른 유저 편집하는 경우
      let profileId = user.id
      if (targetId) {
        const { data: me } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        if (me?.is_admin) {
          profileId = targetId
        }
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single()

      if (data) {
        setProfile(data)
        setField(data.field || '')
        const parsedProjects = (data.project && typeof data.project === 'string')
          ? data.project.split(', ').filter(Boolean)
          : []
        setProjects(parsedProjects)
        setTmi(data.tmi || '')
        setTechStack(data.tech_stack || [])
        setStatusMessage(data.status_message || '')

        // 원본 스냅샷 저장 — 저장 시 변경된 필드만 UPDATE
        setOriginal({
          field: data.field || '',
          project: parsedProjects.join(', '),
          tmi: data.tmi || '',
          tech_stack: data.tech_stack || [],
          status_message: data.status_message || '',
        })
      }
      setLoading(false)
    }
    fetchProfile()
  }, [router, targetId])

  const handleSave = async () => {
    if (!profile || !original) return
    setSaving(true)

    // 변경된 필드만 수집 — 안 바꾼 필드는 건드리지 않음
    const updates: Record<string, unknown> = {}
    const projectStr = projects.join(', ')

    if (field !== original.field) updates.field = field
    if (projectStr !== original.project) updates.project = projectStr
    if (tmi !== original.tmi) updates.tmi = tmi
    if (JSON.stringify(techStack) !== JSON.stringify(original.tech_stack)) updates.tech_stack = techStack
    if (statusMessage !== original.status_message) updates.status_message = statusMessage

    if (Object.keys(updates).length === 0) {
      setSaving(false)
      router.push(`/dogam/${profile.id}`)
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)

    if (error) {
      alert('저장 실패: ' + error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    router.push(`/dogam/${profile.id}`)
  }

  // Tech stack tag helpers
  const addTech = () => {
    const trimmed = techInput.trim()
    if (trimmed && !techStack.includes(trimmed)) {
      setTechStack([...techStack, trimmed])
      setTechInput('')
    }
  }

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech))
  }

  const handleTechKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTech()
    }
  }

  // Project tag helpers
  const addProject = () => {
    const trimmed = projectInput.trim()
    if (trimmed && !projects.includes(trimmed)) {
      setProjects([...projects, trimmed])
      setProjectInput('')
    }
  }

  const removeProject = (proj: string) => {
    setProjects(projects.filter((p) => p !== proj))
  }

  const handleProjectKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addProject()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-900 text-lg">Loading...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <p className="text-gray-900 text-lg">프로필을 찾을 수 없습니다</p>
        <Link href="/auth" className="text-[#E8852C] hover:underline">
          로그인하기
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Link
          href="/dogam"
          className="inline-flex items-center text-gray-500 hover:text-gray-900 transition mb-6"
        >
          &larr; 도감 목록
        </Link>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-6">
            내 프로필 편집
          </h1>

          {/* Name, Department, Position (read-only) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div>
              <label className="text-gray-500 text-sm block mb-1">이름</label>
              <div className="bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm">
                {profile.username}
              </div>
            </div>
            <div>
              <label className="text-gray-500 text-sm block mb-1">부서</label>
              <div className="bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm">
                {profile.department || '-'}
              </div>
            </div>
            <div>
              <label className="text-gray-500 text-sm block mb-1">직급</label>
              <div className="bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm">
                {profile.position || '-'}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="mb-4">
            <label className="text-gray-500 text-sm block mb-1">상태 메시지</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="예: 휴가 중, 외근, 파견 - 게임 내 머리 위에 표시됩니다"
              maxLength={30}
              className="w-full bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-300 focus:border-[#E8852C] focus:outline-none"
            />
            <p className="text-gray-400 text-xs mt-1">
              {statusMessage.length}/30
            </p>
          </div>

          {/* Field */}
          <div className="mb-4">
            <label className="text-gray-500 text-sm block mb-1">분야</label>
            <input
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="예: 프론트엔드 개발, UX 디자인, PM"
              className="w-full bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-300 focus:border-[#E8852C] focus:outline-none"
            />
          </div>

          {/* Projects (tag input) */}
          <div className="mb-4">
            <label className="text-gray-500 text-sm block mb-1">현재 프로젝트</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {projects.map((proj, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-700 rounded-lg text-sm"
                >
                  {proj}
                  <button
                    onClick={() => removeProject(proj)}
                    className="text-cyan-500 hover:text-cyan-800 ml-1"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={projectInput}
                onChange={(e) => setProjectInput(e.target.value)}
                onKeyDown={handleProjectKeyDown}
                placeholder="프로젝트명 입력 후 Enter"
                className="flex-1 bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-300 focus:border-[#E8852C] focus:outline-none"
              />
              <button
                onClick={addProject}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                추가
              </button>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="mb-4">
            <label className="text-gray-500 text-sm block mb-1">기술스택</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {techStack.map((tech, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#E8852C]/10 text-[#E8852C] rounded-lg text-sm"
                >
                  {tech}
                  <button
                    onClick={() => removeTech(tech)}
                    className="text-[#E8852C]/60 hover:text-[#E8852C] ml-1"
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={handleTechKeyDown}
                placeholder="기술명 입력 후 Enter"
                className="flex-1 bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-300 focus:border-[#E8852C] focus:outline-none"
              />
              <button
                onClick={addTech}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
              >
                추가
              </button>
            </div>
          </div>

          {/* TMI */}
          <div className="mb-6">
            <label className="text-gray-500 text-sm block mb-1">
              TMI
              <span className="text-gray-400 ml-2">
                온오프라인 어디서든 후속 질문을 할 수 있는 TMI를 적어주세요!
              </span>
            </label>
            <textarea
              value={tmi}
              onChange={(e) => setTmi(e.target.value)}
              rows={8}
              placeholder={`예:\n1. 주말엔 겨울잠 핑계로 16시간씩 자는 프로 집순이\n2. 커피보다는 차를 좋아합니다\n3. 자전거 타는거 좋아해요!`}
              className="w-full bg-gray-50 text-gray-900 px-3 py-2 rounded-lg text-sm border border-gray-300 focus:border-[#E8852C] focus:outline-none resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex gap-3 justify-end">
            <Link
              href="/dogam"
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition"
            >
              취소
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-[#E8852C] text-white rounded-lg text-sm hover:bg-[#D4741F] transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
