'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import * as Phaser from 'phaser'
import { EventBus, GameEvents } from '@/lib/EventBus'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, getCharacterImageUrl } from '@/lib/gameConfig'

/**
 * PhaserGame 컴포넌트
 *
 * React와 Phaser를 연결하는 브릿지 컴포넌트입니다.
 * - useEffect에서 Phaser 게임 인스턴스를 생성합니다.
 * - useRef로 게임 인스턴스를 관리합니다.
 * - cleanup에서 game.destroy(true)로 리소스를 정리합니다.
 * - EventBus를 통해 React와 Phaser 간 통신을 합니다.
 */

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
 * 맵, 캐릭터, 입력 처리를 담당합니다.
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

  constructor() {
    super({ key: 'MainScene' })
  }

  preload() {
    // 타일맵 JSON 로드
    this.load.tilemapTiledJSON('tilemap', '/maps/main.json')

    // 타일셋 이미지 로드
    this.load.image('grass', '/images/tiles/workspace/grass.png')
    this.load.image('river', '/images/tiles/workspace/river.png')
    this.load.image('grass_river_edge', '/images/tiles/workspace/grass_river_edge.png')
  }

  /**
   * 유저 캐릭터 에셋 로드 (Supabase Storage URL 기반)
   * username으로 URL을 조합: ${SUPABASE_URL}/storage/v1/object/public/characters/${username}/${direction}.png
   */
  private loadUserAssets(username: string) {
    if (!username || this.loadedUsers.has(username)) return
    this.loadedUsers.add(username)

    const directions = ['front', 'back', 'left', 'right', 'default']
    directions.forEach((dir) => {
      const key = `${username}_${dir}`
      this.load.image(key, getCharacterImageUrl(username, dir))
    })
  }

  create() {
    // 타일맵 생성
    const map = this.make.tilemap({ key: 'tilemap' })

    // 타일셋 이미지 연결
    const grassTileset = map.addTilesetImage('grass', 'grass')
    const riverTileset = map.addTilesetImage('river', 'river')
    const edgeTileset = map.addTilesetImage('grass_river_edge', 'grass_river_edge')

    // 레이어 생성 (타일셋이 null일 수 있으므로 체크)
    if (grassTileset) {
      const groundLayer = map.createLayer('ground', grassTileset, 0, 0)
      groundLayer?.setDepth(-2)
    }

    if (riverTileset) {
      const waterLayer = map.createLayer('water', riverTileset, 0, 0)
      waterLayer?.setDepth(-1)
    }

    if (edgeTileset) {
      const edgeLayer = map.createLayer('edge', edgeTileset, 0, 0)
      edgeLayer?.setDepth(-1)
    }

    // 카메라 설정 (맵 경계 설정)
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT)

    // 플레이어 스프라이트 생성 (텍스처는 MY_INFO_UPDATE에서 설정)
    this.player = this.add.sprite(
      this.gridX * TILE_SIZE + TILE_SIZE / 2,
      this.gridY * TILE_SIZE + TILE_SIZE / 2,
      '__DEFAULT'
    )
    this.player.setDisplaySize(TILE_SIZE, TILE_SIZE * 1.5)
    this.player.setOrigin(0.5, 0.75)
    this.player.setDepth(this.gridY)

    // 플레이어 이름 텍스트
    this.playerNameText = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE,
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

    // 플레이어 상태 메시지 텍스트 (이름 아래에 표시)
    this.playerStatusText = this.add.text(
      this.player.x,
      this.player.y - TILE_SIZE + 14,
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

    // 카메라가 플레이어를 따라가도록 설정
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    // 키보드 입력 설정
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
    }

    // EventBus 이벤트 리스너 등록
    this.setupEventListeners()

    // 씬 준비 완료 이벤트 발생
    EventBus.emit(GameEvents.SCENE_READY, this)
  }

  /**
   * EventBus 이벤트 리스너 설정
   */
  private setupEventListeners() {
    // 원격 플레이어 업데이트
    EventBus.on(GameEvents.REMOTE_PLAYERS_UPDATE, this.handleRemotePlayersUpdate, this)

    // 내 정보 업데이트
    EventBus.on(GameEvents.MY_INFO_UPDATE, this.handleMyInfoUpdate, this)
  }

  /**
   * 내 정보 업데이트 핸들러
   */
  private handleMyInfoUpdate = (data: { name: string; emailPrefix: string; statusMessage: string; gridPos: { x: number; y: number } | null }) => {
    this.myName = data.name
    if (data.emailPrefix && data.emailPrefix !== this.myEmailPrefix) {
      this.myEmailPrefix = data.emailPrefix
      // 내 캐릭터 에셋 동적 로드
      this.loadUserAssets(data.emailPrefix)
      this.load.once('complete', () => {
        if (this.player) {
          this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))
        }
      })
      this.load.start()
    }
    if (this.playerNameText) {
      this.playerNameText.setText(data.name)
    }

    // 상태 메시지 업데이트
    this.myStatusMessage = data.statusMessage || ''
    if (this.playerStatusText) {
      this.playerStatusText.setText(this.myStatusMessage)
    }

    // 초기 위치 설정
    if (data.gridPos && !this.isMoving) {
      this.gridX = data.gridPos.x
      this.gridY = data.gridPos.y
      this.updatePlayerPosition()
    }
  }

  /**
   * 원격 플레이어 업데이트 핸들러
   */
  private handleRemotePlayersUpdate = (players: Record<string, RemotePlayer>) => {
    const currentPlayerIds = new Set(Object.keys(players))

    // 제거된 플레이어 삭제
    this.remotePlayerSprites.forEach((container, userId) => {
      if (!currentPlayerIds.has(userId)) {
        container.destroy()
        this.remotePlayerSprites.delete(userId)
      }
    })

    // 플레이어 추가/업데이트
    Object.entries(players).forEach(([userId, playerData]) => {
      const { position, user_info } = playerData
      const emailPrefix = user_info?.email_prefix || ''
      const targetX = position.gridX * TILE_SIZE + TILE_SIZE / 2
      const targetY = position.gridY * TILE_SIZE + TILE_SIZE / 2

      // 해당 유저 에셋이 아직 로드되지 않았으면 동적 로드
      if (emailPrefix && !this.loadedUsers.has(emailPrefix)) {
        this.loadUserAssets(emailPrefix)
        this.load.start()
      }

      const remoteStatusMsg = user_info?.status_message || ''

      if (this.remotePlayerSprites.has(userId)) {
        // 기존 플레이어 업데이트
        const container = this.remotePlayerSprites.get(userId)!
        const sprite = container.getAt(0) as Phaser.GameObjects.Sprite

        // 상태 메시지 텍스트 업데이트 (container의 3번째 자식)
        const statusText = container.getAt(2) as Phaser.GameObjects.Text | undefined
        if (statusText) {
          statusText.setText(remoteStatusMsg)
        }

        // 위치 트윈 애니메이션
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

        // 방향에 따른 텍스처 변경
        const textureKey = this.getTextureKey(emailPrefix, position.direction)
        sprite.setTexture(textureKey)
      } else {
        // 새 플레이어 생성
        const container = this.add.container(targetX, targetY)

        const textureKey = this.getTextureKey(emailPrefix, position.direction)
        const sprite = this.add.sprite(0, 0, textureKey)
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE * 1.5)
        sprite.setOrigin(0.5, 0.75)

        const nameText = this.add.text(0, -TILE_SIZE, user_info.name, {
          fontSize: '14px',
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
        })
        nameText.setOrigin(0.5, 1)

        const statusText = this.add.text(0, -TILE_SIZE + 14, remoteStatusMsg, {
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

  /**
   * Phaser 방향 → Storage 파일명 매핑
   */
  private static DIRECTION_MAP: Record<string, string> = {
    up: 'back',
    down: 'front',
    left: 'left',
    right: 'right',
  }

  /**
   * username + 방향에 따른 텍스처 키 반환
   * 텍스처가 아직 로드되지 않았으면 '__DEFAULT' 반환
   */
  private getTextureKey(emailPrefix: string, direction: string): string {
    const storageDir = MainScene.DIRECTION_MAP[direction] || 'default'
    const key = `${emailPrefix}_${storageDir}`
    if (this.textures.exists(key)) {
      return key
    }
    return '__DEFAULT'
  }

  update() {
    // 이동 중이면 입력 무시
    if (this.isMoving) return

    // 방향키 입력 처리
    let newGridX = this.gridX
    let newGridY = this.gridY
    let newDirection = this.direction

    if (this.cursors.up.isDown) {
      newGridY = Math.max(0, this.gridY - 1)
      newDirection = 'up'
    } else if (this.cursors.down.isDown) {
      newGridY = Math.min(GRID_HEIGHT - 1, this.gridY + 1)
      newDirection = 'down'
    } else if (this.cursors.left.isDown) {
      newGridX = Math.max(0, this.gridX - 1)
      newDirection = 'left'
    } else if (this.cursors.right.isDown) {
      newGridX = Math.min(GRID_WIDTH - 1, this.gridX + 1)
      newDirection = 'right'
    }

    // 위치가 변경되었으면 이동
    if (newGridX !== this.gridX || newGridY !== this.gridY) {
      this.direction = newDirection
      this.gridX = newGridX
      this.gridY = newGridY
      this.movePlayer()
    } else if (newDirection !== this.direction) {
      // 방향만 변경된 경우 텍스처만 업데이트
      this.direction = newDirection
      this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))
    }
  }

  /**
   * 플레이어 이동 애니메이션
   */
  private movePlayer() {
    this.isMoving = true
    const targetX = this.gridX * TILE_SIZE + TILE_SIZE / 2
    const targetY = this.gridY * TILE_SIZE + TILE_SIZE / 2

    // 텍스처 변경
    this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))

    // 이동 트윈
    this.tweens.add({
      targets: [this.player, this.playerNameText, this.playerStatusText],
      x: targetX,
      y: (target: Phaser.GameObjects.GameObject) => {
        if (target === this.player) return targetY
        if (target === this.playerNameText) return targetY - TILE_SIZE
        return targetY - TILE_SIZE + 14 // playerStatusText
      },
      duration: 150,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false
        this.player.setDepth(this.gridY)

        // React로 위치 변경 이벤트 전송
        EventBus.emit(GameEvents.PLAYER_MOVE, {
          gridX: this.gridX,
          gridY: this.gridY,
          direction: this.direction,
        })
      },
    })
  }

  /**
   * 플레이어 위치 즉시 업데이트 (초기화용)
   */
  private updatePlayerPosition() {
    const x = this.gridX * TILE_SIZE + TILE_SIZE / 2
    const y = this.gridY * TILE_SIZE + TILE_SIZE / 2

    this.player.setPosition(x, y)
    this.player.setDepth(this.gridY)
    this.playerNameText.setPosition(x, y - TILE_SIZE)
    this.playerStatusText.setPosition(x, y - TILE_SIZE + 14)
  }

  /**
   * 씬 정리
   */
  shutdown() {
    // EventBus 이벤트 리스너 해제
    EventBus.off(GameEvents.REMOTE_PLAYERS_UPDATE, this.handleRemotePlayersUpdate, this)
    EventBus.off(GameEvents.MY_INFO_UPDATE, this.handleMyInfoUpdate, this)

    // 원격 플레이어 스프라이트 정리
    this.remotePlayerSprites.forEach((container) => container.destroy())
    this.remotePlayerSprites.clear()
  }
}

