-- Masters Pool Schema
-- Run this in the Supabase SQL editor

-- Players in the Masters field, classified by tier
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  espn_id text,
  world_rank int,
  tier int not null check (tier between 1 and 7),
  is_liv boolean default false,
  in_field boolean default true,
  created_at timestamptz default now()
);

-- Draft picks
create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  drafted_by text not null check (drafted_by in ('cody', 'jeremy')),
  tier int not null,
  pick_order int not null,
  created_at timestamptz default now(),
  unique(player_id),
  unique(pick_order)
);

-- Single-row draft state
create table if not exists draft_state (
  id int primary key default 1,
  current_pick_order int default 1,
  current_drafter text default 'cody',
  current_tier int default 1,
  tier_pick_index int default 0, -- how many picks done in current tier (for snake)
  is_complete boolean default false,
  first_drafter text default 'cody' -- who goes first overall (settable in admin)
);

-- Seed draft state row
insert into draft_state (id) values (1) on conflict (id) do nothing;

-- Enable Row Level Security (open for now since it's a private app)
alter table players enable row level security;
alter table picks enable row level security;
alter table draft_state enable row level security;

create policy "Allow all on players" on players for all using (true) with check (true);
create policy "Allow all on picks" on picks for all using (true) with check (true);
create policy "Allow all on draft_state" on draft_state for all using (true) with check (true);
