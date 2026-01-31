# API 명세서

## 기본 정보

- Base URL: `http://localhost:8000`
- Content-Type: `application/json`

---

## 엔드포인트 목록

### 헬스 체크

#### GET /
서버 상태 확인

**Response**
```json
{
  "message": "CG Inside 직원 도감 API 서버가 실행 중입니다!"
}
```

#### GET /api/health
API 상태 확인

**Response**
```json
{
  "status": "healthy"
}
```

---

## 추후 추가 예정

- `GET /api/employees` - 직원 목록 조회
- `GET /api/employees/{id}` - 직원 상세 조회
- `POST /api/employees` - 직원 등록
- `PUT /api/employees/{id}` - 직원 정보 수정
- `DELETE /api/employees/{id}` - 직원 삭제
