# Aditya — Portfolio (React + Vite + Supabase)

A portfolio website with a built-in admin dashboard.

* **Public site:** `/` — hero, skills, timeline, projects, certifications, gallery, videos, sports, resume, contact icons.
* **Admin dashboard:** `/admin` — sign in and edit everything. Changes go live **instantly** for every visitor (no redeploy).
* **Backend (all on Supabase's free plan, no card needed):** Authentication (login) + Postgres database (text content) + Storage (photos, videos, PDFs).
* **Hosting:** Vercel, deployed automatically from GitHub.

> The site works **before** Supabase is connected, using its built-in content (read-only). Connecting Supabase turns on `/admin` and live editing.

---

## 0. What you need
* Node.js 20 or newer (https://nodejs.org) and Git (https://git-scm.com)
* A GitHub account, a Vercel account (sign in with GitHub) and a Supabase account (sign in with GitHub)
* The email you will use as admin: `aadityajain01223@gmail.com`

## 1. Run it on your computer
```bash
npm install
npm run dev
```
Open http://localhost:5173 . The site shows with its built-in content. `/admin` says "Supabase is not connected yet" until step 5.

## 2. Create the Supabase project
1. https://supabase.com → **Start your project** → sign in → **New project**.
2. Name: `aditya-portfolio`. Set a **database password** (save it in a password manager; you will rarely need it). Region: the closest one (e.g. **Mumbai / ap-south-1**). Plan: **Free**. Click **Create new project** and wait about 2 minutes.

## 3. Create the tables, rules and file bucket (one paste)
1. Dashboard → **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this project, check the admin email near the top is yours, copy everything, paste it, click **Run**. You should see "Success".

This creates the content table, makes it publicly readable but writable only by the admin, turns on live updates, and creates the `uploads` storage bucket (public files, 50 MB per file).

## 4. Create your admin login
Supabase Auth handles login. Only people you create can sign in.
1. **Authentication → Users → Add user → Create new user.** Enter your admin email and a password (you won't use it; the site signs you in with an emailed link). Tick **Auto Confirm User**. Create.
2. **Authentication → Sign In / Providers** (named "Providers" in some versions): turn **off** "Allow new users to sign up" so nobody else can make an account. Keep **Email** enabled.
3. **Authentication → URL Configuration:**
   * **Site URL:** `http://localhost:5173` for now (change to your real domain after step 8).
   * **Redirect URLs:** add `http://localhost:5173/**` (and later `https://YOUR-DOMAIN/**`).
4. *(Optional)* Google sign-in: Authentication → Providers → Google → follow Supabase's steps to create a Google OAuth client, then use the "Sign in with Google" button. Emailed links work without this.

Note: Supabase's built-in email sender is heavily rate-limited (made for testing). That is fine for one admin signing in now and then. If the link ever fails to arrive, wait a few minutes, check spam, or use Google sign-in / a free custom SMTP service.

## 5. Put the keys in `.env`
1. Dashboard → **Project Settings → API** (or "API Keys"). Copy the **Project URL** and the **anon / publishable key**.
2. In the project folder copy `.env.example` to `.env` and fill it in:

| .env name | value |
|---|---|
| VITE_SUPABASE_URL | Project URL |
| VITE_SUPABASE_ANON_KEY | anon / publishable key |
| VITE_ADMIN_EMAIL | your admin email |

3. Stop and restart `npm run dev` (Vite reads `.env` only at start).

The anon/publishable key is **meant to be public** (it ships in every Supabase website). What protects your data is the database rules from step 3 plus the admin login. **Never** put the `service_role` / secret key in this project. Never commit `.env` (already in `.gitignore`).

## 6. Test it locally
1. `npm run dev` → http://localhost:5173/admin → enter your email → open the link from the email **in the same browser**.
2. Change your status text in **Personal info → Save**. Open http://localhost:5173 in another tab: it updates by itself.
3. Try a portrait upload (you get a crop step), a certificate image and a small video.

## 7. Put the project on GitHub
```bash
git init
git add -A
git commit -m "Initial portfolio"
git branch -M main
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/Aditya120405/adityajain-portfolio.git
git push -u origin main
```

## 8. Deploy on Vercel (auto-deploys from now on)
1. https://vercel.com → **Add New → Project → Import** your GitHub repo (framework preset: **Vite**, auto-detected).
2. **Environment Variables:** add the three `VITE_…` values from your `.env`.
3. **Deploy.** `vercel.json` already makes `/admin` work.
4. Back in Supabase **Authentication → URL Configuration:** set **Site URL** to `https://YOUR-DOMAIN` and add `https://YOUR-DOMAIN/**` to Redirect URLs.
5. Visit `https://YOUR-DOMAIN/admin` and sign in.

## 9. Stop the free project from pausing (important)
Supabase **pauses free projects after about 7 days without activity** (your data is kept, but the site would show built-in content and `/admin` would fail until you click "Restore" in the dashboard). Visitors using the site normally count as activity, but quiet weeks happen, so add this safety net:
1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret:** add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (same values as `.env`).
2. The workflow `.github/workflows/keepalive.yml` then pings your database every 3 days. (GitHub pauses scheduled workflows in repos with no commits for 60 days; push a small commit now and then or run it manually from the Actions tab.)

## 10. How updates reach the live site
| What you change | How it goes live |
|---|---|
| Text, projects, skills, certificates, photos, videos, links, resume, animation settings **(in /admin)** | **Instantly.** Saved to Supabase; open pages update by themselves. No GitHub or Vercel step. |
| Design or code (layout, colours, new sections, fixes), e.g. files given to you in chat | Replace the files in your project folder, then `git add -A && git commit -m "describe change" && git push`. **Vercel redeploys automatically within about a minute** on every push to `main`. |

Tip: work on a branch (`git checkout -b try-new-hero`) and Vercel gives you a private preview link; merge into `main` when happy.

## 11. Free-plan limits to know
500 MB database · 1 GB file storage · 50 MB per file · 5 GB bandwidth per month · 50,000 monthly active users · auto-pause after a week idle (see step 9). Photos are resized in the browser before upload so 1 GB goes a long way. Keep videos short or use links.

## 12. Troubleshooting
| Problem | Fix |
|---|---|
| `/admin` says "Supabase is not connected yet" | `.env` missing or not restarted (local), or env vars not set in Vercel (then **Redeploy**). |
| Sign-in email never arrives | Check spam, wait a few minutes (built-in email is rate-limited), or use Google sign-in. Make sure you created the user in step 4 — with sign-ups off, unknown emails get no link. |
| Link opens but you are still signed out | Open the link in the **same browser**; check Redirect URLs include `…/**` for that domain. |
| "new row violates row-level security policy" | The email in `schema.sql` ≠ the account you signed in with. Fix the email, re-run the SQL. |
| "Not authorised" screen | `VITE_ADMIN_EMAIL` doesn't match your login email. |
| Upload fails | File over 50 MB, or the `uploads` bucket is missing (re-run `schema.sql`). |
| Edits don't appear live on another tab | Refresh once; confirm the SQL ran fully (it turns on Realtime). |
| Site shows built-in content only / errors after a quiet week | Project is paused: Supabase dashboard → **Restore project**, then set up step 9. |
| `/admin` is 404 on Vercel | `vercel.json` missing from the repo. |

## 13. Project map
```
src/Public.jsx    public website          src/Admin.jsx   admin dashboard (tabs, cropper, forms, sign-in)
src/store.js      Supabase hooks, saving, auth, uploads (swap uploadMedia() to use another file host)
src/supabase.js   client setup            src/defaults.js built-in content shown before/without Supabase
src/styles.css    all styling (dark/light theme, animations)
supabase/schema.sql   tables, security rules, realtime, storage bucket (run once)
.github/workflows/keepalive.yml   keeps the free project awake
public/           icons, default portrait and resume
design-reference/ the original design-canvas files (reference only)
```
Privacy note: the bundled default resume (`public/Aditya_Jain_Resume.pdf`) contains your phone number. Replace it with a version without the number if you don't want it public.
