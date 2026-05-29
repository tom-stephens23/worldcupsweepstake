# World Cup 2026 Sweepstake Manager

A single-page app to run **multiple** sweepstakes for the 48-team 2026 FIFA World
Cup off one shared tournament. Built with **Vite + React + TypeScript + Tailwind**,
backed by **Supabase** so every visitor sees identical, persistent, live data.

### Multiple pools, one tournament

- **Shared across all pools:** the 48 teams + odds, the fixtures/scores, and the
  tournament results (champion, runner-up, third, top scorer, clean-sheet leader).
  Enter a score once and every pool updates.
- **Per pool:** its own players + buy-ins, team→player distribution, prize-split
  percentages, charity, name, and admin passcode.
- **Routing:** the landing page (`/`) creates a pool or jumps to one; each pool
  lives at **`/s/<slug>`** (e.g. `/s/beenzee`). Pools are link-only (not listed).
- **Creating a pool** is self-serve but gated by a global **create-passcode**
  (stored in `app_config`). Each pool sets its own admin passcode.
- **Editing results** (shared scores + champion/etc.) can be done by any pool's
  unlocked admin; pool-specific settings need that pool's passcode.

Each pool page has:
- **Home** (`/s/<slug>`) — the pot, prize podium (default 50/25/15%), Golden Boot
  & Golden Glove cards (5% each), live payout breakdown, top-5 odds race, player
  cards, and The House (unassigned teams → charity).
- **Wall Chart** (`/s/<slug>/wall-chart`) — 12 shared group tables with editable
  scores + recomputing standings, and an interactive R32 → Final knockout bracket
  with a third-place playoff. Owner colours are this pool's.

---

## 1. Prerequisites

- **Node.js 20.19+ or 22.12+** and npm.
  > This machine had no Node, so a local copy was installed at `~/.local/node`
  > (v22.12.0). To use it in new terminals, add it to your `PATH`:
  > ```bash
  > echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
  > ```
  > Or install Node any other way (nvm, Homebrew, nodejs.org) — any 20.19+/22.12+ works.
