-- Device secrets for Masquerade prevention (time-varying shared secret)
create table if not exists public.device_secrets (
  device_id text primary key,
  secret_key text not null,
  created_at timestamptz default now()
);

alter table public.device_secrets enable row level security;

-- Service role (edge function) uses service key; no anon access required.
-- Optional read policy for authenticated users to view their own devices could be added later.

-- Seed a demo device if not present
insert into public.device_secrets (device_id, secret_key)
select 'dev_001', 'super_secret_123'
where not exists (select 1 from public.device_secrets where device_id = 'dev_001');


