-- 003-add-is-admin.sql
-- profiles 테이블에 관리자 여부 컬럼 추가
--
-- is_admin: 관리자 여부 (기본값 false)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 은빈, 지민을 관리자로 지정
UPDATE profiles SET is_admin = true WHERE email IN ('bin@ihopper.co.kr', 'jimin@ihopper.co.kr');

-- Storage RLS: 인증된 유저가 자기 캐릭터 폴더에 업로드/업데이트 가능
CREATE POLICY "Users can upload own character images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'characters'
  AND (storage.foldername(name))[1] = (SELECT split_part(email, '@', 1) FROM auth.users WHERE id = auth.uid())
);

CREATE POLICY "Users can update own character images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'characters'
  AND (storage.foldername(name))[1] = (SELECT split_part(email, '@', 1) FROM auth.users WHERE id = auth.uid())
);

-- 관리자는 모든 캐릭터 폴더에 업로드/업데이트 가능
CREATE POLICY "Admins can upload any character images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'characters'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

CREATE POLICY "Admins can update any character images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'characters'
  AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
