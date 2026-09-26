-- Run once in the Supabase SQL Editor to enable centre registration, personal
-- accounts, centre news, and organisation-scoped access.

alter table public.organizations
  add column if not exists name text;

update public.organizations
set name = 'Friendly Space ' || left(id::text, 8)
where name is null or btrim(name) = '';

alter table public.organizations
  alter column name set not null;

alter table public.users
  add column if not exists account_type text not null default 'friendly_space'
    check (account_type in ('personal', 'friendly_space')),
  add column if not exists app_role text not null default 'center_admin',
  add column if not exists approval_status text not null default 'approved',
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists age integer,
  add column if not exists health_info text,
  add column if not exists member_id uuid;

alter table public.users drop constraint if exists users_app_role_check;
alter table public.users
  add constraint users_app_role_check
  check (app_role in ('center_admin', 'general_user', 'member'));

alter table public.users drop constraint if exists users_approval_status_check;
alter table public.users
  add constraint users_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected', 'suspended'));

alter table public.members
  add column if not exists age integer,
  add column if not exists health_info text,
  add column if not exists user_id uuid references public.users(id) on delete set null;

create unique index if not exists members_user_id_unique
  on public.members (user_id)
  where user_id is not null;

update public.users u
set app_role = 'member',
    member_id = m.id,
    full_name = coalesce(u.full_name, m.name),
    phone = coalesce(u.phone, m.phone),
    age = coalesce(u.age, m.age)
from public.members m
where u.app_role = 'general_user'
  and u.organization_id = m.organization_id
  and lower(u.email) = lower(m.email)
  and m.active = true
  and m.user_id is null;

update public.members m
set user_id = u.id
from public.users u
where u.member_id = m.id
  and m.user_id is null;

alter table public.events
  add column if not exists event_type text,
  add column if not exists status text not null default 'scheduled';

alter table public.activities
  add column if not exists screenings_done integer not null default 0,
  add column if not exists health_talks_given integer not null default 0;

create table if not exists public.organization_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists organization_posts_feed_idx
  on public.organization_posts (organization_id, created_at desc);
grant select, insert, delete on public.organization_posts to authenticated;
grant select (id, name) on public.organizations to anon, authenticated;

create table if not exists public.event_feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  feedback text not null check (char_length(btrim(feedback)) > 0),
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create index if not exists event_feedback_event_idx
  on public.event_feedback (event_id, created_at desc);
grant select, insert on public.event_feedback to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_account_type text;
  requested_organization_id uuid;
  new_organization_id uuid;
  new_app_role text;
  new_approval_status text;
  new_organization_name text;
begin
  requested_account_type := new.raw_user_meta_data ->> 'account_type';

  if requested_account_type = 'friendly_space' then
    new_organization_name := nullif(btrim(new.raw_user_meta_data ->> 'organization_name'), '');
    if new_organization_name is null then
      raise exception 'A friendly space name is required to register a centre';
    end if;

    insert into public.organizations (name)
    values (new_organization_name)
    returning id into new_organization_id;

    new_app_role := 'center_admin';
    new_approval_status := 'approved';
  elsif requested_account_type = 'personal' then
    begin
      requested_organization_id :=
        nullif(new.raw_user_meta_data ->> 'organization_id', '')::uuid;
    exception when invalid_text_representation then
      raise exception 'Choose a valid friendly space';
    end;

    if requested_organization_id is null or not exists (
      select 1
      from public.organizations
      where id = requested_organization_id
    ) then
      raise exception 'Choose an existing friendly space';
    end if;

    new_organization_id := requested_organization_id;
    new_app_role := 'member';
    new_approval_status := 'pending';
  else
    raise exception 'Choose an account type before signing up';
  end if;

  insert into public.users (
    id,
    organization_id,
    email,
    created_at,
    account_type,
    app_role,
    approval_status,
    full_name,
    phone,
    age
  )
  values (
    new.id,
    new_organization_id,
    new.email,
    now(),
    requested_account_type,
    new_app_role,
    new_approval_status,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    nullif(new.raw_user_meta_data ->> 'age', '')::integer
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

create or replace function public.current_user_is_center_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = (select auth.uid())
      and u.organization_id = target_organization_id
      and u.app_role = 'center_admin'
      and u.approval_status = 'approved'
  );
$$;

