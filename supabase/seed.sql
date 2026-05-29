-- ============================================================================
-- World Cup 2026 Sweepstake — OPTIONAL seed data
-- ----------------------------------------------------------------------------
-- Run AFTER schema.sql (SQL Editor → paste → Run) to load the 48 teams, their
-- A–L group assignment, all group fixtures, empty knockout slots, and a few
-- sample results.
--
-- You can skip this file entirely: the app auto-seeds the same data the first
-- time it loads against an empty `teams` table. Use this only if you prefer to
-- seed from SQL. Run once (re-running duplicates rows; TRUNCATE first to redo).
--
-- win_probability values are the implied probability of each team's fractional
-- odds (single source of truth for the odds is src/data/footballData.ts).
-- ============================================================================

insert into teams (name, flag_emoji, favourite_rank, group_label, win_probability) values
  ('Spain',                  '🇪🇸', 1,  'A', 0.1667),
  ('France',                 '🇫🇷', 2,  'B', 0.1429),
  ('England',                '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 3,  'C', 0.1176),
  ('Argentina',              '🇦🇷', 4,  'D', 0.1000),
  ('Portugal',               '🇵🇹', 5,  'E', 0.0909),
  ('Brazil',                 '🇧🇷', 6,  'F', 0.0909),
  ('Germany',                '🇩🇪', 7,  'G', 0.0588),
  ('Netherlands',            '🇳🇱', 8,  'H', 0.0385),
  ('Belgium',                '🇧🇪', 9,  'I', 0.0217),
  ('USA',                    '🇺🇸', 10, 'J', 0.0123),
  ('Japan',                  '🇯🇵', 11, 'K', 0.0122),
  ('Uruguay',                '🇺🇾', 12, 'L', 0.0116),
  ('Mexico',                 '🇲🇽', 13, 'A', 0.0116),
  ('Ecuador',                '🇪🇨', 14, 'B', 0.0099),
  ('Croatia',                '🇭🇷', 15, 'C', 0.0099),
  ('Senegal',                '🇸🇳', 16, 'D', 0.0066),
  ('Norway',                 '🇳🇴', 17, 'E', 0.0066),
  ('Switzerland',            '🇨🇭', 18, 'F', 0.0066),
  ('Morocco',                '🇲🇦', 19, 'G', 0.0066),
  ('Austria',                '🇦🇹', 20, 'H', 0.0057),
  ('Sweden',                 '🇸🇪', 21, 'I', 0.0057),
  ('Colombia',               '🇨🇴', 22, 'J', 0.0040),
  ('Turkey',                 '🇹🇷', 23, 'K', 0.0040),
  ('Scotland',               '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 24, 'L', 0.0040),
  ('Canada',                 '🇨🇦', 25, 'A', 0.0040),
  ('Ivory Coast',            '🇨🇮', 26, 'B', 0.0033),
  ('Paraguay',               '🇵🇾', 27, 'C', 0.0033),
  ('Algeria',                '🇩🇿', 28, 'D', 0.0025),
  ('Egypt',                  '🇪🇬', 29, 'E', 0.0025),
  ('Tunisia',                '🇹🇳', 30, 'F', 0.0020),
  ('Czechia',                '🇨🇿', 31, 'G', 0.0020),
  ('South Korea',            '🇰🇷', 32, 'H', 0.0020),
  ('Australia',              '🇦🇺', 33, 'I', 0.0020),
  ('Bosnia and Herzegovina', '🇧🇦', 34, 'J', 0.0020),
  ('Ghana',                  '🇬🇭', 35, 'K', 0.0020),
  ('Iran',                   '🇮🇷', 36, 'L', 0.0013),
  ('DR Congo',               '🇨🇩', 37, 'A', 0.0010),
  ('Saudi Arabia',           '🇸🇦', 38, 'B', 0.0010),
  ('South Africa',           '🇿🇦', 39, 'C', 0.0010),
  ('Qatar',                  '🇶🇦', 40, 'D', 0.0010),
  ('New Zealand',            '🇳🇿', 41, 'E', 0.0007),
  ('Panama',                 '🇵🇦', 42, 'F', 0.0007),
  ('Iraq',                   '🇮🇶', 43, 'G', 0.0005),
  ('Uzbekistan',             '🇺🇿', 44, 'H', 0.0005),
  ('Cape Verde',             '🇨🇻', 45, 'I', 0.0005),
  ('Jordan',                 '🇯🇴', 46, 'J', 0.0004),
  ('Haiti',                  '🇭🇹', 47, 'K', 0.0002),
  ('Curacao',                '🇨🇼', 48, 'L', 0.0002);

-- 2. Group-stage fixtures: round-robin (6 per group), pairings by 0-based index
--    in each group ordered by favourite_rank: (0,1)(2,3)(0,2)(1,3)(0,3)(1,2).
with ranked as (
  select id, group_label,
         row_number() over (partition by group_label order by favourite_rank) - 1 as gi
  from teams
),
pairs(a, b) as (
  values (0, 1), (2, 3), (0, 2), (1, 3), (0, 3), (1, 2)
)
insert into matches (stage, group_label, team_a_id, team_b_id, status)
select 'group', ta.group_label, ta.id, tb.id, 'upcoming'
from pairs p
join ranked ta on ta.gi = p.a
join ranked tb on tb.group_label = ta.group_label and tb.gi = p.b;

-- 3. Empty knockout-bracket slots (filled as results are entered in-app).
insert into matches (stage, bracket_slot, status)
  select 'r32', g, 'upcoming' from generate_series(0, 15) g
union all select 'r16', g, 'upcoming' from generate_series(0, 7) g
union all select 'qf',  g, 'upcoming' from generate_series(0, 3) g
union all select 'sf',  g, 'upcoming' from generate_series(0, 1) g
union all select 'final', 0, 'upcoming'
union all select 'third_place', 0, 'upcoming';

-- 4. A few sample group results so the standings aren't empty on first view.
update matches m
set score_a = s.sa, score_b = s.sb, status = 'finished'
from (values
  ('A', 'Spain',   'Mexico',      2, 1),
  ('A', 'Canada',  'DR Congo',    1, 1),
  ('B', 'France',  'Ecuador',     3, 0),
  ('C', 'England', 'Croatia',     2, 1),
  ('D', 'Argentina','Senegal',    2, 0),
  ('E', 'Portugal','Norway',      1, 1),
  ('F', 'Brazil',  'Switzerland', 3, 1)
) as s(grp, home, away, sa, sb)
join teams ha on ha.name = s.home
join teams aw on aw.name = s.away
where m.stage = 'group' and m.group_label = s.grp
  and m.team_a_id = ha.id and m.team_b_id = aw.id;

-- 5. Default Golden Boot / Golden Glove countries on the shared tournament row.
update tournament set
  top_scorer_team_id  = (select id from teams where name = 'France' limit 1),  -- Mbappé
  clean_sheet_team_id = (select id from teams where name = 'Spain'  limit 1)   -- Unai Simón
where id = 1;

-- 6. A default pool so there's somewhere to land (/s/beenzee). Create more
--    in-app. Set the real create-passcode separately (not committed):
--      update app_config set create_passcode = '...' where id = 1;
insert into sweepstakes (slug, name, admin_passcode, charity_name)
values ('beenzee', 'BeeNZee', 'worldcup2026', 'Charity')
on conflict (slug) do nothing;
