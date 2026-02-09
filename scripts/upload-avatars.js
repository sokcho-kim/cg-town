/**
 * upload-avatars.js
 *
 * scripts/avatars/{email_prefix}/ 폴더의 이미지를
 * Supabase Storage characters 버킷에 업로드합니다.
 *
 * Usage:
 *   cd scripts && node upload-avatars.js
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "..", "backend", ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("[ERROR] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "characters";
const AVATARS_DIR = resolve(__dirname, "avatars");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // 버킷 존재 확인
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    console.log(`[INFO] '${BUCKET}' 버킷 생성 중...`);
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error("[ERROR] 버킷 생성 실패:", error.message);
      process.exit(1);
    }
  }

  const folders = readdirSync(AVATARS_DIR).filter((f) => {
    const p = join(AVATARS_DIR, f);
    return statSync(p).isDirectory() && !f.startsWith(".");
  });

  console.log(`\n=== Supabase Storage 아바타 업로드 ===`);
  console.log(`버킷: ${BUCKET}`);
  console.log(`폴더 수: ${folders.length}\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const folder of folders) {
    const folderPath = join(AVATARS_DIR, folder);
    const files = readdirSync(folderPath).filter(
      (f) => f.endsWith(".png") && !f.startsWith(".")
    );

    for (const file of files) {
      const filePath = join(folderPath, file);
      const storagePath = `${folder}/${file}`;
      const fileBuffer = readFileSync(filePath);

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (error) {
        console.log(`  [FAIL] ${storagePath} — ${error.message}`);
        failed++;
      } else {
        console.log(`  [OK] ${storagePath}`);
        uploaded++;
      }
    }

    await sleep(100);
  }

  console.log(`\n=== 완료 ===`);
  console.log(`  업로드: ${uploaded}`);
  console.log(`  실패: ${failed}`);
  console.log(`  총: ${uploaded + failed}\n`);
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
