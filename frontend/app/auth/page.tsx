'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Supabase 에러 메시지를 사용자 친화적인 한국어로 변환
function getErrorMessage(error: string): string {
  if (error.includes('Invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (error.includes('Email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.'
  }
  return error
}

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/')
      router.refresh()
    } catch (error: any) {
      const errorMsg = error.message || '오류가 발생했습니다.'
      setMessage(getErrorMessage(errorMsg))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4"
      style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', padding: '16px' }}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8"
        style={{ width: '100%', maxWidth: '28rem', backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: '32px' }}
      >
        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1
            className="text-3xl font-bold text-gray-900 mb-2"
            style={{ fontSize: '1.875rem', fontWeight: 700, color: '#111827', marginBottom: '8px' }}
          >
            로그인
          </h1>
          <p
            className="text-gray-500"
            style={{ color: '#6B7280' }}
          >
            CG Town에 오신 것을 환영합니다
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 이메일 */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '8px' }}
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* 비밀번호 */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
              style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: '8px' }}
            >
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          {/* 에러/성공 메시지 */}
          {message && (
            <p
              style={{
                fontSize: '0.875rem',
                textAlign: 'center',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#FEF2F2',
                color: '#DC2626'
              }}
            >
              {message}
            </p>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
            style={{
              width: '100%',
              backgroundColor: '#2563EB',
              color: 'white',
              fontWeight: 600,
              padding: '12px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
              fontSize: '1rem'
            }}
          >
            {loading ? '처리 중...' : '로그인'}
          </button>
        </form>

        {/* 회원가입 링크 */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <p style={{ color: '#6B7280' }}>
            계정이 없으신가요?{' '}
            <Link
              href="/auth/signup"
              style={{
                color: '#2563EB',
                fontWeight: 500,
                textDecoration: 'underline'
              }}
            >
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
