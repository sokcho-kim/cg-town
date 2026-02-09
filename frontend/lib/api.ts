import { createClient } from '@/lib/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'API 요청 실패' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// Convenience methods
export const api = {
  get: (endpoint: string) => apiClient(endpoint),
  post: (endpoint: string, data: unknown) => apiClient(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint: string, data: unknown) => apiClient(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint: string) => apiClient(endpoint, { method: 'DELETE' }),
  upload: (endpoint: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient(endpoint, { method: 'POST', body: formData })
  },
}
