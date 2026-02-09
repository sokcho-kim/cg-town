/**
 * bulk-register.js
 *
 * Reads users.csv and bulk-registers each user in Supabase Auth.
 * A database trigger automatically creates a row in the `profiles` table,
 * so after auth creation this script UPDATEs that profile row with the
 * extra columns (department, position, is_npc).
 *
 * Usage:
 *   cd scripts && npm install && node bulk-register.js
 *
 * Environment:
 *   Reads SUPABASE_URL and SUPABASE_SECRET_KEY from ../backend/.env
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Resolve paths
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the backend .env file
config({ path: resolve(__dirname, "..", "backend", ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "[ERROR] SUPABASE_URL or SUPABASE_SECRET_KEY is missing.\n" +
      "        Make sure ../backend/.env contains both values."
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Supabase admin client (uses the service-role / secret key)
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ---------------------------------------------------------------------------
// Default password for newly created users
// ---------------------------------------------------------------------------
const DEFAULT_PASSWORD = "CgTown2026!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Small delay to avoid hammering the Supabase Auth API.
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch the list of emails that already exist in auth.users so we can skip
 * them without making individual createUser calls that would fail.
 */
async function fetchExistingEmails() {
  const emails = new Set();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page, perPage });

    if (error) {
      console.error("[ERROR] Failed to list existing users:", error.message);
      process.exit(1);
    }

    for (const u of users) {
      if (u.email) emails.add(u.email.toLowerCase());
    }

    if (users.length < perPage) break;
    page++;
  }

  return emails;
}

/**
 * Wait briefly and then update the profiles row that the trigger created.
 * The trigger fires on INSERT into auth.users, but there can be a small
 * delay before the row materialises in the profiles table, so we retry a
 * few times.
 */
async function updateProfile(userId, { username, department, position, isNpc }) {
  const maxRetries = 5;
  const retryDelay = 800; // ms

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const { error } = await supabase
      .from("profiles")
      .update({
        username,
        department,
        position,
        is_npc: isNpc,
      })
      .eq("id", userId);

    if (!error) return { success: true };

    // If the row doesn't exist yet, wait and retry
    if (attempt < maxRetries) {
      await sleep(retryDelay);
    } else {
      return { success: false, error };
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // 1. Read and parse the CSV -------------------------------------------------
  const csvPath = resolve(__dirname, "users.csv");
  let csvContent;
  try {
    csvContent = readFileSync(csvPath, "utf-8");
  } catch (err) {
    console.error(`[ERROR] Could not read ${csvPath}:`, err.message);
    process.exit(1);
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length === 0) {
    console.log("[INFO] users.csv is empty. Nothing to do.");
    return;
  }

  console.log(`\n=== CG Town Bulk Registration ===`);
  console.log(`Found ${records.length} user(s) in users.csv\n`);

  // 2. Fetch already-registered emails ----------------------------------------
  const existingEmails = await fetchExistingEmails();
  console.log(`Already registered: ${existingEmails.size} user(s)\n`);

  // 3. Process each row -------------------------------------------------------
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of records) {
    const email = (row.email ?? "").trim().toLowerCase();
    const username = (row.username ?? "").trim();
    const department = (row.department ?? "").trim();
    const position = (row.position ?? "").trim();
    const isNpc = (row.is_npc ?? "false").trim().toLowerCase() === "true";

    if (!email) {
      console.log(`  [SKIP] Row missing email: ${JSON.stringify(row)}`);
      skipped++;
      continue;
    }

    // --- Already exists? -----------------------------------------------------
    if (existingEmails.has(email)) {
      console.log(`  [SKIP] ${email} (${username}) -- already registered`);

      // Still update the profile in case new columns were added.
      // Find the user ID by looking up the email in the existing user list.
      let userId = null;
      let page = 1;
      while (!userId) {
        const {
          data: { users },
        } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        const match = users.find(
          (u) => u.email && u.email.toLowerCase() === email
        );
        if (match) {
          userId = match.id;
          break;
        }
        if (users.length < 1000) break;
        page++;
      }

      if (userId) {
        const result = await updateProfile(userId, {
          username,
          department,
          position,
          isNpc,
        });
        if (result?.success) {
          console.log(`         -> profile updated (department, position, is_npc)`);
        } else {
          console.log(
            `         -> profile update failed: ${result?.error?.message ?? "unknown"}`
          );
        }
      }

      skipped++;
      continue;
    }

    // --- Create the user -----------------------------------------------------
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true, // mark email as confirmed immediately
      user_metadata: { username },
    });

    if (error) {
      console.log(`  [FAIL] ${email} (${username}) -- ${error.message}`);
      failed++;
      continue;
    }

    const userId = data.user.id;
    console.log(`  [CREATED] ${email} (${username}) -- id: ${userId}`);

    // --- Update the profile row the trigger created --------------------------
    const profileResult = await updateProfile(userId, {
      username,
      department,
      position,
      isNpc,
    });

    if (profileResult?.success) {
      console.log(`            -> profile updated`);
    } else {
      console.log(
        `            -> profile update failed: ${profileResult?.error?.message ?? "unknown"}`
      );
    }

    created++;

    // Small delay between creations to be gentle on the API
    await sleep(300);
  }

  // 4. Summary ----------------------------------------------------------------
  console.log(`\n=== Summary ===`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already existed or missing email)`);
  console.log(`  Failed  : ${failed}`);
  console.log(`  Total   : ${records.length}\n`);

  if (created > 0) {
    console.log(`Default password for new users: ${DEFAULT_PASSWORD}`);
    console.log(`Users should change their password after first login.\n`);
  }
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
