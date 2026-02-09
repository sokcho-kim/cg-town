'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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

  useEffect(() => {
    async function fetchMyProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setField(data.field || '')
        // Support legacy single-string project field and new array projects field
        if (Array.isArray(data.projects)) {
          setProjects(data.projects)
        } else if (data.project && typeof data.project === 'string') {
          setProjects(data.project ? [data.project] : [])
        } else {
          setProjects([])
        }
        setTmi(data.tmi || '')
        setTechStack(data.tech_stack || [])
        setStatusMessage(data.status_message || '')
      }
      setLoading(false)
    }
    fetchMyProfile()
  }, [router])

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    const supabase = createClient()
    await supabase
      .from('profiles')
      .update({
        field,
        projects,
        tmi,
        tech_stack: techStack,
        status_message: statusMessage,
      })
      .eq('id', profile.id)

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
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex flex-col items-center justify-center gap-4">
        <p className="text-white text-lg">프로필을 찾을 수 없습니다</p>
        <Link href="/auth" className="text-indigo-400 hover:underline">
          로그인하기
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] p-8">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Link
          href="/dogam"
          className="inline-flex items-center text-gray-400 hover:text-white transition mb-6"
        >
          &larr; 도감 목록
        </Link>

        <div className="bg-[#16213e] rounded-2xl border border-gray-800 p-6">
          <h1 className="text-xl font-bold text-white mb-6">
            내 프로필 편집
          </h1>

          {/* Name, Department, Position (read-only) */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-gray-400 text-sm block mb-1">이름</label>
              <div className="bg-gray-800/50 text-gray-300 px-3 py-2 rounded-lg text-sm">
                {profile.username}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">부서</label>
              <div className="bg-gray-800/50 text-gray-300 px-3 py-2 rounded-lg text-sm">
                {profile.department || '-'}
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm block mb-1">직급</label>
              <div className="bg-gray-800/50 text-gray-300 px-3 py-2 rounded-lg text-sm">
                {profile.position || '-'}
              </div>
            </div>
          </div>

          {/* Status Message */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-1">상태 메시지</label>
            <input
              type="text"
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="예: 휴가 중, 외근, 파견 - 게임 내 머리 위에 표시됩니다"
              maxLength={30}
              className="w-full bg-gray-800/50 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-gray-600 text-xs mt-1">
              {statusMessage.length}/30
            </p>
          </div>

          {/* Field */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-1">분야</label>
            <input
              type="text"
              value={field}
              onChange={(e) => setField(e.target.value)}
              placeholder="예: 프론트엔드 개발, UX 디자인, PM"
              className="w-full bg-gray-800/50 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Projects (tag input) */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-1">현재 프로젝트</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {projects.map((proj, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm"
                >
                  {proj}
                  <button
                    onClick={() => removeProject(proj)}
                    className="text-cyan-400 hover:text-white ml-1"
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
                className="flex-1 bg-gray-800/50 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={addProject}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
              >
                추가
              </button>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm block mb-1">기술스택</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {techStack.map((tech, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm"
                >
                  {tech}
                  <button
                    onClick={() => removeTech(tech)}
                    className="text-indigo-400 hover:text-white ml-1"
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
                className="flex-1 bg-gray-800/50 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={addTech}
                className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600"
              >
                추가
              </button>
            </div>
          </div>

          {/* TMI */}
          <div className="mb-6">
            <label className="text-gray-400 text-sm block mb-1">
              TMI
              <span className="text-gray-600 ml-2">
                온오프라인 어디서든 후속 질문을 할 수 있는 TMI를 적어주세요!
              </span>
            </label>
            <textarea
              value={tmi}
              onChange={(e) => setTmi(e.target.value)}
              rows={8}
              placeholder={`예:\n1. 주말엔 겨울잠 핑계로 16시간씩 자는 프로 집순이\n2. 커피보다는 차를 좋아합니다\n3. 자전거 타는거 좋아해요!`}
              className="w-full bg-gray-800/50 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Save Button */}
          <div className="flex gap-3 justify-end">
            <Link
              href="/dogam"
              className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-600 transition"
            >
              취소
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