- A free [Supabase](https://supabase.com) project.

## 2. Install

```bash
npm install
```

## 3. Configure Supabase keys

1. Create a Supabase project (free tier is fine).
2. In the dashboard: **Project Settings → Data API** for the URL, and **API Keys**
   for the **anon / publishable** key.
3. Put them in `.env.local` (already created, and gitignored):
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
   (`.env.example` shows the required variable names.)

## 4. Create the database

**Fresh project:**
1. Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Seeding** — pick one:
   - *Automatic:* just start the app. On first load against an empty database it
     seeds the 48 teams, their A–L groups, all fixtures, empty knockout slots, a
     few sample results, the tournament/app_config rows, and a default pool.
   - *Manual:* paste [`supabase/seed.sql`](supabase/seed.sql) and **Run** (once).
4. Set a real create-passcode (it's app-layer only, so don't reuse a real password):
   `update app_config set create_passcode = 'your-secret' where id = 1;`

**Upgrading an EXISTING single-sweepstake database to multi-pool:** don't re-run
`schema.sql`. Instead run [`supabase/migrations/001_multi_pool_phase1.sql`](supabase/migrations/001_multi_pool_phase1.sql)
(additive — preserves your data and creates pool #1), deploy this multi-pool
code, verify, then run [`002_multi_pool_phase2.sql`](supabase/migrations/002_multi_pool_phase2.sql)
(drops the superseded `settings` table + `teams.assigned_player_id`).

> **Access control (read this):** the schema enables RLS with **public read +
> public write** policies; the admin passcode is enforced in the app only. This
> is intentionally simple for a low-stakes private sweepstake and is **not**
> suitable for sensitive data. To harden it later, move writes behind RLS keyed
> on an authenticated admin or a Supabase Edge Function. (Details in the schema.)

## 5. Run

```bash
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build locally
npm test         # run the unit tests once
npm run test:watch
```

The unit tests cover the two pure modules the prizes depend on:
`src/lib/distribute.ts` (team dealing) and `src/lib/payouts.ts` (prize maths),
plus standings/bracket helpers. **11 tests, all passing.**

---

## Admin mode

Read-only by default. Click the **⚙️ gear** (top-right) and enter the passcode
(default **`worldcup2026`**, stored in `settings.admin_passcode`). Unlock state
lives in `sessionStorage` only. Once unlocked you can:

- Run the **Setup Wizard**: add players + buy-ins (1–48), drag to re-rank the 48
  teams, then **Distribute** (with **Re-roll**).
- Enter **scores** inline on the Wall Chart (group + knockout). Knockout winners
  advance automatically; semi-final losers drop into the third-place playoff.
- Set the **Champion / Runner-up / Third / Golden Boot / Golden Glove** countries
  in the Admin panel on Home. Resolving the **Final** and **third-place** matches
  on the Wall Chart sets the champion/runner-up/third automatically.

### How the maths works

- **Distribution** (`src/lib/distribute.ts`): `teamsPerPlayer = floor(48 / players)`;
  the top `players × teamsPerPlayer` teams (by favourite rank) are shuffled and
  dealt evenly; the lowest-ranked leftovers go to **The House**.
  *e.g. 20 players → 2 each, top 40 dealt, bottom 8 to The House.*
- **Payouts** (`src/lib/payouts.ts`): pot = sum of buy-ins. Champion 50%,
  runner-up 25%, third 15%, Golden Boot 5%, Golden Glove 5% (sums to 100%).
  Shares **stack** (a player can win several). Any share whose team is a House
  team is routed to **Charity**.

---

## Mock data & swapping in a live feed

**All** football statistics live in one file: [`src/data/footballData.ts`](src/data/footballData.ts)
(win probabilities for the odds race, sample scores, top scorer, clean-sheet
leader). Nothing else fetches stats, so going live is a one-file change. Target:
**API-Football** (`https://v3.football.api-sports.io`, `league=1`, `season=2026`):

| Data | Endpoint |
| --- | --- |
| Fixtures + scores | `GET /fixtures?league=1&season=2026` |
| Top scorer (Golden Boot) | `GET /players/topscorers?league=1&season=2026` |
| Odds → win probability | `GET /odds?league=1&season=2026` (decimal odds → implied prob, normalise) |
| Clean-sheet leader (Golden Glove) | *No direct endpoint* — derive from `/fixtures` (count matches a side conceded 0) or admin-enter |

`src/data/seedTeams.ts` holds the editable 48-team favourite ranking (re-orderable
in the Setup Wizard).

---

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel (framework preset: **Vite**).
2. In the Vercel project → **Settings → Environment Variables**, add the same two
   vars: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Deploy. [`vercel.json`](vercel.json) rewrites all routes to `index.html` so the
   `/wall-chart` deep link works on refresh.

Because all data lives in Supabase, the deployed URL shows identical, live data
to every visitor; only passcode-holders can edit.

---

## Project structure

```
src/
  lib/        supabase.ts, types.ts, distribute.ts*, payouts.ts*, standings.ts*,
              bracket.ts*, seed.ts, format.ts   (* = pure + unit-tested)
  data/       footballData.ts (all mock stats), seedTeams.ts (48-team ranking)
  hooks/      useSweepstake.tsx (loads data, realtime, derived pot/payouts, admin mutations)
  components/ Pot, Podium, BonusCards, OddsRace, PlayersGrid, TheHouse, PayoutBreakdown,
              AdminGate, AdminPanel, SetupWizard, WallChart/{GroupStage,Bracket}, ui
  pages/      Home.tsx, WallChart.tsx
  App.tsx     nav, routing, dark mode, admin gate, status banners
supabase/     schema.sql, seed.sql
```
