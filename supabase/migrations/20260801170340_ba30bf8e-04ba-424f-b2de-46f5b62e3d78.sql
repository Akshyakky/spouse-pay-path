-- enums
create type public.app_role as enum ('admin','family');
create type public.member_relationship as enum ('wife','husband','daughter','son','other');
create type public.payment_mode as enum ('cash','online');
create type public.payment_status as enum ('pending','approved','rejected');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  full_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "profiles_select_self_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "user_roles_select_self_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- on signup: create profile, first ever user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;

  if (new.raw_user_meta_data->>'app_role') = 'family' then
    insert into public.user_roles (user_id, role) values (new.id,'family') on conflict do nothing;
  elsif not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id,'admin') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id,'family') on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- families
create sequence public.family_no_seq;
create table public.families (
  id uuid primary key default gen_random_uuid(),
  family_no text not null unique default 'FAM-' || lpad(nextval('public.family_no_seq')::text, 4, '0'),
  family_name text not null,
  address text,
  contact_phone text,
  contact_email text,
  family_photo_url text,
  wife_user_id uuid unique references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.families to authenticated;
grant all on public.families to service_role;
alter table public.families enable row level security;

create or replace function public.is_family_owner(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.families where id = _family_id and wife_user_id = auth.uid())
$$;

create policy "families_admin_all" on public.families for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "families_owner_select" on public.families for select to authenticated
  using (wife_user_id = auth.uid());
create policy "families_owner_update" on public.families for update to authenticated
  using (wife_user_id = auth.uid()) with check (wife_user_id = auth.uid());

-- family members
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  relationship public.member_relationship not null,
  full_name text not null,
  gender text,
  date_of_birth date,
  contact text,
  photo_url text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.family_members to authenticated;
grant all on public.family_members to service_role;
alter table public.family_members enable row level security;

create policy "members_admin_all" on public.family_members for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "members_owner_all" on public.family_members for all to authenticated
  using (public.is_family_owner(family_id)) with check (public.is_family_owner(family_id));

-- payments
create sequence public.voucher_no_seq;
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  voucher_no text not null unique default 'VCH-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.voucher_no_seq')::text, 5, '0'),
  family_id uuid not null references public.families(id) on delete cascade,
  paid_by text,
  mode public.payment_mode not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  txn_ref text,
  screenshot_url text,
  remarks text,
  status public.payment_status not null default 'pending',
  admin_remarks text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

create policy "payments_admin_all" on public.payments for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "payments_owner_select" on public.payments for select to authenticated
  using (public.is_family_owner(family_id));
create policy "payments_owner_insert" on public.payments for insert to authenticated
  with check (public.is_family_owner(family_id) and status = 'pending' and created_by = auth.uid());

-- expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default current_date,
  description text,
  attachment_url text,
  family_id uuid references public.families(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;

create policy "expenses_admin_all" on public.expenses for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- updated_at helper
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger families_touch before update on public.families
for each row execute function public.touch_updated_at();
create trigger members_touch before update on public.family_members
for each row execute function public.touch_updated_at();