'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as Phaser from 'phaser'
import { EventBus, GameEvents } from '@/lib/EventBus'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, getCharacterImageUrl } from '@/lib/gameConfig'

// 모바일 터치 D-pad 방향 (모듈 레벨 — Phaser update()에서 읽음)
let mobileDirection: string | null = null

// 원격 플레이어 타입 정의
interface PlayerPosition {
  gridX: number
  gridY: number
  direction: string
}

interface PlayerInfo {
  id: string
  email: string
  email_prefix: string
  name: string
  status_message?: string
}

interface RemotePlayer {
  user_info: PlayerInfo
  position: PlayerPosition
}

// PhaserGame 컴포넌트 Props
interface PhaserGameProps {
  remotePlayers: Record<string, RemotePlayer>
  isConnected: boolean
  myName: string
  myEmailPrefix: string
  myStatusMessage: string
  myGridPos: { x: number; y: number } | null
  onPositionChange: (gridX: number, gridY: number, direction: string) => void
}

// 게임 인스턴스 Ref 타입
export interface PhaserGameRef {
  game: Phaser.Game | null
  scene: Phaser.Scene | null
}

/**
 * 메인 게임 씬
 */
class MainScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.GameObjects.Sprite
  private playerNameText!: Phaser.GameObjects.Text
  private playerStatusText!: Phaser.GameObjects.Text
  private remotePlayerSprites: Map<string, Phaser.GameObjects.Container> = new Map()
  private gridX: number = 12
  private gridY: number = 6
  private isMoving: boolean = false
  private direction: string = 'down'
  private myName: string = ''
  private myEmailPrefix: string = ''
  private myStatusMessage: string = ''
  private loadedUsers: Set<string> = new Set()
  private isShutDown: boolean = false

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    this.load.tilemapTiledJSON('tilemap', '/maps/main.json')

    this.load.image('grass', '/images/sprout-lands/tilesets/Grass.png')
    this.load.image('water', '/images/sprout-lands/tilesets/Water.png')
    this.load.image('stone_path', '/images/sprout-lands/tilesets/Stone_Path.png')
    this.load.image('fences', '/images/sprout-lands/tilesets/Fences.png')
    this.load.image('hills', '/images/sprout-lands/tilesets/Hills.png')
    this.load.image('trees', '/images/sprout-lands/objects/Trees_stumps_bushes.png')
    this.load.image('grass_biom', '/images/sprout-lands/objects/Basic_Grass_Biom_things.png')
    this.load.image('mushrooms_flowers', '/images/sprout-lands/objects/Mushrooms_Flowers_Stones.png')
    this.load.image('farm_tileset', '/images/sprout-lands/tilesets/free_sample_tileset.png')
    this.load.image('coastal_furniture', '/images/sprout-lands/objects/coastal_furnitureset_withshadow.png')
    this.load.image('office', '/images/office/office_tileset.png')

    if (!this.textures.exists('__DEFAULT')) {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      this.textures.addCanvas('__DEFAULT', canvas)
    }

    this.loadUserAssets('default')
  }

  private loadUserAssets(username: string) {
    if (!username || this.loadedUsers.has(username)) return
    this.loadedUsers.add(username)

    const directions = ['front', 'back', 'left', 'right', 'default']
    directions.forEach((dir) => {
      const key = `${username}_${dir}`
      const url = username === 'default'
        ? `/images/characters/default/${dir}.png`
        : getCharacterImageUrl(username, dir)
      this.load.image(key, url)
    })
  }

  create() {
    const map = this.make.tilemap({ key: 'tilemap' })

    const grassTileset = map.addTilesetImage('grass', 'grass')
    const waterTileset = map.addTilesetImage('water', 'water')
    const stonePathTileset = map.addTilesetImage('stone_path', 'stone_path')
    const fencesTileset = map.addTilesetImage('fences', 'fences')
    const hillsTileset = map.addTilesetImage('hills', 'hills')
    const treesTileset = map.addTilesetImage('trees', 'trees')
    const grassBiomTileset = map.addTilesetImage('grass_biom', 'grass_biom')
    const mushroomsTileset = map.addTilesetImage('mushrooms_flowers', 'mushrooms_flowers')
    const farmTileset = map.addTilesetImage('farm_tileset', 'farm_tileset')
    const coastalTileset = map.addTilesetImage('coastal_furniture', 'coastal_furniture')
    const officeTileset = map.addTilesetImage('office', 'office')

    const allTilesets = [
      grassTileset, waterTileset, stonePathTileset, fencesTileset,
      hillsTileset, treesTileset, grassBiomTileset, mushroomsTileset, farmTileset, coastalTileset, officeTileset
    ].filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null)

    const groundLayer = map.createLayer('ground', allTilesets, 0, 0)
    groundLayer?.setDepth(-10)

    const officeChairLayer = map.createLayer('office chair', allTilesets, 0, 0)
    officeChairLayer?.setDepth(-9)

    const decoLayer = map.createLayer('deco', allTilesets, 0, 0)
    decoLayer?.setDepth(-8)

    const deco2Layer = map.createLayer('deco 2', allTilesets, 0, 0)
    deco2Layer?.setDepth(-7)

    // 카메라: 플레이어 추적 + 적응형 줌
    this.updateCameraFit()
    this.scale.on('resize', () => this.updateCameraFit())

    // 플레이어 스프라이트
    const initialTexture = this.textures.exists('default_front') ? 'default_front' : '__DEFAULT'
    this.player = this.add.sprite(
      this.gridX * TILE_SIZE + TILE_SIZE / 2,
      this.gridY * TILE_SIZE + TILE_SIZE / 2,
      initialTexture
    )
    this.player.setDisplaySize(TILE_SIZE, TILE_SIZE * 2)
    this.player.setOrigin(0.5, 0.75)
    this.player.setDepth(this.gridY)

    // 이름 텍스트
    this.playerNameText = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE * 1.5,
      this.myName,
      {
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      }
    )
    this.playerNameText.setOrigin(0.5, 1)
    this.playerNameText.setDepth(1000)

    // 상태 메시지 텍스트
    this.playerStatusText = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE * 1.5 + 14,
      this.myStatusMessage,
      {
        fontSize: '11px',
        color: '#fbbf24',
        stroke: '#000000',
        strokeThickness: 2,
        align: 'center',
      }
    )
    this.playerStatusText.setOrigin(0.5, 0)
    this.playerStatusText.setDepth(1000)

    // 카메라 플레이어 추적 시작
    const cam = this.cameras.main
    cam.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT)
    cam.startFollow(this.player, true, 0.1, 0.1)

    // 키보드 입력
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
    }

    this.setupEventListeners()

    this.events.on('shutdown', this.shutdown, this)
    this.events.on('destroy', this.shutdown, this)

    EventBus.emit(GameEvents.SCENE_READY, this)
  }

  private setupEventListeners() {
    EventBus.on(GameEvents.REMOTE_PLAYERS_UPDATE, this.handleRemotePlayersUpdate, this)
    EventBus.on(GameEvents.MY_INFO_UPDATE, this.handleMyInfoUpdate, this)
  }

  private handleMyInfoUpdate = (data: { name: string; emailPrefix: string; statusMessage: string; gridPos: { x: number; y: number } | null }) => {
    if (!this.sys || !this.scene || this.isShutDown) return

    this.myName = data.name || ''
    if (data.emailPrefix && data.emailPrefix !== this.myEmailPrefix) {
      this.myEmailPrefix = data.emailPrefix
      this.loadUserAssets(data.emailPrefix)
      this.load.once('complete', () => {
        if (this.player?.active) {
          this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))
          this.player.setVisible(true)
        }
      })
      this.load.start()
    } else if (data.emailPrefix && this.player) {
      const key = this.getTextureKey(this.myEmailPrefix, this.direction)
      if (this.textures.exists(key)) {
        this.player.setTexture(key)
        this.player.setVisible(true)
      }
    }
    if (this.playerNameText?.active) {
      this.playerNameText.setText(this.myName)
    }

    this.myStatusMessage = data.statusMessage || ''
    if (this.playerStatusText?.active) {
      this.playerStatusText.setText(this.myStatusMessage)
    }

    if (data.gridPos && !this.isMoving) {
      this.gridX = data.gridPos.x
      this.gridY = data.gridPos.y
      this.updatePlayerPosition()
    }
  }

  private handleRemotePlayersUpdate = (players: Record<string, RemotePlayer>) => {
    if (this.isShutDown) return

    const currentPlayerIds = new Set(Object.keys(players))

    this.remotePlayerSprites.forEach((container, userId) => {
      if (!currentPlayerIds.has(userId)) {
        container.destroy()
        this.remotePlayerSprites.delete(userId)
      }
    })

    Object.entries(players).forEach(([userId, playerData]) => {
      const { position, user_info } = playerData
      const emailPrefix = user_info?.email_prefix || ''
      const targetX = position.gridX * TILE_SIZE + TILE_SIZE / 2
      const targetY = position.gridY * TILE_SIZE + TILE_SIZE / 2

      if (emailPrefix && !this.loadedUsers.has(emailPrefix)) {
        this.loadUserAssets(emailPrefix)
        this.load.start()
      }

      const remoteStatusMsg = user_info?.status_message || ''

      if (this.remotePlayerSprites.has(userId)) {
        const container = this.remotePlayerSprites.get(userId)!
        const sprite = container.getAt(0) as Phaser.GameObjects.Sprite

        const statusText = container.getAt(2) as Phaser.GameObjects.Text | undefined
        if (statusText) {
          statusText.setText(remoteStatusMsg)
        }

        this.tweens.add({
          targets: container,
          x: targetX,
          y: targetY,
          duration: 150,
          ease: 'Linear',
          onComplete: () => {
            container.setDepth(position.gridY)
          }
        })

        const textureKey = this.getTextureKey(emailPrefix, position.direction)
        sprite.setTexture(textureKey)
      } else {
        const container = this.add.container(targetX, targetY)

        const textureKey = this.getTextureKey(emailPrefix, position.direction)
        const sprite = this.add.sprite(0, 0, textureKey)
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE * 2)
        sprite.setOrigin(0.5, 0.75)

        const nameText = this.add.text(0, -TILE_SIZE * 1.5, user_info.name, {
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
        })
        nameText.setOrigin(0.5, 1)

        const statusText = this.add.text(0, -TILE_SIZE * 1.5 + 14, remoteStatusMsg, {
          fontSize: '11px',
          color: '#fbbf24',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
        })
        statusText.setOrigin(0.5, 0)

        container.add([sprite, nameText, statusText])
        container.setDepth(position.gridY)

        this.remotePlayerSprites.set(userId, container)
      }
    })
  }

  private static DIRECTION_MAP: Record<string, string> = {
    up: 'back',
    down: 'front',
    left: 'left',
    right: 'right',
    default: 'default',
  }

  private getTextureKey(emailPrefix: string, direction: string): string {
    const storageDir = MainScene.DIRECTION_MAP[direction] || 'default'
    const key = `${emailPrefix}_${storageDir}`
    if (this.textures.exists(key)) {
      return key
    }
    const fallbackKey = `default_${storageDir}`
    if (this.textures.exists(fallbackKey)) {
      return fallbackKey
    }
    return '__DEFAULT'
  }

  /**
   * 카메라 줌 설정 — 데스크톱은 맵 전체 보기, 모바일은 캐릭터 중심
   */
  private updateCameraFit() {
    const cam = this.cameras.main
    const zoomX = cam.width / MAP_WIDTH
    const zoomY = cam.height / MAP_HEIGHT
    const fitZoom = Math.min(zoomX, zoomY)

    // 최소 줌 0.8 — 모바일에서 캐릭터가 보이도록
    const zoom = Math.max(fitZoom, 0.8)
    cam.setZoom(zoom)
  }

  update() {
    if (this.isMoving) return

    let newGridX = this.gridX
    let newGridY = this.gridY
    let newDirection = this.direction

    // 키보드 + 모바일 터치 D-pad 입력 처리
    const kb = this.cursors
    const td = mobileDirection

    if ((kb?.space?.isDown) || td === 'default') {
      newDirection = 'default'
    } else if ((kb?.up?.isDown) || td === 'up') {
      newGridY = Math.max(0, this.gridY - 1)
      newDirection = 'up'
    } else if ((kb?.down?.isDown) || td === 'down') {
      newGridY = Math.min(GRID_HEIGHT - 1, this.gridY + 1)
      newDirection = 'down'
    } else if ((kb?.left?.isDown) || td === 'left') {
      newGridX = Math.max(0, this.gridX - 1)
      newDirection = 'left'
    } else if ((kb?.right?.isDown) || td === 'right') {
      newGridX = Math.min(GRID_WIDTH - 1, this.gridX + 1)
      newDirection = 'right'
    }

    if (newGridX !== this.gridX || newGridY !== this.gridY) {
      this.direction = newDirection
      this.gridX = newGridX
      this.gridY = newGridY
      this.movePlayer()
    } else if (newDirection !== this.direction) {
      this.direction = newDirection
      this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))
    }
  }

  private movePlayer() {
    this.isMoving = true
    const targetX = this.gridX * TILE_SIZE + TILE_SIZE / 2
    const targetY = this.gridY * TILE_SIZE + TILE_SIZE / 2

    this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))

    this.tweens.add({
      targets: [this.player, this.playerNameText, this.playerStatusText],
      x: targetX,
      y: (target: Phaser.GameObjects.GameObject) => {
        if (target === this.player) return targetY
        if (target === this.playerNameText) return targetY - TILE_SIZE * 1.5
        return targetY - TILE_SIZE * 1.5 + 14
      },
      duration: 150,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false
        this.player.setDepth(this.gridY)

        EventBus.emit(GameEvents.PLAYER_MOVE, {
          gridX: this.gridX,
          gridY: this.gridY,
          direction: this.direction,
        })
      },
    })
  }

  private updatePlayerPosition() {
    const x = this.gridX * TILE_SIZE + TILE_SIZE / 2
    const y = this.gridY * TILE_SIZE + TILE_SIZE / 2

    this.player.setPosition(x, y)
    this.player.setDepth(this.gridY)
    this.playerNameText.setPosition(x, y - TILE_SIZE * 1.5)
    this.playerStatusText.setPosition(x, y - TILE_SIZE * 1.5 + 14)
  }

  shutdown() {
    if (this.isShutDown) return
    this.isShutDown = true

    EventBus.off(GameEvents.REMOTE_PLAYERS_UPDATE, this.handleRemotePlayersUpdate, this)
    EventBus.off(GameEvents.MY_INFO_UPDATE, this.handleMyInfoUpdate, this)

    this.remotePlayerSprites.forEach((container) => container.destroy())
    this.remotePlayerSprites.clear()
  }
}

