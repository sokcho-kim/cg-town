'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCharacterImageUrl, getEmailPrefix } from '@/lib/gameConfig'
import Link from 'next/link'

interface Profile {
  id: string
  email: string
  username: string
  department: string
  position: string
  field: string
  project: string
  tmi: string
  tech_stack: string[]
  is_npc: boolean
}

const TAB_ALL = '전체'
const TAB_NPC = 'NPC'

// 부서 순서 (탭 + 정렬용)
const DEPT_ORDER = ['경영', '기획', '연구소', 'AI', '서비스개발']

// 직급 순서 (높은 직급이 먼저)
const POSITION_ORDER = ['CEO', 'CTO', '이사', '소장', '부소장', '팀장', '대리', '연구원', '사원']

function sortProfiles(profiles: Profile[]): Profile[] {
  return [...profiles].sort((a, b) => {
    // 1. 부서 순서
    const deptA = DEPT_ORDER.indexOf(a.department)
    const deptB = DEPT_ORDER.indexOf(b.department)
    const dA = deptA === -1 ? 999 : deptA
    const dB = deptB === -1 ? 999 : deptB
    if (dA !== dB) return dA - dB

    // 2. 직급 순서
    const posA = POSITION_ORDER.indexOf(a.position)
    const posB = POSITION_ORDER.indexOf(b.position)
    const pA = posA === -1 ? 999 : posA
    const pB = posB === -1 ? 999 : posB
    if (pA !== pB) return pA - pB

    // 3. 이름 가나다순
    return (a.username || '').localeCompare(b.username || '', 'ko')
  })
}

export default function DogamPage() {
  const router = useRouter()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>(TAB_ALL)

  useEffect(() => {
    async function fetchProfiles() {
      const supabase = createClient()
      const { data } = await supabase.from('profiles').select('*')
      if (data) setProfiles(data)
      setLoading(false)
    }
    fetchProfiles()
  }, [])

  // Split profiles into human and NPC groups
  const humanProfiles = useMemo(
    () => profiles.filter((p) => !p.is_npc),
    [profiles]
  )
  const npcProfiles = useMemo(
    () => profiles.filter((p) => p.is_npc),
    [profiles]
  )

  // Extract unique departments from human profiles (고정 순서)
  const departments = useMemo(() => {
    const existing = new Set(humanProfiles.map((p) => p.department).filter(Boolean))
    return DEPT_ORDER.filter((d) => existing.has(d))
  }, [humanProfiles])

  // Build ordered tab list: 전체, ...departments, NPC (if any)
  const tabs = useMemo(() => {
    const list = [TAB_ALL, ...departments]
    if (npcProfiles.length > 0) list.push(TAB_NPC)
    return list
  }, [departments, npcProfiles])

  // Filtered + sorted profiles based on active tab
  const filteredProfiles = useMemo(() => {
    if (activeTab === TAB_ALL) return sortProfiles([...humanProfiles, ...npcProfiles])
    if (activeTab === TAB_NPC) return npcProfiles
    return sortProfiles(humanProfiles.filter((p) => p.department === activeTab))
  }, [activeTab, humanProfiles, npcProfiles])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-900 text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">CG Inside 직원 도감</h1>
            <p className="text-gray-500 text-sm sm:text-base mt-1">우리 팀원을 소개합니다</p>
          </div>
          <div className="flex gap-2 sm:gap-3 flex-wrap">
            <Link
              href="/dogam/edit"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#E8852C] text-white rounded-lg hover:bg-[#D4741F] transition text-xs sm:text-sm"
            >
              내 프로필 편집
            </Link>
            <Link
              href="/"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-xs sm:text-sm"
            >
              사무실로 가기
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-xs sm:text-sm"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Department Tabs */}
        <div className="mb-4 sm:mb-6 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1.5 sm:gap-2 min-w-max pb-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition ${
                  activeTab === tab
                    ? 'bg-[#E8852C] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredProfiles.map((profile) => (
            <Link
              key={profile.id}
              href={`/dogam/${profile.id}`}
              className="group bg-white rounded-xl p-4 hover:bg-gray-50 transition border border-gray-200 hover:border-[#E8852C]/50"
            >
              {/* Character Image */}
              <div className="aspect-[3/4] bg-gray-100 rounded-lg mb-3 relative overflow-hidden">
                {profile.email ? (
                  <img
                    src={getCharacterImageUrl(getEmailPrefix(profile.email), 'front')}
                    alt={profile.username}
                    className="absolute inset-0 w-full h-full object-contain object-bottom"
                    style={{ imageRendering: 'pixelated' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-4xl">👤</div>
                )}
              </div>

              {/* Info */}
              <h3 className="text-gray-900 font-semibold text-center truncate">
                {profile.username || '이름 없음'}
              </h3>
              <p className="text-gray-500 text-xs text-center mt-1 truncate">
                {profile.department || ''}
              </p>
              {profile.field && (
                <p className="text-[#E8852C] text-xs text-center mt-1 truncate">
                  {profile.field}
                </p>
              )}
            </Link>
          ))}
        </div>

        {filteredProfiles.length === 0 && (
          <div className="text-center text-gray-400 py-20">
            <p className="text-lg">
              {activeTab === TAB_NPC
                ? '등록된 NPC가 없습니다'
                : activeTab === TAB_ALL
                  ? '등록된 직원이 없습니다'
                  : `${activeTab} 부서에 등록된 직원이 없습니다`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
