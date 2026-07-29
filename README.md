# NTG Reach

Sales CRM for NTG Reach — built with Next.js 14, Supabase, Mailjet, and Netlify.

---

## Phase 1 Setup — Do this once

### Step 1 — Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `ntg-reach`, choose a strong DB password, pick a region (closest to your users — Singapore or Frankfurt for Pakistan)
3. Wait ~2 minutes for it to provision

### Step 2 — Run the database schema

1. In Supabase Dashboard → **SQL Editor**
2. Paste the entire contents of `supabase/schema.sql`
3. Click **Run** — you should see "Success. No rows returned"

### Step 3 — Create your first user

1. Supabase Dashboard → **Authentication** → **Users** → **Invite user**
2. Enter `umair@ntgclarity.com` (and your own email for admin access)
3. They'll get an email to set their password

### Step 4 — Get your API keys

1. Supabase Dashboard → **Project Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long JWT string)

### Step 5 — Set up environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 6 — Install and run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should be redirected to `/login`.

---

## Deploy to Netlify

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Phase 1 — auth + shell"
git remote add origin https://github.com/YOUR_USERNAME/ntg-reach.git
git push -u origin main
```

### Step 2 — Connect to Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `.next`

### Step 3 — Add environment variables in Netlify

Netlify Dashboard → **Site settings** → **Environment variables** → Add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` → your Netlify URL e.g. `https://ntg-reach.netlify.app`

### Step 4 — Install Netlify Next.js plugin

In Netlify Dashboard → **Plugins** → search `@netlify/plugin-nextjs` → Install.
This is already referenced in `netlify.toml`.

---

## Project Structure

```
ntg-reach/
├── app/
│   ├── (app)/               ← Protected routes (sidebar layout)
│   │   ├── layout.tsx       ← App shell with Sidebar
│   │   ├── dashboard/       ← Phase 1 ✓
│   │   ├── leads/           ← Phase 2
│   │   ├── pipeline/        ← Phase 2
│   │   ├── calendar/        ← Phase 5
│   │   ├── settings/        ← Phase 4
│   │   └── profile/         ← Phase 2
│   ├── login/               ← Phase 1 ✓
│   └── layout.tsx           ← Root layout
├── components/
│   └── layout/
│       ├── Sidebar.tsx      ← Icon-only red sidebar
│       └── Topbar.tsx       ← Page header + avatar
├── lib/
│   ├── supabase/
│   │   ├── client.ts        ← Browser Supabase client
│   │   └── server.ts        ← Server Supabase client
│   └── types.ts             ← All TypeScript types
├── styles/
│   ├── theme.css            ← ⭐ SINGLE SOURCE OF TRUTH for all colors
│   └── globals.css          ← Base styles (imports theme.css)
├── supabase/
│   └── schema.sql           ← Run once in Supabase SQL Editor
├── middleware.ts             ← Auth protection for all routes
├── netlify.toml             ← Netlify build config
└── .env.local.example       ← Copy to .env.local and fill in keys
```

## Color System

All colors live in `styles/theme.css`. **Never hardcode a hex value anywhere else.**

```css
/* To use primary red: */
color: var(--color-primary);

/* To use a pipeline stage color: */
background: var(--stage-demo-bg);
color: var(--stage-demo-text);

/* To use an activity color: */
background: var(--activity-email-bg);
```

---

## Phases

| Phase | Status | What it builds |
|-------|--------|----------------|
| 1 | ✅ Done | Auth, shell, dashboard, DB schema |
| 2 | Next | Leads list, kanban, add/edit, search |
| 3 | — | Lead detail, timeline, log modals |
| 4 | — | Mailjet outbound + inbound webhook |
| 5 | — | Microsoft Graph calendar sync |
| 6 | — | Excel import / export |
| 7 | — | Analytics charts |
