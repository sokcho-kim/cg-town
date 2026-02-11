# 채팅 기능 설계

> 최종 업데이트: 2026-02-11

기존 WebSocket 멀티플레이어 인프라를 활용한 유저 간 채팅 기능 설계 문서.

---

## 현재 인프라 분석

### 이미 구축된 것

| 구성 요소 | 현황 | 파일 |
|-----------|------|------|
| WebSocket 서버 | FastAPI, JWT 인증, broadcast 지원 | `backend/ws/manager.py` |
| WebSocket 클라이언트 | React 훅, 자동 재연결, Strict Mode 대응 | `frontend/hooks/useMultiplayer.ts` |
| 메시지 타입 | `move`, `player_joined`, `player_left`, `player_moved` | - |
| 사용자 정보 | `user_info` (id, email, name, status_message) | 연결 시 로딩 |
| DB | Supabase PostgreSQL | - |

### 채팅 추가 시 부하 영향

| 항목 | 현재 (이동만) | 채팅 추가 후 | 비고 |
|------|-------------|-------------|------|
| WebSocket 연결 수 | 30개 | 30개 (변동 없음) | 기존 연결 재활용 |
| 메시지 빈도 | 이동 시만 | 이동 + 채팅 | 채팅은 이동보다 훨씬 적음 |
| 메시지 크기 | ~50 bytes (좌표) | ~200 bytes (텍스트) | 무시할 수준 |
| CPU | 거의 0 | 거의 0 | JSON 파싱 수준 |
| RAM | 연결당 ~수 KB | 동일 | 메시지는 저장 후 해제 |

> 30명 동시 접속 채팅은 Render Starter (0.5 vCPU, 512MB)로 충분.
> 병목은 채팅이 아닌 RAG(NPC 채팅)에서 발생.

---

## 채팅 유형

### 0. 상태메시지 채팅 (가장 직관적, 최우선 구현)

기존 상태메시지 시스템을 채팅으로 확장하는 방식. 별도 채팅 UI 없이 가장 자연스러운 UX.

**개념:**
- 상태메시지 입력 = 채팅 메시지 전송
- 입력한 메시지가 캐릭터 머리 위에 말풍선으로 표시
- 마지막 메시지가 계속 떠있음 (기존 상태메시지처럼)
- 다른 사람이 보기에는 캐릭터가 말하는 것처럼 보임

**현재 상태메시지 사양:**
- 글자 제한: 30자 (`frontend/app/dogam/edit/page.tsx:221`)
- 표시: Phaser 텍스트로 캐릭터 위에 렌더링 (`frontend/components/PhaserGame.tsx:184`)
- 저장: `profiles.status_message` 컬럼 (DB 영구 저장)
- 변경: 도감 편집 페이지에서만 가능

**변경사항:**

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 글자 제한 | 30자 | **100자** (채팅 메시지로 쓰기에 30자는 부족) |
| 입력 위치 | 도감 편집 페이지만 | **게임 화면 내 입력창** (Enter로 포커스 → 입력 → Enter로 전송) |
| 전달 방식 | DB 저장 → 새로고침 시 반영 | **WebSocket 실시간 broadcast** + DB 저장 |
| 표시 | 항상 고정 | 마지막 메시지 유지 (새 메시지 입력 시 교체) |

**WebSocket 프로토콜:**

클라이언트 → 서버:
```json
{
  "type": "status_chat",
  "message": "점심 뭐 먹을까요?"
}
```

서버 → 전체 broadcast:
```json
{
  "type": "status_updated",
  "user_id": "uuid",
  "message": "점심 뭐 먹을까요?"
}
```

**서버 처리 흐름:**
1. `status_chat` 메시지 수신
2. `active_connections[user_id]["user_info"]["status_message"]` 업데이트
3. 전체 플레이어에게 broadcast (위치 무관 — 상태메시지는 보이는 모든 캐릭터에 표시)
4. DB `profiles.status_message` 비동기 업데이트 (마지막 메시지 영구 저장)

**프론트엔드 처리:**
- 게임 화면에서 Enter 키 → 하단 입력창 포커스
- 메시지 입력 후 Enter → WebSocket 전송 → 입력창 닫힘
- Phaser에서 해당 캐릭터의 상태 텍스트 즉시 갱신
- ESC → 입력 취소

**장점:**
- 기존 Phaser 상태메시지 렌더링을 그대로 활용
- 별도 채팅 로그 UI 불필요 (캐릭터 위에 바로 보임)
- 구현 최소화 — 입력창 + WebSocket 메시지 타입 1개 추가
- 직관적 — 말풍선이 곧 채팅

---

### 1. 인접 채팅 (TODO #24)

- 게임 맵 내 거리 기반 채팅
- 캐릭터 주변 N타일 이내 플레이어에게만 메시지 전달
- 말풍선 형태로 캐릭터 머리 위에 표시

### 2. 담타존 — 익명 채팅 (TODO #25)

- 별도 채널의 익명 채팅/건의사항
- 전체 공개, 발신자 비공개
- 게임 내 특정 오브젝트(게시판 등)와 상호작용으로 진입

---

## 인접 채팅 상세 설계

### WebSocket 메시지 프로토콜

기존 `type: "move"` 패턴을 따름.

**클라이언트 → 서버:**
```json
{
  "type": "chat",
  "message": "안녕하세요!",
  "scope": "nearby"
}
```

