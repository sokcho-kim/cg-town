/** @type {import('next').NextConfig} */
const nextConfig = {
  // 이미지 최적화 설정 (Supabase Storage 사용 시)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
}

module.exports = nextConfig
