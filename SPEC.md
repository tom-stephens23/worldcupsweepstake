# Claude Code Prompt — World Cup 2026 Sweepstake Manager

> How to use this: save this file as `SPEC.md` in an empty folder, open Claude Code in that
> folder, and run something like:
> `claude "Read SPEC.md and build the project exactly as described. Scaffold it, install deps, set up the Supabase schema, implement every feature, and make sure it runs with npm run dev. Ask me for my Supabase keys when you reach that step."`

---

## Objective
Build a **World Cup 2026 Sweepstake Manager**: a single-page web app where one admin sets up and runs a sweepstake for the 48-team 2026 FIFA World Cup, and everyone else views it via a shared public URL (deployable to Vercel). Work autonomously through the build plan below, committing in logical chunks. Stop and ask only for secrets (Supabase keys) and for any genuinely ambiguous product decision.

## Tech stack (use exactly this)
- **Vite + React + TypeScript**
- **Tailwind CSS** for styling
- **React Router** for the two tabs (`/` and `/wall-chart`)
- **Supabase** (`@supabase/supabase-js`) for shared, persistent storage so the deployed URL shows identical data to every visitor
- Custom components for the podium and odds race (no heavy chart lib needed; plain divs + CSS/transitions). `recharts` is fine only if it genuinely simplifies the standings.
- Node 18+. Package manager: npm.

## Project setup (do this first)
1. Scaffold: `npm create vite@latest . -- --template react-ts`
2. Install: `npm i @supabase/supabase-js react-router-dom` and set up Tailwind (`tailwindcss`, `postcss`, `autoprefixer`, init config, add directives to `src/index.css`).
3. Create `.env.example` with:
   ```
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   ```
   and a real `.env.local` (gitignored). Pause and ask me to paste my Supabase URL and anon key.
4. Create a `supabase/schema.sql` file with the schema below and give me the exact steps to run it (Supabase dashboard → SQL editor → paste → run). Seed the placeholder teams and a mock fixture set from a script or seed SQL.

## Supabase schema (`supabase/schema.sql`)
```sql
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_in_aud numeric not null default 0,
  created_at timestamptz default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flag_emoji text,
  favourite_rank int not null,            -- 1 = top favourite … 48 = longshot
  assigned_player_id uuid references players(id) on delete set null,  -- null = "The House"
  win_probability numeric default 0       -- 0–1, for the odds race
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null,                    -- group | r32 | r16 | qf | sf | final | third_place
  group_label text,                       -- A–L for group stage
  team_a_id uuid references teams(id),
  team_b_id uuid references teams(id),
  score_a int,
  score_b int,
  status text not null default 'upcoming',-- upcoming | live | finished
  kickoff timestamptz
);

create table settings (
  id int primary key default 1,
  admin_passcode text default 'worldcup2026',
  champion_team_id uuid references teams(id),
  runner_up_team_id uuid references teams(id),
  third_place_team_id uuid references teams(id),
  top_scorer_team_id uuid references teams(id),
  clean_sheet_team_id uuid references teams(id),
  charity_name text default 'Charity'
);
insert into settings (id) values (1);
```
**Access control:** this is a low-stakes private sweepstake, so enable permissive RLS policies (public read + public write) on these tables and enforce the admin passcode in the app layer. Add a clear comment in the schema noting this is intentionally simple and not suitable for sensitive data; if I later want real security, the write path should move behind RLS keyed on an authenticated admin or a Supabase Edge Function.

## File structure (aim for roughly this)
```
src/
  lib/supabase.ts          // client init from env vars
  data/footballData.ts     // ALL mock stats live here (see below)
  data/seedTeams.ts        // the 48-team placeholder ranking
  hooks/useSweepstake.ts    // loads players/teams/matches/settings, exposes derived pot + payouts
  lib/payouts.ts            // pure payout calculation (unit-testable)
  lib/distribute.ts         // pure team-distribution logic (unit-testable)
  components/Pot.tsx
  components/Podium.tsx
  components/BonusCards.tsx
  components/OddsRace.tsx
  components/PlayersGrid.tsx
  components/TheHouse.tsx
  components/AdminGate.tsx
  components/SetupWizard.tsx
  components/WallChart/GroupStage.tsx
  components/WallChart/Bracket.tsx
  pages/Home.tsx
  pages/WallChart.tsx
  App.tsx
```