create or replace function public.current_user_can_view_activity(target_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.activities a
    join public.users u
      on u.id = (select auth.uid())
     and u.organization_id = a.organization_id
     and u.approval_status = 'approved'
    where a.id = target_activity_id
      and (
        u.app_role = 'center_admin'
        or exists (
          select 1
          from public.activity_participants ap
          join public.members m on m.id = ap.member_id
          where ap.activity_id = a.id
            and m.user_id = u.id
        )
      )
  );
$$;

create or replace function public.current_user_is_admin_for_activity(target_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.activities a
    where a.id = target_activity_id
      and public.current_user_is_center_admin(a.organization_id)
  );
$$;

create or replace function public.current_user_can_view_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    join public.users u
      on u.id = (select auth.uid())
     and u.organization_id = e.organization_id
     and u.approval_status = 'approved'
    where e.id = target_event_id
      and (
        u.app_role = 'center_admin'
        or (
          u.app_role in ('member', 'general_user')
          and exists (
            select 1
            from public.event_invitations invitation
            join public.members m on m.id = invitation.member_id
            where invitation.event_id = e.id
              and m.user_id = u.id
              and m.active = true
          )
        )
      )
  );
$$;

create or replace function public.approve_member_request(requested_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_member public.users%rowtype;
  created_member_id uuid;
begin
  select *
  into requested_member
  from public.users
  where id = requested_user_id
    and app_role = 'member'
    and approval_status = 'pending'
    and public.current_user_is_center_admin(organization_id)
  for update;

  if not found then
    raise exception 'Pending member request not found for your friendly space';
  end if;

  select id
  into created_member_id
  from public.members
  where organization_id = requested_member.organization_id
    and lower(email) = lower(requested_member.email)
    and user_id is null
  order by created_at
  limit 1
  for update;

  if created_member_id is null then
    insert into public.members (
      organization_id,
      name,
      phone,
      email,
      age,
      health_info,
      user_id,
      role,
      date_joined,
      active,
      created_at
    )
    values (
      requested_member.organization_id,
      coalesce(requested_member.full_name, requested_member.email),
      requested_member.phone,
      requested_member.email,
      requested_member.age,
      requested_member.health_info,
      requested_member.id,
      'regular_participant',
      current_date,
      true,
      now()
    )
    on conflict (user_id) where user_id is not null do update
      set active = true
    returning id into created_member_id;
  else
    update public.members
    set user_id = requested_member.id,
        name = coalesce(requested_member.full_name, name),
        phone = coalesce(requested_member.phone, phone),
        age = coalesce(requested_member.age, age),
        health_info = coalesce(requested_member.health_info, health_info),
        active = true
    where id = created_member_id;
  end if;

  update public.users
  set approval_status = 'approved',
      member_id = created_member_id
  where id = requested_user_id;
end;
$$;

create or replace function public.reject_member_request(requested_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set approval_status = 'rejected'
  where id = requested_user_id
    and app_role = 'member'
    and approval_status = 'pending'
    and public.current_user_is_center_admin(organization_id);

  if not found then
    raise exception 'Pending member request not found for your friendly space';
  end if;
end;
$$;

create or replace function public.deactivate_member(requested_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_user_id uuid;
begin
  select user_id
  into linked_user_id
  from public.members
  where id = requested_member_id
    and public.current_user_is_center_admin(organization_id)
  for update;

  if not found then
    raise exception 'Member not found in your friendly space';
  end if;

  update public.members
  set active = false
  where id = requested_member_id;

  if linked_user_id is not null then
    update public.users
    set approval_status = 'suspended'
    where id = linked_user_id;
  end if;
end;
$$;

create or replace function public.respond_to_event_invitation(
  requested_invitation_id uuid,
  requested_response text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if requested_response not in ('confirmed', 'declined') then
    raise exception 'Response must be confirmed or declined';
  end if;

  update public.event_invitations invitation
  set status = requested_response,
      updated_at = now()
  from public.members member, public.events event
  where invitation.id = requested_invitation_id
    and invitation.member_id = member.id
    and event.id = invitation.event_id
    and member.user_id = (select auth.uid())
    and member.active = true
    and invitation.status in ('invited', 'confirmed', 'declined')
    and event.date >= current_date
    and event.status <> 'cancelled';

  if not found then
    raise exception 'Invitation not found for the signed-in member';
  end if;
end;
$$;

revoke all on function public.current_user_is_center_admin(uuid) from public, anon;
grant execute on function public.current_user_is_center_admin(uuid) to authenticated;
revoke all on function public.current_user_can_view_activity(uuid) from public, anon;
grant execute on function public.current_user_can_view_activity(uuid) to authenticated;
revoke all on function public.current_user_is_admin_for_activity(uuid) from public, anon;
grant execute on function public.current_user_is_admin_for_activity(uuid) to authenticated;
revoke all on function public.current_user_can_view_event(uuid) from public, anon;
grant execute on function public.current_user_can_view_event(uuid) to authenticated;
revoke all on function public.approve_member_request(uuid) from public, anon;
revoke all on function public.reject_member_request(uuid) from public, anon;
revoke all on function public.deactivate_member(uuid) from public, anon;
revoke all on function public.respond_to_event_invitation(uuid, text) from public, anon;
grant execute on function public.approve_member_request(uuid) to authenticated;
grant execute on function public.reject_member_request(uuid) to authenticated;
grant execute on function public.deactivate_member(uuid) to authenticated;
grant execute on function public.respond_to_event_invitation(uuid, text) to authenticated;

create or replace function public.sync_public_user_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = new.email
  where id = new.id;
  update public.members
  set email = new.email
  where user_id = new.id;
  return new;
end;
$$;

create or replace function public.sync_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.members
  set name = coalesce(new.full_name, new.email),
      phone = new.phone,
      age = new.age,
      health_info = new.health_info
  where user_id = new.id;
  return new;
end;
$$;

create or replace function public.sync_user_profile_from_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.users
    set full_name = new.name,
        phone = new.phone,
        age = new.age,
        health_info = new.health_info
    where id = new.user_id
      and (
        full_name is distinct from new.name
        or phone is distinct from new.phone
        or age is distinct from new.age
        or health_info is distinct from new.health_info
      );
  end if;
  return new;
end;
$$;

revoke all on function public.sync_public_user_email() from public, anon, authenticated;
revoke all on function public.sync_member_profile() from public, anon, authenticated;
revoke all on function public.sync_user_profile_from_member() from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute procedure public.sync_public_user_email();

drop trigger if exists on_public_user_profile_updated on public.users;
create trigger on_public_user_profile_updated
  after update of full_name, phone, age, health_info on public.users
  for each row execute procedure public.sync_member_profile();

drop trigger if exists on_member_profile_updated on public.members;
create trigger on_member_profile_updated
  after update of name, phone, age, health_info, user_id on public.members
  for each row execute procedure public.sync_user_profile_from_member();

alter table public.organizations enable row level security;
drop policy if exists friendly_spaces_signup_list on public.organizations;
create policy friendly_spaces_signup_list
  on public.organizations
  for select
  to anon, authenticated
  using (true);

alter table public.users enable row level security;
drop policy if exists users_read_self on public.users;
create policy users_read_self
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));
drop policy if exists users_admin_read_members on public.users;
create policy users_admin_read_members
  on public.users
  for select
  to authenticated
  using (public.current_user_is_center_admin(organization_id));
drop policy if exists users_read_self_guard on public.users;
create policy users_read_self_guard
  on public.users
  as restrictive
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or public.current_user_is_center_admin(organization_id)
  );
drop policy if exists users_no_client_insert_guard on public.users;
create policy users_no_client_insert_guard
  on public.users
  as restrictive
  for insert
  to authenticated
  with check (false);
drop policy if exists users_no_client_update_guard on public.users;
create policy users_no_client_update_guard
  on public.users
  as restrictive
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
drop policy if exists users_update_self_profile on public.users;
create policy users_update_self_profile
  on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
revoke update on public.users from public, anon, authenticated;
grant update (full_name, phone, age) on public.users to authenticated;
drop policy if exists users_no_client_delete_guard on public.users;
create policy users_no_client_delete_guard
  on public.users
  as restrictive
  for delete
  to authenticated
  using (false);

alter table public.events enable row level security;
drop policy if exists events_read_same_friendly_space on public.events;
create policy events_read_same_friendly_space
  on public.events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.approval_status = 'approved'
    )
  );
