'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px' }}>
            문제가 발생했습니다
          </h2>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: '#2563EB',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
