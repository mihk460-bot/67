create table public.merchants (
  id bigint generated always as identity primary key,
  username text not null unique,
  password_hash text not null,
  session_version integer not null default 1,
  parent_merchant_id bigint references public.merchants(id) on delete cascade,
  is_active boolean not null default true,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

create table public.notifications (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

grant all on public.merchants to service_role;
grant all on public.settings to service_role;
grant all on public.notifications to service_role;

alter table public.merchants enable row level security;
alter table public.settings enable row level security;
alter table public.notifications enable row level security;

insert into public.settings (key, value) values
  ('prices', '{"gold24Price":0,"gold22Price":0,"gold21Price":0,"gold18Price":0,"silver999Price":0,"silver925Price":0,"silver900Price":0,"silver800Price":0}'),
  ('displayCounter', '0'),
  ('supportContact', '""'),
  ('supportContactType', '"phone"')
on conflict (key) do nothing;