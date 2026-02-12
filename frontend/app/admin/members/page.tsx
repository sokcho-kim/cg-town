'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface User {
  id: string
  username: string
  department: string
  position: string
  status_message: string
  is_admin: boolean
}

const DEPARTMENTS = ['AI', '경영', '기획', '서비스개발', '연구소']
const POSITIONS = ['CEO', 'CTO', '이사', '소장', '부소장', '팀장', '대리', '사원', '연구원']

export default function AdminMembersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // 신규 등록 폼
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    email: '',
    username: '',
    department: DEPARTMENTS[0],
    position: '',
    status_message: '',
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  async function checkAdminAndFetch() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth')
      return
    }

    const { data: me } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!me?.is_admin) {
      router.push('/')
      return
    }

    setIsAdmin(true)
    await fetchUsers()
    setLoading(false)
  }

  async function fetchUsers() {
    try {
      const data = await api.get('/api/admin/users')
      setUsers(data.users || [])
    } catch {
      /* ignore */
    }
  }

  async function handleCreate() {
    if (!form.email.trim() || !form.username.trim()) {
      alert('이메일과 이름은 필수입니다.')
      return
    }
    setSubmitting(true)
    try {
      const result = await api.post('/api/admin/users', form)
      alert(`${result.message}\n초기 비밀번호: ${result.default_password}`)
      setShowForm(false)
      setForm({ email: '', username: '', department: DEPARTMENTS[0], position: '', status_message: '' })
      await fetchUsers()
    } catch (err) {
      alert(`등록 실패: ${err}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(user: User) {
    if (!confirm(`${user.username}님의 비밀번호를 초기화하시겠습니까?`)) return
    try {
      const result = await api.post(`/api/admin/users/${user.id}/reset-password`, {})
      alert(result.message)
    } catch (err) {
      alert(`실패: ${err}`)
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`정말 ${user.username}님을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    try {
      await api.delete(`/api/admin/users/${user.id}`)
      await fetchUsers()
    } catch (err) {
      alert(`삭제 실패: ${err}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!isAdmin) return null

  // 부서별 그룹핑
  const grouped: Record<string, User[]> = {}
  for (const u of users) {
    const dept = u.department || '미지정'
    if (!grouped[dept]) grouped[dept] = []
    grouped[dept].push(u)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">&larr; 게임</Link>
              <Link href="/admin/hop-e" className="text-gray-400 hover:text-gray-600 text-sm">호비 트레이너</Link>
            </div>
            <h1 className="text-xl font-bold text-gray-900">사원 관리</h1>
            <p className="text-sm text-gray-500 mt-1">총 {users.length}명</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-[#E8852C] text-white text-sm rounded-lg hover:bg-[#D4741F] transition font-medium"
          >
            + 신규 사원 등록
          </button>
        </div>

        {/* 신규 등록 폼 */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">신규 사원 등록</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">이름 *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="홍길동"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#E8852C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">이메일 *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@ihopper.co.kr"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#E8852C] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">부서</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#E8852C] focus:outline-none"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">직급</label>
                <select
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#E8852C] focus:outline-none"
                >
                  <option value="">선택</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-600 block mb-1">상태 메시지</label>
                <input
                  type="text"
                  value={form.status_message}
                  onChange={(e) => setForm({ ...form, status_message: e.target.value })}
                  placeholder="예: 🐶 강아지"
                  maxLength={30}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#E8852C] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                취소
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-4 py-2 text-sm text-white bg-[#E8852C] rounded-lg hover:bg-[#D4741F] disabled:opacity-50"
              >
                {submitting ? '등록 중...' : '등록'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              초기 비밀번호: CgTown2026! (사원이 첫 로그인 후 변경)
            </p>
          </div>
        )}

        {/* 부서별 사원 목록 */}
        {Object.entries(grouped).sort().map(([dept, members]) => (
          <div key={dept} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 mb-2">
              {dept} <span className="text-gray-400 font-normal">({members.length}명)</span>
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {members.map((user, i) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i < members.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{user.username}</span>
                      {user.position && (
                        <span className="text-xs text-gray-400 ml-2">{user.position}</span>
                      )}
                      {user.is_admin && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded ml-2">관리자</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {user.status_message && (
                      <span className="text-xs text-gray-400 max-w-[150px] truncate">
                        {user.status_message}
                      </span>
                    )}
                    <button
                      onClick={() => handleResetPassword(user)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      비번초기화
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