// D-pad 버튼 핸들러
function dpadDown(dir: string) {
  mobileDirection = dir
}
function dpadUp() {
  mobileDirection = null
}

/**
 * PhaserGame 컴포넌트
 */
const PhaserGame = forwardRef<PhaserGameRef, PhaserGameProps>((props, ref) => {
  const { remotePlayers, isConnected, myName, myEmailPrefix, myStatusMessage, myGridPos, onPositionChange } = props

  const gameRef = useRef<Phaser.Game | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Phaser.Scene | null>(null)
  const sceneReadyRef = useRef<boolean>(false)
  const latestPropsRef = useRef({ myName, myEmailPrefix, myStatusMessage, myGridPos, remotePlayers })
  latestPropsRef.current = { myName, myEmailPrefix, myStatusMessage, myGridPos, remotePlayers }

  const [showDpad, setShowDpad] = useState(false)

  useImperativeHandle(ref, () => ({
    game: gameRef.current,
    scene: sceneRef.current,
  }))

  // D-pad 표시 여부 (모바일 or 터치 디바이스)
  useEffect(() => {
    const check = () => setShowDpad(window.innerWidth < 1024 || navigator.maxTouchPoints > 0)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Phaser 게임 인스턴스 생성
  useEffect(() => {
    if (gameRef.current) return

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current || undefined,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#ffffff',
      pixelArt: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
      scene: [MainScene],
      input: {
        touch: { capture: true },
      },
    }

    const game = new Phaser.Game(config)
    gameRef.current = game

    const handleSceneReady = (scene: Phaser.Scene) => {
      sceneRef.current = scene
      sceneReadyRef.current = true
      EventBus.emit(GameEvents.GAME_READY, game)
      const p = latestPropsRef.current
      EventBus.emit(GameEvents.MY_INFO_UPDATE, { name: p.myName, emailPrefix: p.myEmailPrefix, statusMessage: p.myStatusMessage, gridPos: p.myGridPos })
      EventBus.emit(GameEvents.REMOTE_PLAYERS_UPDATE, p.remotePlayers)
    }
    EventBus.on(GameEvents.SCENE_READY, handleSceneReady)

    const handlePlayerMove = (data: { gridX: number; gridY: number; direction: string }) => {
      onPositionChange(data.gridX, data.gridY, data.direction)
    }
    EventBus.on(GameEvents.PLAYER_MOVE, handlePlayerMove)

    return () => {
      EventBus.off(GameEvents.SCENE_READY, handleSceneReady)
      EventBus.off(GameEvents.PLAYER_MOVE, handlePlayerMove)
      sceneReadyRef.current = false

      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
        sceneRef.current = null
      }
    }
  }, [onPositionChange])

  useEffect(() => {
    if (sceneReadyRef.current) {
      EventBus.emit(GameEvents.REMOTE_PLAYERS_UPDATE, remotePlayers)
    }
  }, [remotePlayers])

  useEffect(() => {
    if (sceneReadyRef.current) {
      EventBus.emit(GameEvents.MY_INFO_UPDATE, { name: myName, emailPrefix: myEmailPrefix, statusMessage: myStatusMessage, gridPos: myGridPos })
    }
  }, [myName, myEmailPrefix, myStatusMessage, myGridPos])

  const btnStyle: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: 12,
    border: 'none',
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: '#fff',
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'pointer',
  }

  return (
    <>
      <div
        ref={containerRef}
        id="phaser-game-container"
        style={{
          width: '100%',
          height: '100%',
          position: 'fixed',
          top: 0,
          left: 0,
          touchAction: 'none',
        }}
      />

      {/* 모바일 D-pad */}
      {showDpad && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 200,
            display: 'grid',
            gridTemplateColumns: '48px 48px 48px',
            gridTemplateRows: '48px 48px 48px',
            gap: 4,
            touchAction: 'none',
          }}
        >
          {/* Row 1: empty, up, empty */}
          <div />
          <button
            style={btnStyle}
            onPointerDown={() => dpadDown('up')}
            onPointerUp={dpadUp}
            onPointerLeave={dpadUp}
            onPointerCancel={dpadUp}
          >
            ▲
          </button>
          <div />

          {/* Row 2: left, pose, right */}
          <button
            style={btnStyle}
            onPointerDown={() => dpadDown('left')}
            onPointerUp={dpadUp}
            onPointerLeave={dpadUp}
            onPointerCancel={dpadUp}
          >
            ◀
          </button>
          <button
            style={{ ...btnStyle, fontSize: 12 }}
            onPointerDown={() => dpadDown('default')}
            onPointerUp={dpadUp}
            onPointerLeave={dpadUp}
            onPointerCancel={dpadUp}
          >
            포즈
          </button>
          <button
            style={btnStyle}
            onPointerDown={() => dpadDown('right')}
            onPointerUp={dpadUp}
            onPointerLeave={dpadUp}
            onPointerCancel={dpadUp}
          >
            ▶
          </button>

          {/* Row 3: empty, down, empty */}
          <div />
          <button
            style={btnStyle}
            onPointerDown={() => dpadDown('down')}
            onPointerUp={dpadUp}
            onPointerLeave={dpadUp}
            onPointerCancel={dpadUp}
          >
            ▼
          </button>
          <div />
        </div>
      )}
    </>
  )
})

PhaserGame.displayName = 'PhaserGame'

export default PhaserGame
