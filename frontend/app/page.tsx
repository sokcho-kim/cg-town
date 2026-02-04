import Character from '@/components/Character'

const eunbinImages = {
  default: '/images/charactor/eunbin/eunbin_default .png',
  up: '/images/charactor/eunbin/eunbin_back.png',
  down: '/images/charactor/eunbin/eunbin_front.png',
  left: '/images/charactor/eunbin/eunbin_left.png',
  right: '/images/charactor/eunbin/eunbin_right.png',
}

export default function Home() {
  return (
    <main className="game-wrapper">
      <div
        className="game-background"
        style={{ backgroundImage: 'url(/images/main_home.png)' }}
      />
      <Character images={eunbinImages} initialX={400} initialY={300} />
    </main>
  )
}
