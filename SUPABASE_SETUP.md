# Connect your Supabase backend (one-time, ~5 minutes)

The app code is complete, but it needs *your* cloud database to store data. Supabase
is free to start. Follow these steps once.

## 1. Create a Supabase account & project
1. Go to **https://supabase.com** and click **Start your project** → sign up
   (GitHub or email — both free).
2. Click **New project**.
   - **Name:** `billing-app` (anything you like)
   - **Database Password:** click *Generate a password* and **save it somewhere**
     (you rarely need it, but don't lose it).
   - **Region:** pick the one closest to you (e.g. *South Asia (Mumbai)* for India).
3. Click **Create new project** and wait ~2 minutes while it sets up.

## 2. Run the database script
1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Open the file `supabase/schema.sql` in this project, **copy ALL of it**, and
   paste it into the editor.
4. Click **Run** (bottom right). You should see *"Success. No rows returned."*
   - This creates your tables, security rules, search indexes, and the
     automatic 21-day trial.

## 3. Get your two connection values
1. In the left sidebar, open **Project Settings** (gear icon) → **API**.
2. Copy these two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **Project API keys → `anon` `public`** (a long string)

   > ✅ The `anon public` key is meant to live inside apps — it's safe.
   > ❌ Never copy the `service_role` secret key into the app.

## 4. Paste them into the app
Open `src/config/supabase.ts` and fill in:
```ts
export const SUPABASE_URL = 'https://abcd1234.supabase.co';   // your Project URL
export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';             // your anon public key
```

## 5. (For easy testing) Turn off email confirmation — optional but recommended now
By default Supabase emails a confirmation link before a new user can log in.
While building/testing it's simpler to skip that:
1. Sidebar → **Authentication** → **Sign In / Providers** (or **Settings**).
2. Find **Confirm email** and turn it **OFF**. Save.

You can turn it back on later before real customers use the app.

## 5b. Make YOUR account the admin (after you sign up once)
The app has two roles: **admin** (you — manages subscriptions) and **user**
(business owners who do billing). Both use the same login screen; the app
decides where to send you based on your role.

1. First, run the app and **sign up once** with the email you want to be the
   admin (e.g. your own email).
2. Back in Supabase → **SQL Editor**, run this (replace the email):
   ```sql
   update public.profiles set role = 'admin'
   where email = 'your-admin-email@example.com';
   ```
3. Log out and back in — you'll now land on the **Admin** page. Everyone else
   lands on the billing system.

## 6. Tell me "done"
Once you've pasted the values and run the SQL, just say **done** — I'll rebuild
the app and we'll watch signup → trial → customers → items → billing all work
on the emulator. 🎉
