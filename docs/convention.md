# 코딩 컨벤션

## 공통

- 모든 주석, 커밋 메시지, 문서는 **한국어**로 작성
- 변수명, 함수명은 **영어**로 작성

---

## Frontend (Next.js)

### 파일/폴더 명명 규칙
- 컴포넌트: PascalCase (예: `EmployeeCard.tsx`)
- 유틸/훅: camelCase (예: `useEmployee.ts`)
- 페이지: kebab-case 폴더 (예: `app/employee-detail/`)

### 컴포넌트 구조
```tsx
// 1. import 문
// 2. 타입 정의
// 3. 컴포넌트 정의
// 4. export
```

### 스타일링
- Tailwind CSS 사용
- shadcn/ui 컴포넌트 우선 활용

---

## Backend (Python FastAPI)

### 파일/폴더 명명 규칙
- 모듈: snake_case (예: `employee_service.py`)
- 클래스: PascalCase (예: `EmployeeModel`)
- 함수/변수: snake_case (예: `get_employee_by_id`)

### API 엔드포인트 규칙
- RESTful 설계 원칙 준수
- URL은 복수형 명사 사용 (예: `/api/employees`)

---

## Git 컨벤션

### 브랜치 명명
- `feature/기능명` - 새 기능 개발
- `fix/버그명` - 버그 수정
- `docs/문서명` - 문서 작업

### 커밋 메시지
```
타입: 제목

- feat: 새로운 기능 추가
- fix: 버그 수정
- docs: 문서 수정
- style: 코드 포맷팅
- refactor: 코드 리팩토링
- test: 테스트 코드
- chore: 기타 변경사항
```
