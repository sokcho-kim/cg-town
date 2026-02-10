// 타일 및 그리드 설정
export const TILE_SIZE = 64
export const GRID_WIDTH = 24
export const GRID_HEIGHT = 12
export const MOVE_DURATION = 150 // ms for movement animation between tiles

// 맵 크기 설정 (2:1 비율)
export const MAP_WIDTH = 1536  // TILE_SIZE * GRID_WIDTH = 64 * 24
export const MAP_HEIGHT = 768  // TILE_SIZE * GRID_HEIGHT = 64 * 12

// 캐릭터 기본 크기
export const BASE_CHARACTER_SIZE = 100

// Supabase Storage 기반 캐릭터 이미지 URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

export function getEmailPrefix(email: string): string {
  return email.split('@')[0] || ''
}

// 이미지 정규화 후 CDN 캐시 무효화용 버전
const IMG_VERSION = '20260210g'

export function getCharacterImageUrl(emailPrefix: string, direction: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/characters/${emailPrefix}/${direction}.png?v=${IMG_VERSION}`
}