## Mock data + future API swap
Put **all** football stats (top-5 win probabilities for the odds race, sample scores, top scorer, clean-sheet leader) in `src/data/footballData.ts` as typed, hardcoded exports. Mark each with `// TODO: replace with API-Football (https://v3.football.api-sports.io, league=1, season=2026)`. Keep data fetching out of every other file so swapping to live data is a single-file change later. Add a short `README` section documenting the swap: fixtures via `fixtures?league=1&season=2026`, top scorer via the topscorers endpoint, odds via the odds endpoint, and that clean-sheet leader has no direct endpoint (derive from fixtures or admin-enter).

---

## Core logic (implement as pure, tested functions)

**`distribute.ts` — team distribution:**
- `teamsPerPlayer = Math.floor(48 / numberOfPlayers)`
- `teamsToDeal = numberOfPlayers * teamsPerPlayer`
- Take the **top `teamsToDeal`** teams by `favourite_rank`, shuffle randomly, deal evenly so each player gets exactly `teamsPerPlayer`.
- Remaining lowest-ranked teams (`48 - teamsToDeal`) → **The House** (`assigned_player_id = null`).
- Validate `numberOfPlayers` is an integer 1–48.
- Write a unit test asserting: 20 players → 2 each, 40 dealt from the top, bottom 8 to House; 1 player → all 48 to that player, House empty; 48 players → 1 each, House empty.

**`payouts.ts` — prize calculation:**
- `pot = sum(buy_in_aud)`
- Champion owner → 50% of pot; runner-up owner → 25%; third place → 15%; top-scorer's-country owner → 5%; clean-sheet-leader's-country owner → 5%. (Sums to 100% — these are allocations of the pot, not extra money.)
- Shares **stack**: one player can collect several.
- If the team for a given share is a **House team** (unassigned), that share is routed to **Charity** (`settings.charity_name`), not a player.
- Return a structured breakdown the UI can render, recomputing live as results/stats change. Unit-test the stacking case and the House→Charity case.

---

## Home page (`/`)
1. **The Pot** — large animated AUD counter (sum of buy-ins) with player count beneath.
2. **Prize podium** — gold/silver/bronze 3-step graphic beside the pot showing 50% / 25% / 15%, each with the dollar amount and (once decided) the winning team flag + owner; "TBD" until set. Beside it, two **bonus cards**: Golden Boot (5%, top scorer's country owner) and Golden Glove (5%, clean-sheet leader's country owner). House-owned shares display "→ Charity".
3. **Live payout breakdown** — derived from `payouts.ts`, updates live.
4. **Odds race** — horizontal race-track bar chart, **top 5 favourites only**, each a flag "runner", bar length ∝ `win_probability`, animated on load/update. Mock data from `footballData.ts`.
5. **Players & teams** — grid of player cards (name, buy-in, their teams as flag chips), colour-coded by owner.
6. **The House** — visually distinct section of leftover unassigned teams, noting winnings go to charity.

## Wall Chart page (`/wall-chart`)
- **Group stage**: 12 groups (A–L) of 4. Per group, a mini standings table (P, W, D, L, GF, GA, GD, Pts) + match scores. Admin can edit scores; standings recompute. Owned teams show owner colour/name; House teams neutral.
- **Knockout bracket**: interactive R32 → R16 → QF → SF → Final + 3rd-place playoff; scores entered, winners advance, owner colours carry through. (2026 format: top 2 per group + 8 best third-placed → R32, 104 matches total.)
- Resolving the Final / 3rd-place / top scorer / clean-sheet leader updates the Home podium, bonus cards, and payouts automatically.

