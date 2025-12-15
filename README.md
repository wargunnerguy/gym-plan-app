# Gym Plan (Nuxt 3 PWA)

An offline-friendly viewer for a Google Sheets-based workout plan. It pulls your plan via a GitHub Action, ships a static `plan.json` to GitHub Pages, and runs entirely in the browser with local progress tracking.

## What it does
- Reads a structured Google Sheet (tabs: plans, phases, workouts, exercises) via a service account.
- CI builds `public/plan.json`, then `nuxt generate` publishes to GitHub Pages (custom domain ready).
- Client shows phases → weeks → workouts → exercises, with links to exercise and substitution guides.
- Local-only progress: per-workout and per-exercise completion, auto-advances to the next workout; locks after you finish today and shows “Good job!” until next day.

## Google Sheets schema (headers matter, order doesn’t)
- **plans**: `plan_id | plan_name | active`
- **phases**: `phase_id | plan_id | phase_name | phase_order | weeks_count`
- **workouts**: `workout_id | phase_id | week_number | day_name | workout_order | focus`
- **exercises**: `exercise_id | workout_id | order | name | warmup_sets | working_sets | reps | load | rpe | rest | sub1 | sub2 | notes | group | link | sub1_link | sub2_link`
  - `link` is the main exercise guide URL; `sub1_link`/`sub2_link` are optional links for substitutes.

## Local setup
1) Install deps: `npm install`
2) Create `env.local` (not committed) with:
```
SHEET_ID=...
GOOGLE_PROJECT_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
3) Generate `plan.json` from Sheets: `npm run fetch:plan`
4) Run dev server (LAN-accessible): `npm run dev` then open `http://localhost:3000` (or your LAN IP).

## Deploy to GitHub Pages (with custom domain)
- Repo Settings → Pages: set build to GitHub Actions; set custom domain `gym.costlio.com`, enable HTTPS.
- DNS: CNAME `gym.costlio.com` → `<your-username>.github.io`.
- Ensure Actions secrets are set: `SHEET_ID`, `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- CI workflow `.github/workflows/deploy.yml` will fetch Sheets → write `public/plan.json` → `npm run generate` → deploy.
- Optional: add `public/CNAME` containing `gym.costlio.com` if you prefer it tracked in git.

## Scripts
- `npm run fetch:plan` — pull Google Sheet → `public/plan.json` (run before generate/dev).
- `npm run dev` — local dev server.
- `npm run generate` — static build for Pages.
- `npm run lint` / `npm run typecheck` — quality checks.

## Behavior notes
- Progress is stored locally (per browser/device). No cross-device sync. Last workout date prevents opening a new workout on the same day.
- Only the next workout is shown; after completion you see “Good job!” until tomorrow, then the next workout unlocks.
- Exercises: click the name to open the guide if `link` is set. Substitutes show links if `sub1_link`/`sub2_link` exist.
- Completed exercises are dimmed/struck and collapse their extra details; active exercise shows full details, others show minimal badges.
