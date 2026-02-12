# CG Town - Scripts

## 사원 등록

사원 등록은 관리자 웹 UI(`/admin/members`)에서 합니다.
벌크 스크립트는 삭제되었습니다 (2026-02-12).

---

## 남아있는 스크립트

### avatars/
사원별 아바타 원본 이미지 폴더

### upload-avatars.js
아바타 이미지를 Supabase Storage에 일괄 업로드

```bash
cd scripts
node upload-avatars.js
```

### normalize-avatars.py
아바타 이미지 리사이즈/정규화 (128x256 → 64x128)

```bash
cd scripts
python normalize-avatars.py
```