drop policy if exists events_read_same_friendly_space_guard on public.events;
create policy events_read_same_friendly_space_guard
  on public.events
  as restrictive
  for select
  to authenticated
  using (public.current_user_can_view_event(id));
drop policy if exists events_admin_write on public.events;
create policy events_admin_write
  on public.events
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.app_role = 'center_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists events_admin_write_guard on public.events;
drop policy if exists events_admin_insert_guard on public.events;
create policy events_admin_insert_guard
  on public.events
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists events_admin_update_guard on public.events;
create policy events_admin_update_guard
  on public.events
  as restrictive
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.app_role = 'center_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists events_admin_delete_guard on public.events;
create policy events_admin_delete_guard
  on public.events
  as restrictive
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.app_role = 'center_admin'
    )
  );

alter table public.organization_posts enable row level security;
drop policy if exists organization_posts_read_same_friendly_space on public.organization_posts;
create policy organization_posts_read_same_friendly_space
  on public.organization_posts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organization_posts.organization_id
    )
  );
drop policy if exists organization_posts_admin_create on public.organization_posts;
create policy organization_posts_admin_create
  on public.organization_posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organization_posts.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists organization_posts_admin_delete on public.organization_posts;
create policy organization_posts_admin_delete
  on public.organization_posts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organization_posts.organization_id
        and u.app_role = 'center_admin'
    )
  );

