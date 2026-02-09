'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  projects: string[]
  tmi: string
  tech_stack: string[]
  status_message: string
}

export default function DogamDetailPage() {
  const params = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      const supabase = createClient()
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

  // Resolve projects: prefer new array field, fall back to legacy single string
  const resolvedProjects: string[] = profile
    ? Array.isArray(profile.projects) && profile.projects.length > 0
      ? profile.projects
      : profile.project
        ? [profile.project]
        : []
    : []

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
        {/* Back button */}
        <Link
          href="/dogam"
          className="inline-flex items-center text-gray-400 hover:text-white transition mb-6"
        >
          &larr; 도감 목록
        </Link>

        {/* Profile Card */}
        <div className="bg-[#16213e] rounded-2xl border border-gray-800 overflow-hidden">
          {/* Top Section: Character + Name */}
          <div className="bg-gradient-to-b from-indigo-900/30 to-transparent p-8 flex flex-col items-center">
            <div className="w-40 h-40 bg-[#0f3460]/30 rounded-2xl flex items-center justify-center mb-4">
              {profile.email ? (
                <img
                  src={getCharacterImageUrl(getEmailPrefix(profile.email), 'default')}
                  alt={profile.username}
                  className="w-3/4 h-3/4 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="text-6xl">&#x1F464;</div>
              )}
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
    </div>
  )
}
