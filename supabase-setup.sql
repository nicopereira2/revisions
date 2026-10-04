-- À coller dans Supabase → SQL Editor → Run. Une seule fois.

create table if not exists public.user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  rev        integer not null default 1,
  updated_at timestamptz not null default now()
);

-- Chaque compte ne voit et ne modifie QUE sa propre ligne.
alter table public.user_data enable row level security;

drop policy if exists "user_data_select_own" on public.user_data;
drop policy if exists "user_data_insert_own" on public.user_data;
drop policy if exists "user_data_update_own" on public.user_data;
drop policy if exists "user_data_delete_own" on public.user_data;

create policy "user_data_select_own" on public.user_data
  for select to authenticated using (auth.uid() = user_id);
create policy "user_data_insert_own" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_data_update_own" on public.user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_data_delete_own" on public.user_data
  for delete to authenticated using (auth.uid() = user_id);

-- Les comptes connectés ont le droit d'utiliser la table (les règles ci-dessus limitent à leur propre ligne).
grant select, insert, update, delete on public.user_data to authenticated;

-- Les visiteurs non connectés n'ont aucun accès.
revoke all on public.user_data from anon;