-- General users may only read their centre's events and posts. Restrictive
-- policies also constrain any older permissive policies on these tables.
alter table public.members enable row level security;
drop policy if exists members_center_admin_access on public.members;
create policy members_center_admin_access
  on public.members
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = members.organization_id
        and u.app_role = 'center_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = members.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists members_center_admin_guard on public.members;
drop policy if exists members_member_read_self on public.members;
create policy members_member_read_self
  on public.members
  for select
  to authenticated
  using (user_id = (select auth.uid()));
create policy members_center_admin_guard
  on public.members
  as restrictive
  for all
  to authenticated
  using (
    public.current_user_is_center_admin(organization_id)
    or user_id = (select auth.uid())
  )
  with check (public.current_user_is_center_admin(organization_id));

alter table public.activities enable row level security;
drop policy if exists activities_center_admin_access on public.activities;
create policy activities_center_admin_access
  on public.activities
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = activities.organization_id
        and u.app_role = 'center_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = activities.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists activities_center_admin_guard on public.activities;
drop policy if exists activities_member_participant_read on public.activities;
create policy activities_member_participant_read
  on public.activities
  for select
  to authenticated
  using (public.current_user_can_view_activity(id));
drop policy if exists activities_center_admin_select_guard on public.activities;
create policy activities_center_admin_select_guard
  on public.activities
  as restrictive
  for select
  to authenticated
  using (public.current_user_can_view_activity(id));
drop policy if exists activities_center_admin_insert_guard on public.activities;
create policy activities_center_admin_insert_guard
  on public.activities
  as restrictive
  for insert
  to authenticated
  with check (public.current_user_is_center_admin(organization_id));
drop policy if exists activities_center_admin_update_guard on public.activities;
create policy activities_center_admin_update_guard
  on public.activities
  as restrictive
  for update
  to authenticated
  using (public.current_user_is_center_admin(organization_id))
  with check (public.current_user_is_center_admin(organization_id));
drop policy if exists activities_center_admin_delete_guard on public.activities;
create policy activities_center_admin_delete_guard
  on public.activities
  as restrictive
  for delete
  to authenticated
  using (public.current_user_is_center_admin(organization_id));

alter table public.activity_participants enable row level security;
drop policy if exists activity_participants_center_admin_access on public.activity_participants;
create policy activity_participants_center_admin_access
  on public.activity_participants
  for all
  to authenticated
  using (public.current_user_is_admin_for_activity(activity_id))
  with check (public.current_user_is_admin_for_activity(activity_id));
drop policy if exists activity_participants_member_read_self on public.activity_participants;
create policy activity_participants_member_read_self
  on public.activity_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = activity_participants.member_id
        and m.user_id = (select auth.uid())
    )
  );
drop policy if exists activity_participants_center_admin_guard on public.activity_participants;
create policy activity_participants_center_admin_guard
  on public.activity_participants
  as restrictive
  for all
  to authenticated
  using (
    public.current_user_is_admin_for_activity(activity_id)
    or exists (
      select 1
      from public.members m
      where m.id = activity_participants.member_id
        and m.user_id = (select auth.uid())
    )
  )
  with check (public.current_user_is_admin_for_activity(activity_id));

alter table public.event_invitations enable row level security;
drop policy if exists event_invitations_center_admin_access on public.event_invitations;
create policy event_invitations_center_admin_access
  on public.event_invitations
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      join public.users u on u.id = (select auth.uid())
      where e.id = event_invitations.event_id
        and e.organization_id = u.organization_id
        and u.app_role = 'center_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      join public.users u on u.id = (select auth.uid())
      where e.id = event_invitations.event_id
        and e.organization_id = u.organization_id
        and u.app_role = 'center_admin'
    )
  );