/**
 * PhaserGame 컴포넌트
 */
const PhaserGame = forwardRef<PhaserGameRef, PhaserGameProps>((props, ref) => {
  const { remotePlayers, isConnected, myName, myEmailPrefix, myStatusMessage, myGridPos, onPositionChange } = props

  // 게임 인스턴스 ref
  const gameRef = useRef<Phaser.Game | null>(null)
  // 게임 컨테이너 DOM ref
  const containerRef = useRef<HTMLDivElement>(null)
  // 현재 씬 ref
  const sceneRef = useRef<Phaser.Scene | null>(null)

  // 외부에서 게임 인스턴스에 접근할 수 있도록 설정
  useImperativeHandle(ref, () => ({
    game: gameRef.current,
    scene: sceneRef.current,
  }))

  // Phaser 게임 인스턴스 생성 및 정리
  useEffect(() => {
    // 이미 게임이 존재하면 스킵
    if (gameRef.current) return

    // Phaser 게임 설정
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: containerRef.current || undefined,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#1a1a2e',
      pixelArt: true, // 픽셀 아트 스타일 (이미지 스무딩 비활성화)
      scale: {
        mode: Phaser.Scale.RESIZE, // 화면 크기에 맞게 자동 조정
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
    }

    // 게임 인스턴스 생성
    const game = new Phaser.Game(config)
    gameRef.current = game

    // 씬 준비 완료 이벤트 리스너
    const handleSceneReady = (scene: Phaser.Scene) => {
      sceneRef.current = scene
      EventBus.emit(GameEvents.GAME_READY, game)
    }
    EventBus.on(GameEvents.SCENE_READY, handleSceneReady)

    // 플레이어 이동 이벤트 리스너 (React로 전달)
    const handlePlayerMove = (data: { gridX: number; gridY: number; direction: string }) => {
      onPositionChange(data.gridX, data.gridY, data.direction)
    }
    EventBus.on(GameEvents.PLAYER_MOVE, handlePlayerMove)

    // cleanup 함수
    return () => {
      EventBus.off(GameEvents.SCENE_READY, handleSceneReady)
      EventBus.off(GameEvents.PLAYER_MOVE, handlePlayerMove)

      // 게임 인스턴스 파괴
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
        sceneRef.current = null
      }
    }
  }, [onPositionChange])

  // 원격 플레이어 업데이트를 Phaser로 전달
  useEffect(() => {
    EventBus.emit(GameEvents.REMOTE_PLAYERS_UPDATE, remotePlayers)
  }, [remotePlayers])

  // 내 정보 업데이트를 Phaser로 전달
  useEffect(() => {
    EventBus.emit(GameEvents.MY_INFO_UPDATE, { name: myName, emailPrefix: myEmailPrefix, statusMessage: myStatusMessage, gridPos: myGridPos })
  }, [myName, myEmailPrefix, myStatusMessage, myGridPos])

  return (
    <div
      ref={containerRef}
      id="phaser-game-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    />
  )
})

PhaserGame.displayName = 'PhaserGame'

export default PhaserGame