**서버 → 클라이언트 (범위 내 플레이어에게만):**
```json
{
  "type": "chat_message",
  "user_id": "uuid",
  "user_name": "지민",
  "message": "안녕하세요!",
  "timestamp": "2026-02-11T10:00:00Z"
}
```

### 거리 계산

현재 `manager.positions`에 모든 플레이어의 그리드 좌표가 있으므로, 맨해튼 거리 기반으로 범위 필터링:

```
거리 = |sender.gridX - receiver.gridX| + |sender.gridY - receiver.gridY|
```

| 범위 | 타일 수 | 용도 |
|------|---------|------|
| 근접 | 2타일 이내 | 1:1 대화 느낌 |
| 주변 | 4타일 이내 | 소그룹 대화 (권장) |
| 전체 | 무제한 | 공지/전체 채팅 |

### 백엔드 변경사항

`backend/ws/manager.py`에 추가:

```python
async def handle_chat(self, user_id: str, data: dict):
    message = data.get("message", "").strip()
    if not message or len(message) > 200:
        return

    sender_pos = self.positions.get(user_id)
    sender_info = self.active_connections[user_id]["user_info"]
    if not sender_pos:
        return

    chat_payload = json.dumps({
        "type": "chat_message",
        "user_id": user_id,
        "user_name": sender_info.get("name", ""),
        "message": message,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })

    # 범위 내 플레이어에게만 전송
    CHAT_RANGE = 4
    for uid, conn in self.active_connections.items():
        if uid == user_id:
            continue
        recv_pos = self.positions.get(uid)
        if not recv_pos:
            continue
        distance = abs(sender_pos["gridX"] - recv_pos["gridX"]) + \
                   abs(sender_pos["gridY"] - recv_pos["gridY"])
        if distance <= CHAT_RANGE:
            try:
                await conn["ws"].send_text(chat_payload)
            except Exception:
                pass
```

`backend/ws/endpoint.py`에 분기 추가:

```python
if data.get("type") == "move":
    await manager.handle_move(user_id, data)
elif data.get("type") == "chat":
    await manager.handle_chat(user_id, data)
```

### 프론트엔드 변경사항

**`useMultiplayer.ts` 확장:**
- `chat_message` 타입 핸들링 추가
- `sendChat(message: string)` 함수 export
- 채팅 메시지 상태 관리 (최근 N개 유지)

**채팅 UI 컴포넌트:**
- 화면 하단 채팅 입력창 (Enter로 전송)
- 말풍선: Phaser 텍스트로 캐릭터 위에 표시 (3초 후 페이드)
- 채팅 로그: 사이드 패널 또는 하단 오버레이

### DB 테이블 (선택)

채팅 이력 저장이 필요한 경우:

```sql
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id),
  message TEXT NOT NULL,
  scope TEXT DEFAULT 'nearby',       -- 'nearby', 'global', 'anonymous'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
```

> 인접 채팅은 휘발성이므로 DB 저장 없이 WebSocket만으로 처리해도 무방.
> 필요 시 최근 N일치만 보관하는 정책 적용.

---

## 담타존 (익명 채팅) 상세 설계

### 진입 방식

- 게임 맵 내 특정 오브젝트 (예: 게시판, 담타존 영역) 근처에서 상호작용 키(E 또는 Space)
- 별도 모달/패널 오픈

### 메시지 프로토콜

**클라이언트 → 서버:**
```json
{
  "type": "chat",
  "message": "건의사항입니다",
  "scope": "anonymous"
}
```

**서버 → 전체 클라이언트:**
```json
{
  "type": "chat_message",
  "user_id": null,
  "user_name": "익명",
  "message": "건의사항입니다",
  "scope": "anonymous",
  "timestamp": "2026-02-11T10:00:00Z"
}
```

### 익명성 보장

- 서버에서 `user_id`, `user_name`을 제거하고 broadcast
- DB 저장 시에도 `sender_id`를 NULL로 처리 (완전 익명)
- 또는 관리자만 조회 가능하도록 별도 컬럼에 저장 (반익명)

### DB 저장

담타존은 건의사항 성격이므로 DB 저장 권장:

```sql
-- chat_messages 테이블 공유, scope = 'anonymous'로 구분
-- sender_id는 NULL (완전 익명) 또는 관리자 전용 조회 (반익명)
```

---

## 구현 우선순위

| 순서 | 기능 | 난이도 | 비고 |
|------|------|--------|------|
| **1** | **상태메시지 채팅** (글자 제한 확대 + 게임 내 입력 + 실시간 broadcast) | **낮음** | 기존 인프라 활용, 최소 변경 |
| 2 | 인접 채팅 (거리 기반 범위 제한) | 낮음 | 상태메시지 채팅에 거리 필터 추가 |
| 3 | 담타존 (익명 채팅) | 보통 | 별도 UI + 익명 처리 |
| 4 | 채팅 이력 DB 저장 (선택) | 낮음 | 상태메시지는 이미 DB 저장됨 |

---

## 확장 가능성

- **전체 채팅** — scope를 `global`로 설정하면 맵 전체에 broadcast
- **DM (1:1 채팅)** — 특정 user_id를 지정하여 해당 유저에게만 전송
- **채팅 알림** — 범위 밖에서 온 메시지를 알림으로 표시
- **이모지 리액션** — 메시지에 이모지 반응
- **채팅 기록 검색** — DB 저장 시 전문 검색 가능
