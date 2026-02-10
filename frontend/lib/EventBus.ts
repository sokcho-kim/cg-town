/**
 * EventBus - React와 Phaser 간의 통신을 위한 이벤트 버스
 *
 * React 컴포넌트와 Phaser 게임 씬 간의 양방향 통신을 가능하게 합니다.
 * - React -> Phaser: 멀티플레이어 데이터, UI 상태 전달
 * - Phaser -> React: 게임 이벤트, 플레이어 위치 변경 등
 */

import * as Phaser from 'phaser'

// Phaser의 EventEmitter를 사용하여 이벤트 버스 생성
export const EventBus = new Phaser.Events.EventEmitter()

// 이벤트 타입 정의 (타입 안전성을 위해)
export const GameEvents = {
  // React -> Phaser
  REMOTE_PLAYERS_UPDATE: 'remote-players-update',     // 원격 플레이어 목록 업데이트
  CONNECTION_STATUS_CHANGE: 'connection-status-change', // 연결 상태 변경
  MY_INFO_UPDATE: 'my-info-update',                   // 내 정보 업데이트

  // Phaser -> React
  PLAYER_MOVE: 'player-move',                         // 플레이어 이동 시
  SCENE_READY: 'scene-ready',                         // 씬 준비 완료
  GAME_READY: 'game-ready',                           // 게임 인스턴스 준비 완료
  NPC_INTERACT: 'npc-interact',                       // NPC 대화 시작 요청

  // React -> Phaser
  CHAT_OPEN: 'chat-open',                             // 채팅창 열림/닫힘
} as const