drop policy if exists event_invitations_center_admin_guard on public.event_invitations;
create policy event_invitations_center_admin_guard
  on public.event_invitations
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      join public.users u on u.id = (select auth.uid())
      where e.id = event_invitations.event_id
        and e.organization_id = u.organization_id
        and u.app_role = 'center_admin'
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      join public.users u on u.id = (select auth.uid())
      where e.id = event_invitations.event_id
        and e.organization_id = u.organization_id
        and u.app_role = 'center_admin'
    )
  );

drop policy if exists event_invitations_member_read_self on public.event_invitations;
create policy event_invitations_member_read_self
  on public.event_invitations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = event_invitations.member_id
        and m.user_id = (select auth.uid())
        and m.active = true
    )
  );
drop policy if exists event_invitations_center_admin_guard on public.event_invitations;
drop policy if exists event_invitations_select_guard on public.event_invitations;
create policy event_invitations_select_guard
  on public.event_invitations
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_invitations.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
    or exists (
      select 1
      from public.members m
      where m.id = event_invitations.member_id
        and m.user_id = (select auth.uid())
        and m.active = true
    )
  );
drop policy if exists event_invitations_insert_guard on public.event_invitations;
create policy event_invitations_insert_guard
  on public.event_invitations
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.events e
      where e.id = event_invitations.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
  );
drop policy if exists event_invitations_update_guard on public.event_invitations;
create policy event_invitations_update_guard
  on public.event_invitations
  as restrictive
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_invitations.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.events e
      where e.id = event_invitations.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
  );
drop policy if exists event_invitations_delete_guard on public.event_invitations;
create policy event_invitations_delete_guard
  on public.event_invitations
  as restrictive
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_invitations.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
  );

alter table public.event_feedback enable row level security;
drop policy if exists event_feedback_admin_read on public.event_feedback;
create policy event_feedback_admin_read
  on public.event_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_feedback.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
  );
drop policy if exists event_feedback_member_read_self on public.event_feedback;
create policy event_feedback_member_read_self
  on public.event_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members m
      where m.id = event_feedback.member_id
        and m.user_id = (select auth.uid())
    )
  );
drop policy if exists event_feedback_member_submit on public.event_feedback;
create policy event_feedback_member_submit
  on public.event_feedback
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.members m
      join public.event_invitations invitation on invitation.member_id = m.id
      where m.id = event_feedback.member_id
        and m.user_id = (select auth.uid())
        and m.active = true
        and invitation.event_id = event_feedback.event_id
        and invitation.status = 'attended'
    )
  );
drop policy if exists event_feedback_read_guard on public.event_feedback;
create policy event_feedback_read_guard
  on public.event_feedback
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.events e
      where e.id = event_feedback.event_id
        and public.current_user_is_center_admin(e.organization_id)
    )
    or exists (
      select 1
      from public.members m
      where m.id = event_feedback.member_id
        and m.user_id = (select auth.uid())
    )
  );
drop policy if exists event_feedback_insert_guard on public.event_feedback;
create policy event_feedback_insert_guard
  on public.event_feedback
  as restrictive
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.members m
      join public.event_invitations invitation on invitation.member_id = m.id
      where m.id = event_feedback.member_id
        and m.user_id = (select auth.uid())
        and m.active = true
        and invitation.event_id = event_feedback.event_id
        and invitation.status = 'attended'
    )
  );
drop policy if exists event_feedback_no_update_guard on public.event_feedback;
create policy event_feedback_no_update_guard
  on public.event_feedback
  as restrictive
  for update
  to authenticated
  using (false)
  with check (false);
drop policy if exists event_feedback_no_delete_guard on public.event_feedback;
create policy event_feedback_no_delete_guard
  on public.event_feedback
  as restrictive
  for delete
  to authenticated
  using (false);

grant select, insert, update, delete on public.members to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.event_invitations to authenticated;
grant select, insert, delete on public.activity_participants to authenticated;

drop policy if exists organization_posts_read_same_friendly_space on public.organization_posts;
create policy organization_posts_read_same_friendly_space
  on public.organization_posts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organization_posts.organization_id
        and u.approval_status = 'approved'
    )
  );
