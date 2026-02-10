'use client'

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import * as Phaser from 'phaser'
import { EventBus, GameEvents } from '@/lib/EventBus'
import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, GRID_WIDTH, GRID_HEIGHT, getCharacterImageUrl } from '@/lib/gameConfig'

// 모바일 터치 D-pad 방향 (모듈 레벨 — Phaser update()에서 읽음)
let mobileDirection: string | null = null
// 채팅창 열림 여부 (true면 게임 입력 비활성화)
let chatOpen = false

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
  is_npc?: boolean
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
  private playerBubbleGfx!: Phaser.GameObjects.Graphics
  private playerBubbleText!: Phaser.GameObjects.Text
  private remotePlayerSprites: Map<string, Phaser.GameObjects.Container> = new Map()
  // 원격 플레이어 정보 (텍스쳐 갱신용)
  private remotePlayerInfo: Map<string, { emailPrefix: string; direction: string }> = new Map()
  private gridX: number = 12
  private gridY: number = 6
  private isMoving: boolean = false
  private direction: string = 'down'
  private myName: string = ''
  private myEmailPrefix: string = ''
  private myStatusMessage: string = ''
  private loadedUsers: Set<string> = new Set()
  private isShutDown: boolean = false
  // NPC 추적
  private npcPositions: Map<string, { gridX: number; gridY: number; name: string; id: string; emailPrefix: string }> = new Map()
  private nearbyNpcId: string | null = null
  private npcHintText: Phaser.GameObjects.Text | null = null
  private enterKey: Phaser.Input.Keyboard.Key | null = null

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

    // 상태 메시지 말풍선 (Graphics + Text — 같은 위치에 놓고 상대좌표로 그림)
    const bubbleY = this.player.y - TILE_SIZE * 1.5 - 18
    this.playerBubbleGfx = this.add.graphics()
    this.playerBubbleGfx.setPosition(this.player.x, bubbleY)
    this.playerBubbleGfx.setDepth(1001)
    this.playerBubbleText = this.add.text(this.player.x, bubbleY, this.myStatusMessage, {
      fontSize: '11px',
      color: '#333333',
      align: 'center',
    })
    this.playerBubbleText.setOrigin(0.5, 1)
    this.playerBubbleText.setDepth(1002)
    this.drawBubble(this.playerBubbleGfx, this.playerBubbleText)

    // 카메라 플레이어 추적 시작
    const cam = this.cameras.main
    cam.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT)
    cam.startFollow(this.player, true, 0.1, 0.1)

    // 키보드 입력
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys()
      this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)
    }

    // NPC 대화 힌트 텍스트 (숨김 상태)
    this.npcHintText = this.add.text(0, 0, '대화하기 (Enter)', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#E8852C',
      padding: { x: 8, y: 4 },
    })
    this.npcHintText.setOrigin(0.5, 1)
    this.npcHintText.setDepth(2000)
    this.npcHintText.setVisible(false)

    // 에셋 로드 완료 시 모든 스프라이트 텍스쳐 갱신
    this.load.on('complete', () => {
      this.refreshAllTextures()
    })

    // NPC 자율 이동 타이머 (3~5초 간격)
    this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => this.wanderNpcs(),
    })

    this.setupEventListeners()

    this.events.on('shutdown', this.shutdown, this)
    this.events.on('destroy', this.shutdown, this)

    EventBus.emit(GameEvents.SCENE_READY, this)
  }

  private setupEventListeners() {
    EventBus.on(GameEvents.REMOTE_PLAYERS_UPDATE, this.handleRemotePlayersUpdate, this)
    EventBus.on(GameEvents.MY_INFO_UPDATE, this.handleMyInfoUpdate, this)
    EventBus.on(GameEvents.CHAT_OPEN, (open: boolean) => { chatOpen = open })
  }

  /**
   * 에셋 로드 완료 후 모든 스프라이트 텍스쳐 갱신
   */
  private refreshAllTextures() {
    if (this.isShutDown) return
    // 내 캐릭터
    if (this.myEmailPrefix && this.player?.active) {
      const key = this.getTextureKey(this.myEmailPrefix, this.direction)
      this.player.setTexture(key)
    }
    // 원격 플레이어
    this.remotePlayerSprites.forEach((container, userId) => {
      const info = this.remotePlayerInfo.get(userId)
      if (!info) return
      const sprite = container.getAt(0) as Phaser.GameObjects.Sprite
      if (sprite?.active) {
        sprite.setTexture(this.getTextureKey(info.emailPrefix, info.direction))
      }
    })
  }

  private handleMyInfoUpdate = (data: { name: string; emailPrefix: string; statusMessage: string; gridPos: { x: number; y: number } | null }) => {
    if (!this.sys || !this.scene || this.isShutDown) return

    this.myName = data.name || ''
    if (data.emailPrefix && data.emailPrefix !== this.myEmailPrefix) {
      this.myEmailPrefix = data.emailPrefix
      this.loadUserAssets(data.emailPrefix)
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
    if (this.playerBubbleText?.active) {
      this.playerBubbleText.setText(this.myStatusMessage)
      this.drawBubble(this.playerBubbleGfx, this.playerBubbleText)
    }

    if (data.gridPos && !this.isMoving) {
      this.gridX = data.gridPos.x
      this.gridY = data.gridPos.y
      this.updatePlayerPosition()
    }
  }

  private handleRemotePlayersUpdate = (players: Record<string, RemotePlayer>) => {
    if (this.isShutDown) return

    // NPC 위치 추적 업데이트
    this.npcPositions.clear()
    Object.entries(players).forEach(([userId, p]) => {
      if (p.user_info?.is_npc) {
        this.npcPositions.set(userId, {
          gridX: p.position.gridX,
          gridY: p.position.gridY,
          name: p.user_info.name,
          id: p.user_info.id,
          emailPrefix: p.user_info.email_prefix,
        })
      }
    })

    const currentPlayerIds = new Set(Object.keys(players))

    this.remotePlayerSprites.forEach((container, userId) => {
      if (!currentPlayerIds.has(userId)) {
        container.destroy()
        this.remotePlayerSprites.delete(userId)
        this.remotePlayerInfo.delete(userId)
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

      // 플레이어 정보 저장 (텍스쳐 갱신용)
      this.remotePlayerInfo.set(userId, { emailPrefix, direction: position.direction })

      const remoteStatusMsg = user_info?.status_message || ''

      if (this.remotePlayerSprites.has(userId)) {
        const container = this.remotePlayerSprites.get(userId)!
        const sprite = container.getAt(0) as Phaser.GameObjects.Sprite

        // 말풍선 업데이트 (container children: [sprite, nameText, bubbleGfx, bubbleText])
        const bubbleGfx = container.getAt(2) as Phaser.GameObjects.Graphics | undefined
        const bubbleText = container.getAt(3) as Phaser.GameObjects.Text | undefined
        if (bubbleText && bubbleGfx) {
          bubbleText.setText(remoteStatusMsg)
          this.drawBubble(bubbleGfx, bubbleText)
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

        // 말풍선 (Graphics + Text — 같은 위치에 놓음)
        const bY = -TILE_SIZE * 1.5 - 18
        const bubbleGfx = this.add.graphics()
        bubbleGfx.setPosition(0, bY)
        const bubbleText = this.add.text(0, bY, remoteStatusMsg, {
          fontSize: '11px',
          color: '#333333',
          align: 'center',
        })
        bubbleText.setOrigin(0.5, 1)
        this.drawBubble(bubbleGfx, bubbleText)

        container.add([sprite, nameText, bubbleGfx, bubbleText])
        container.setDepth(position.gridY)

        this.remotePlayerSprites.set(userId, container)
      }
    })
  }

  /**
   * 말풍선 그리기 — gfx와 text는 같은 위치에 놓고, 상대좌표(0,0 기준)로 그림
   * 이렇게 하면 tween으로 둘을 같이 움직여도 말풍선이 정확히 따라옴
   */
  private drawBubble(gfx: Phaser.GameObjects.Graphics, text: Phaser.GameObjects.Text) {
    gfx.clear()
    if (!text.text) {
      gfx.setVisible(false)
      text.setVisible(false)
      return
    }
    gfx.setVisible(true)
    text.setVisible(true)

    const pad = 6
    const w = text.width + pad * 2
    const h = text.height + pad * 2
    // text origin (0.5, 1) → text는 자기 위치에서 위쪽으로 렌더됨
    // gfx도 같은 위치이므로 (0,0) 기준 상대좌표 사용
    const rx = -w / 2
    const ry = -text.height - pad

    gfx.fillStyle(0xffffff, 0.95)
    gfx.lineStyle(1, 0xd1d5db, 1)
    gfx.fillRoundedRect(rx, ry, w, h, 8)
    gfx.strokeRoundedRect(rx, ry, w, h, 8)

    // 꼬리 (아래 중앙)
    const tailTop = ry + h
    gfx.fillTriangle(-4, tailTop, 4, tailTop, 0, tailTop + 5)
  }

  /**
   * NPC 자율 이동 — 랜덤 방향으로 1칸씩 이동
   */
  private wanderNpcs() {
    if (this.isShutDown) return

    const dirs = [
      { dx: 0, dy: -1, dir: 'up' },
      { dx: 0, dy: 1, dir: 'down' },
      { dx: -1, dy: 0, dir: 'left' },
      { dx: 1, dy: 0, dir: 'right' },
    ]

    this.npcPositions.forEach((npc, userId) => {
      // 40% 확률로 이동
      if (Math.random() > 0.4) return

      const move = dirs[Math.floor(Math.random() * dirs.length)]
      const newX = npc.gridX + move.dx
      const newY = npc.gridY + move.dy

      // 맵 범위 체크
      if (newX < 0 || newX >= GRID_WIDTH || newY < 0 || newY >= GRID_HEIGHT) return

      // 위치 업데이트
      npc.gridX = newX
      npc.gridY = newY

      // 스프라이트 이동 애니메이션
      const container = this.remotePlayerSprites.get(userId)
      if (!container) return

      const sprite = container.getAt(0) as Phaser.GameObjects.Sprite
      sprite.setTexture(this.getTextureKey(npc.emailPrefix, move.dir))

      // remotePlayerInfo도 업데이트
      const info = this.remotePlayerInfo.get(userId)
      if (info) info.direction = move.dir

      this.tweens.add({
        targets: container,
        x: newX * TILE_SIZE + TILE_SIZE / 2,
        y: newY * TILE_SIZE + TILE_SIZE / 2,
        duration: 300,
        ease: 'Linear',
        onComplete: () => {
          container.setDepth(newY)
        }
      })
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
    // NPC 근접 감지 (항상 체크)
    this.checkNpcProximity()

    if (this.isMoving || chatOpen) return

    // NPC 대화 트리거 (Enter 키)
    if (this.enterKey?.isDown && this.nearbyNpcId) {
      const npc = this.npcPositions.get(this.nearbyNpcId)
      if (npc) {
        EventBus.emit(GameEvents.NPC_INTERACT, { npcId: npc.id, npcName: npc.name })
      }
      return
    }

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

  /**
   * NPC 근접 감지 — 1타일 이내이면 대화 힌트 표시
   */
  private checkNpcProximity() {
    let foundNpcId: string | null = null
    this.npcPositions.forEach((npc, userId) => {
      if (foundNpcId) return
      const dx = Math.abs(this.gridX - npc.gridX)
      const dy = Math.abs(this.gridY - npc.gridY)
      if (dx <= 1 && dy <= 1 && (dx + dy) <= 2) {
        foundNpcId = userId
      }
    })

    if (foundNpcId !== this.nearbyNpcId) {
      this.nearbyNpcId = foundNpcId
      if (foundNpcId && this.npcHintText) {
        const npc = this.npcPositions.get(foundNpcId)!
        const px = npc.gridX * TILE_SIZE + TILE_SIZE / 2
        const py = npc.gridY * TILE_SIZE - TILE_SIZE * 0.8
        this.npcHintText.setPosition(px, py)
        this.npcHintText.setVisible(!chatOpen)
        EventBus.emit('npc-nearby', { npcId: npc.id, npcName: npc.name })
      } else {
        if (this.npcHintText) this.npcHintText.setVisible(false)
        EventBus.emit('npc-nearby', null)
      }
    }
  }

  private movePlayer() {
    this.isMoving = true
    const targetX = this.gridX * TILE_SIZE + TILE_SIZE / 2
    const targetY = this.gridY * TILE_SIZE + TILE_SIZE / 2
    const nameY = targetY - TILE_SIZE * 1.5
    const bubbleY = nameY - 18

    this.player.setTexture(this.getTextureKey(this.myEmailPrefix, this.direction))

    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: 150,
      ease: 'Linear',
    })
    this.tweens.add({
      targets: this.playerNameText,
      x: targetX,
      y: nameY,
      duration: 150,
      ease: 'Linear',
    })
    this.tweens.add({
      targets: [this.playerBubbleGfx, this.playerBubbleText],
      x: targetX,
      y: bubbleY,
      duration: 150,
      ease: 'Linear',
    })

    this.time.delayedCall(150, () => {
      this.isMoving = false
      this.player.setDepth(this.gridY)

      EventBus.emit(GameEvents.PLAYER_MOVE, {
        gridX: this.gridX,
        gridY: this.gridY,
        direction: this.direction,
      })
    })
  }

  private updatePlayerPosition() {
    const x = this.gridX * TILE_SIZE + TILE_SIZE / 2
    const y = this.gridY * TILE_SIZE + TILE_SIZE / 2
    const nameY = y - TILE_SIZE * 1.5
    const bubbleY = nameY - 18

    this.player.setPosition(x, y)
    this.player.setDepth(this.gridY)
    this.playerNameText.setPosition(x, nameY)
    this.playerBubbleGfx.setPosition(x, bubbleY)
    this.playerBubbleText.setPosition(x, bubbleY)
    this.drawBubble(this.playerBubbleGfx, this.playerBubbleText)
  }

  shutdown() {
    if (this.isShutDown) return
    this.isShutDown = true

    EventBus.off(GameEvents.REMOTE_PLAYERS_UPDATE, this.handleRemotePlayersUpdate, this)
    EventBus.off(GameEvents.MY_INFO_UPDATE, this.handleMyInfoUpdate, this)
    EventBus.off(GameEvents.CHAT_OPEN)

    this.remotePlayerSprites.forEach((container) => container.destroy())
    this.remotePlayerSprites.clear()
    this.remotePlayerInfo.clear()
    this.npcPositions.clear()
    chatOpen = false
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
  const [nearbyNpc, setNearbyNpc] = useState<{ npcId: string; npcName: string } | null>(null)

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

  // NPC 근접 감지 (React 쪽)
  useEffect(() => {
    const handler = (data: { npcId: string; npcName: string } | null) => {
      setNearbyNpc(data)
    }
    EventBus.on('npc-nearby', handler)
    return () => { EventBus.off('npc-nearby', handler) }
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

      {/* 모바일 NPC 대화 버튼 */}
      {showDpad && nearbyNpc && (
        <button
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            padding: '12px 20px',
            borderRadius: 16,
            border: 'none',
            backgroundColor: '#E8852C',
            color: '#fff',
            fontSize: 14,
            fontWeight: 'bold',
            touchAction: 'none',
            cursor: 'pointer',
          }}
          onClick={() => {
            EventBus.emit(GameEvents.NPC_INTERACT, { npcId: nearbyNpc.npcId, npcName: nearbyNpc.npcName })
          }}
        >
          {nearbyNpc.npcName}에게 대화하기
        </button>
      )}
    </>
  )
})

PhaserGame.displayName = 'PhaserGame'

export default PhaserGame
