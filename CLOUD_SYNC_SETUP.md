# Cloud sync setup (Supabase — free)

This build replaces the old per-device local accounts with real accounts
that work from any device, and syncs your notes/tasks/planner **text**
data to the cloud. Recorded audio/video always stay on the device that
recorded them — never uploaded — so this costs $0.

## 1. Create a Supabase project
1. Go to https://supabase.com and sign up (free).
2. Create a new project. Pick any name/region, set a database password
   (you won't need it directly — just save it somewhere).
3. Wait ~2 minutes for it to finish provisioning.

## 2. Create the sync table
1. In your project, open **SQL Editor** (left sidebar) → **New query**.
2. Paste the contents of `supabase/schema.sql` (included in this zip) and click **Run**.
   This creates the `user_data` table and locks it down so each account can only
   ever see its own rows (Row Level Security).

## 3. Turn off email confirmation (recommended for personal use)
1. Go to **Authentication → Providers → Email**.
2. Turn **Confirm email** OFF.
   - If you leave it ON, signing up will require clicking a confirmation
     link in your email before you can log in — the app still works, it's
     just an extra step. Fine either way; off is simpler for a personal app.

## 4. Get your API keys
1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.

## 5. Configure the app
1. In the project root, copy `.env.example` to a new file named `.env`.
2. Fill in the two values you just copied:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
3. Install the new dependency and restart:
   ```powershell
   npm install
   npx expo start -c
   ```
   (`-c` clears the Metro cache so it picks up the new `.env` values.)

## What changed
- **Accounts** (`services/authService.ts`) now use Supabase Auth instead of
  per-device AsyncStorage. Same email/password now works on both your
  laptop and phone — no more "account not found" or re-creating accounts.
- **Sync** (`services/syncedStorage.ts`) pushes notes, folders, daily
  tasks, weekly/monthly/yearly planner data, and theme preference to a
  `user_data` table whenever you save something, and pulls/merges on
  login and whenever you open the **Sync** screen or tap "Sync now".
- **Media stays local-only** — audio/video recordings are never uploaded
  anywhere; only the note's title/text/local file reference syncs.
- Removed the old broken WiFi-server sync screen/client (`SyncConnectionScreen`
  previously pointed at a server that was never built) and the dead,
  never-wired-up `src/services/syncService.ts`.

## Cost
At personal-app scale this is $0/month on Supabase's free tier
(500MB database, 50,000 monthly active users, 5GB egress). You'd only
ever pay if this grew into a real multi-user product.

## Troubleshooting
- **"Cloud sync not configured" banner in the Sync screen** → your `.env`
  isn't set or Metro wasn't restarted after adding it.
- **Sign-up succeeds but you can't log in right away** → email
  confirmation is still ON in your Supabase project (see step 3).
- **Old accounts from before this update** → those were local-only and
  can't carry over (there was never a server to store them). Just sign up
  again — your notes/tasks are untouched, only accounts changed.
