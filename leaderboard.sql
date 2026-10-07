-- Run this entire file once in your Supabase project's SQL Editor.
-- The browser can read the five scores. It cannot write directly to the table.
-- The RPC holds a transaction lock, checks eligibility, and keeps at most five.

create table if not exists public.stratagem_hero_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 20),
  score integer not null check (score > 0),
  round_reached integer not null check (round_reached between 1 and 100000),
  created_at timestamptz not null default now()
);

create unique index if not exists stratagem_hero_scores_name_ci
  on public.stratagem_hero_scores (lower(name));

create index if not exists stratagem_hero_scores_rank
  on public.stratagem_hero_scores (score desc, created_at asc, id asc);

alter table public.stratagem_hero_scores enable row level security;

drop policy if exists stratagem_hero_scores_public_read on public.stratagem_hero_scores;
create policy stratagem_hero_scores_public_read
  on public.stratagem_hero_scores
  for select to anon, authenticated
  using (true);

revoke all on public.stratagem_hero_scores from anon, authenticated;
grant select on public.stratagem_hero_scores to anon, authenticated;

create or replace function public.submit_stratagem_hero_score(
  player_name text,
  points integer,
  round_reached integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := regexp_replace(btrim(player_name), '[[:space:]]+', ' ', 'g');
  submitted_round integer := round_reached;
  previous_id bigint;
  previous_score integer;
  current_count integer;
  fifth_score integer;
  scores jsonb;
begin
  -- Serialize all submissions; the qualification test and top-five trim must
  -- be one transaction to avoid two concurrent players both taking fifth.
  perform pg_advisory_xact_lock(724105226);

  if clean_name is null or char_length(clean_name) not between 2 and 20
      or clean_name ~ '[[:cntrl:]]' then
    raise exception 'Name must be between 2 and 20 characters.' using errcode = '22023';
  end if;
  if points is null or points <= 0 or submitted_round is null
      or submitted_round not between 1 and 100000 then
    raise exception 'Invalid score or round.' using errcode = '22023';
  end if;

  select id, score into previous_id, previous_score
  from public.stratagem_hero_scores
  where lower(name) = lower(clean_name)
  limit 1;

  if previous_id is not null and previous_score >= points then
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) into scores
    from (
      select name, score, round_reached, created_at
      from public.stratagem_hero_scores
      order by score desc, created_at asc, id asc limit 5
    ) as row_data;
    return jsonb_build_object('accepted', false, 'reason', 'This name already has an equal or higher score.', 'leaderboard', scores);
  end if;

  select count(*) into current_count from public.stratagem_hero_scores;
  select score into fifth_score
  from public.stratagem_hero_scores
  order by score desc, created_at asc, id asc
  offset 4 limit 1;

  if previous_id is null and current_count >= 5 and points <= fifth_score then
    select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) into scores
    from (
      select name, score, round_reached, created_at
      from public.stratagem_hero_scores
      order by score desc, created_at asc, id asc limit 5
    ) as row_data;
    return jsonb_build_object('accepted', false, 'reason', 'The top five changed before your score was published.', 'leaderboard', scores);
  end if;

  if previous_id is null then
    insert into public.stratagem_hero_scores (name, score, round_reached)
    values (clean_name, points, submitted_round);
  else
    update public.stratagem_hero_scores
    set name = clean_name, score = points, round_reached = submitted_round, created_at = now()
    where id = previous_id;
  end if;

  delete from public.stratagem_hero_scores
  where id not in (
    select id from public.stratagem_hero_scores
    order by score desc, created_at asc, id asc limit 5
  );

  select coalesce(jsonb_agg(to_jsonb(row_data)), '[]'::jsonb) into scores
  from (
    select name, score, round_reached, created_at
    from public.stratagem_hero_scores
    order by score desc, created_at asc, id asc limit 5
  ) as row_data;

  return jsonb_build_object('accepted', true, 'leaderboard', scores);
end;
$$;

revoke all on function public.submit_stratagem_hero_score(text, integer, integer) from public;
grant execute on function public.submit_stratagem_hero_score(text, integer, integer) to anon, authenticated;