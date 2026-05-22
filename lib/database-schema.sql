create table if not exists public.profiles (
  id uuid primary key,
  email text not null unique,
  full_name text,
  plan text not null default 'free',
  subscription_status text not null default 'none',
  stripe_customer_id text,
  stripe_subscription_id text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  audience text not null default '',
  offer text not null default '',
  tone text not null default '',
  cta_style text not null default '',
  preferred_platforms text[] not null default '{}',
  writing_preferences text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null default '',
  audience text not null default '',
  niche text not null default '',
  goals text not null default '',
  preferred_platforms text[] not null default '{}',
  writing_tone text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_content (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  platform text,
  category text,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'waitlist',
  newsletter_opt_in boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_brand_profiles_user_id on public.brand_profiles(user_id);
create index if not exists idx_generation_history_user_created on public.generation_history(user_id, created_at desc);
create index if not exists idx_saved_content_user_created on public.saved_content(user_id, created_at desc);
create index if not exists idx_usage_events_user_created on public.usage_events(user_id, created_at desc);
create index if not exists idx_profiles_stripe_customer on public.profiles(stripe_customer_id);

alter table public.profiles enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.onboarding enable row level security;
alter table public.generation_history enable row level security;
alter table public.saved_content enable row level security;
alter table public.usage_events enable row level security;
alter table public.leads enable row level security;
