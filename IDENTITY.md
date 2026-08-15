# Identity model

**Boundary = `user_id` (Supabase `auth.users.id`), not email, not device, not project.**

| Layer | Owns |
|--------|------|
| Device | Project URL + anon key (config only) |
| Auth | Session + `user_id` |
| Local data | Keys under `u:{user_id}:…` |
| Cloud | `user_data` rows filtered by `user_id` + RLS |

## Rules
1. Never use email as the data key.
2. Logout clears active user and legacy flat cache; project keys stay.
3. Login sets `activeUserId` then loads/syncs that user’s data only.
4. Guest uses `user_id = guest` — not a fake Supabase user.
5. One Supabase project can hold many users; RLS separates them.
6. BYO project is optional device config, not identity.

## Phase 2 (not required for isolation)
Normalized tables (`goals`, `notes`, …) each with `user_id` + RLS.
Current `user_data` JSON blob is fine if every row is keyed by `user_id`.
