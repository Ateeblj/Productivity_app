# Bring your own Supabase database

Each user can use **their own** free Supabase project so data lives on their account for years.

## In the app

1. Open **Settings** (center + menu → Settings / Account)
2. Section **YOUR DATABASE**
3. Tap **Open Supabase → create free account**
4. Create a project
5. **Project Settings → API** → copy **Project URL** and **anon public** key
6. Paste both in the app → **Save & connect**
7. In Supabase **SQL Editor**, paste and run `supabase/schema.sql` once
8. Sign up / log in inside the app — auth + sync use **your** project

## Free tier

Supabase free projects are suitable for personal use long-term. Pause/upgrade rules follow Supabase’s current plan.

## Security note

The **anon** key is designed for client apps. Your data is protected by **Row Level Security** in `schema.sql` (each user only sees their own rows). Never paste the **service_role** key into the app.