## Admin mode
- Read-only by default. A gear icon opens an `AdminGate` passcode prompt; the correct value (from `settings.admin_passcode`, default `worldcup2026`) unlocks editing: setup wizard, score entry, and setting champion/runner-up/third/top-scorer/clean-sheet. Store the unlocked state in memory/session only.

## Setup wizard (admin)
1. Add players (1–48; validate). Each has a name and AUD buy-in (per-person, can differ). Show running pot.
2. Editable, drag-to-reorder list of all 48 teams (pre-filled from `seedTeams.ts`), rank 1 = top favourite.
3. "Distribute teams" button runs `distribute.ts`, shows a brief reveal, and offers "Re-roll".

## Design direction
Clean, modern, editorial. Generous whitespace, strong type hierarchy, Inter or Geist. Mobile-responsive first. One confident accent — a deep pitch-green with a gold accent for prizes (gold/silver/bronze podium); neutral background. Light mode default with an optional subtle dark mode. National flag emojis for teams. Purposeful motion only (pot counter, odds race, deal reveal). Two-tab top nav (Home / Wall Chart) with the admin gear top-right. Avoid generic dashboard styling and heavy gradients.

## Run, verify, deploy
- App must run with `npm run dev`. Provide a `README.md` covering: env setup, running the schema, seeding, `npm run dev`, `npm run build`, running tests, and Vercel deploy (set the two `VITE_` env vars in the Vercel project).
- Run the unit tests for `distribute.ts` and `payouts.ts` and confirm they pass before declaring done.

## Acceptance checks
- Distribution matches the 20→2-each→8-House example; player count constrained 1–48.
- Pot and all payouts derive live from buy-ins + current results.
- House-owned prizes route to charity, not a player; shares stack correctly.
- All football stats come only from `footballData.ts`.
- Deployed URL shows identical data to all viewers; only passcode-holders can edit.
- `npm run dev` works from a clean clone after env + schema setup.

---

## Placeholder team ranking (`src/data/seedTeams.ts`) — EDIT to your own order, favourite → longshot
*Mock data, ranked 1 (top favourite) to 48 (longshot). Reorder in the admin screen anytime.*

1. France 🇫🇷  2. Spain 🇪🇸  3. England 🏴󠁧󠁢󠁥󠁮󠁧󠁿  4. Brazil 🇧🇷  5. Argentina 🇦🇷  6. Germany 🇩🇪
7. Portugal 🇵🇹  8. Netherlands 🇳🇱  9. Belgium 🇧🇪  10. Italy 🇮🇹  11. Uruguay 🇺🇾  12. Croatia 🇭🇷
13. Colombia 🇨🇴  14. Morocco 🇲🇦  15. USA 🇺🇸  16. Mexico 🇲🇽  17. Japan 🇯🇵  18. Senegal 🇸🇳
19. Switzerland 🇨🇭  20. Denmark 🇩🇰  21. Ecuador 🇪🇨  22. South Korea 🇰🇷  23. Serbia 🇷🇸  24. Canada 🇨🇦
25. Austria 🇦🇹  26. Poland 🇵🇱  27. Australia 🇦🇺  28. Nigeria 🇳🇬  29. Egypt 🇪🇬  30. Ivory Coast 🇨🇮
31. Norway 🇳🇴  32. Turkey 🇹🇷  33. Ghana 🇬🇭  34. Cameroon 🇨🇲  35. Iran 🇮🇷  36. Saudi Arabia 🇸🇦
37. Qatar 🇶🇦  38. Tunisia 🇹🇳  39. Algeria 🇩🇿  40. Paraguay 🇵🇾  41. Peru 🇵🇪  42. Costa Rica 🇨🇷
43. Jamaica 🇯🇲  44. Panama 🇵🇦  45. New Zealand 🇳🇿  46. Jordan 🇯🇴  47. Uzbekistan 🇺🇿  48. Cape Verde 🇨🇻
