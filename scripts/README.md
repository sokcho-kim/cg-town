# CG Town - Admin Scripts

## Bulk User Registration

Reads `users.csv` and registers each user in Supabase Auth. A database trigger automatically creates a row in the `profiles` table; this script then updates that row with department, position, and is_npc.

### Prerequisites

- Node.js 18+
- `../backend/.env` must contain `SUPABASE_URL` and `SUPABASE_SECRET_KEY`

### CSV Format

Create or edit `users.csv` with the following columns:

```csv
username,email,department,position,is_npc
조은빈,bin@ihopper.co.kr,디자인팀,사원,false
CG봇,npc_cg@ihopper.co.kr,CG Town,NPC,true
```

| Column     | Description                              |
|------------|------------------------------------------|
| username   | Display name                             |
| email      | Login email (must be unique)             |
| department | Team or department name                  |
| position   | Job title / role                         |
| is_npc     | `true` for NPC accounts, `false` for real users |

### Usage

```bash
cd scripts
npm install
node bulk-register.js
```

### Behavior

- Users that already exist (matched by email) are **skipped** in auth creation but their profile row is still updated with the latest CSV values.
- New users are created with the default password `CgTown2026!`. They should change it after first login.
- The script logs each action and prints a summary at the end.

### Profiles Table Columns

The script updates these profile columns after auth user creation:

- `username` -- display name
- `department` -- team name
- `position` -- job title
- `is_npc` -- boolean flag for NPC accounts
