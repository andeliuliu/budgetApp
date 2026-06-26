-- Row-Level Security for budgetApp.
--
-- Run AFTER the Prisma schema migration has created the tables
-- (apps/api/prisma/migrations/.../migration.sql).
--
-- Model: the NestJS API connects with the service role and bypasses RLS, doing
-- its own per-user scoping. These policies are defense-in-depth so that if the
-- mobile client (or anything using the anon key) ever queries Postgres directly
-- via Supabase, a user can only ever see their own rows.

-- 1. Mirror auth.users -> public.users on signup, so our FKs have a target.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Enable RLS on every table.
alter table public.users              enable row level security;
alter table public.plaid_items        enable row level security;
alter table public.accounts           enable row level security;
alter table public.transactions       enable row level security;
alter table public.budgets            enable row level security;
alter table public.splits             enable row level security;
alter table public.split_participants enable row level security;

-- 3. Owner-only policies. auth.uid() is the authenticated user's UUID.
create policy users_self on public.users
  for select using (auth.uid() = id);

create policy plaid_items_owner on public.plaid_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy accounts_owner on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy transactions_owner on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy budgets_owner on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Splits/participants are reachable via their transaction's owner.
create policy splits_owner on public.splits
  for all using (
    exists (
      select 1 from public.transactions t
      where t.id = splits.transaction_id and t.user_id = auth.uid()
    )
  );

create policy split_participants_owner on public.split_participants
  for all using (
    exists (
      select 1
      from public.splits s
      join public.transactions t on t.id = s.transaction_id
      where s.id = split_participants.split_id and t.user_id = auth.uid()
    )
  );

-- NOTE: the access token column is never exposed to clients; even with these
-- policies, treat plaid_items.access_token_enc as server-only.
