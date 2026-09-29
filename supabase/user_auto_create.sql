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
  add column if not exists status text not null default 'scheduled',
  add column if not exists cover_image_path text,
  add column if not exists people_reached integer not null default 0,
  add column if not exists contraceptives_distributed integer not null default 0,
  add column if not exists pregnancies_identified integer not null default 0,
  add column if not exists health_screenings integer not null default 0,
  add column if not exists health_talks_held integer not null default 0,
  add column if not exists notes text,
  add column if not exists photo_url text,
  add column if not exists is_posted_to_community boolean not null default false,
  add column if not exists post_id uuid;

alter table public.events drop constraint if exists events_outcome_metrics_nonnegative;
alter table public.events
  add constraint events_outcome_metrics_nonnegative
  check (
    people_reached >= 0
    and contraceptives_distributed >= 0
    and pregnancies_identified >= 0
    and health_screenings >= 0
    and health_talks_held >= 0
  );

create table if not exists public.organization_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null check (char_length(btrim(body)) > 0),
  cover_image_path text,
  created_at timestamptz not null default now()
);

alter table public.organization_posts
  add column if not exists cover_image_path text;

create index if not exists organization_posts_feed_idx
  on public.organization_posts (organization_id, created_at desc);
grant select, insert, delete on public.organization_posts to authenticated;
grant select (id, name) on public.organizations to anon, authenticated;

create table if not exists public.organization_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.organization_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  reaction text not null default 'love' check (reaction = 'love'),
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create table if not exists public.organization_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.organization_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

create index if not exists organization_post_reactions_post_idx
  on public.organization_post_reactions (post_id);
create index if not exists organization_post_views_post_idx
  on public.organization_post_views (post_id);
revoke all on public.organization_post_reactions, public.organization_post_views from public, anon;
grant select, insert, delete on public.organization_post_reactions to authenticated;
grant select, insert on public.organization_post_views to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-post-covers',
  'organization-post-covers',
  false,
  2097152,
  array['image/jpeg', 'image/webp']
)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.users(id) on delete cascade,
  request_user_id uuid not null references public.users(id) on delete cascade,
  notification_type text not null default 'member_request',
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (recipient_id, request_user_id, notification_type)
);

do $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%notification_type%'
  loop
    execute format('alter table public.notifications drop constraint %I', existing_constraint.conname);
  end loop;
end;
$$;

alter table public.notifications
  drop constraint if exists notifications_recipient_id_request_user_id_notification_type_key;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 5 and 100),
  scheduled_at timestamptz not null,
  location text not null check (char_length(btrim(location)) between 1 and 100),
  description text check (description is null or char_length(description) <= 500),
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  topic text,
  announcements text,
  notes text,
  photo_path text,
  post_id uuid references public.organization_posts(id) on delete set null,
  is_posted_to_community boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_facilitators (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  assigned_by uuid references public.users(id) on delete set null,
  confirmed_at timestamptz,
  attended boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create table if not exists public.meeting_attendance (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  attended boolean not null default false,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (meeting_id, member_id)
);

create index if not exists meetings_org_scheduled_idx
  on public.meetings (organization_id, scheduled_at);
create index if not exists meeting_facilitators_user_idx
  on public.meeting_facilitators (user_id, meeting_id);
create index if not exists meeting_attendance_member_idx
  on public.meeting_attendance (member_id, updated_at desc);

alter table public.meeting_facilitators
  add column if not exists assigned_by uuid references public.users(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists attended boolean not null default false;
alter table public.meeting_attendance
  add column if not exists attended boolean not null default false,
  add column if not exists updated_by uuid references public.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'meeting_attendance'
  ) then
    execute 'alter publication supabase_realtime add table public.meeting_attendance';
  end if;
end;
$$;

alter table public.notifications
  add column if not exists meeting_id uuid references public.meetings(id) on delete cascade,
  add column if not exists post_id uuid references public.organization_posts(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (notification_type in ('member_request', 'meeting_assignment', 'community_post'));

create unique index if not exists notifications_community_post_recipient_unique
  on public.notifications (recipient_id, post_id)
  where notification_type = 'community_post' and post_id is not null;
create unique index if not exists notifications_meeting_assignment_recipient_unique
  on public.notifications (recipient_id, meeting_id)
  where notification_type = 'meeting_assignment' and meeting_id is not null;
create unique index if not exists notifications_member_request_recipient_unique
  on public.notifications (recipient_id, request_user_id, notification_type)
  where notification_type = 'member_request';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_post_id_fkey'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_post_id_fkey
      foreign key (post_id) references public.organization_posts(id) on delete set null;
  end if;
end;
$$;

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;

create or replace function public.notify_meeting_facilitator_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meeting_record public.meetings%rowtype;
begin
  select * into meeting_record
  from public.meetings
  where id = new.meeting_id;

  if meeting_record.created_by is not null
      and new.user_id <> meeting_record.created_by then
    insert into public.notifications (
      organization_id, recipient_id, request_user_id, notification_type,
      meeting_id, title, body
    )
    values (
      meeting_record.organization_id,
      new.user_id,
      coalesce(new.assigned_by, meeting_record.created_by),
      'meeting_assignment',
      new.meeting_id,
      'You were added as a meeting facilitator',
      'You have been assigned to facilitate "' || meeting_record.title || '".'
    )
    -- Older installations may still have the former request-based unique
    -- constraint. Ignore any duplicate notification so it cannot abort the
    -- facilitator assignment (and the meeting creation flow).
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists meeting_facilitator_assignment_notification on public.meeting_facilitators;
create trigger meeting_facilitator_assignment_notification
  after insert on public.meeting_facilitators
  for each row execute function public.notify_meeting_facilitator_assignment();

create or replace function public.notify_members_of_community_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id is not null then
    insert into public.notifications (
      organization_id, recipient_id, request_user_id, notification_type,
      post_id, title, body
    )
    select
      new.organization_id,
      u.id,
      new.author_id,
      'community_post',
      new.id,
      'New Centre News',
      new.title
    from public.users u
    where u.organization_id = new.organization_id
      and u.app_role in ('member', 'general_user')
      and u.approval_status = 'approved'
      and u.id <> new.author_id
    on conflict (recipient_id, post_id)
      where notification_type = 'community_post' and post_id is not null
      do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists organization_post_member_notification on public.organization_posts;
create trigger organization_post_member_notification
  after insert on public.organization_posts
  for each row execute function public.notify_members_of_community_post();

create or replace function public.detach_deleted_community_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set post_id = null,
      is_posted_to_community = false
  where post_id = old.id;

  update public.meetings
  set post_id = null,
      is_posted_to_community = false
  where post_id = old.id;
  return old;
end;
$$;

drop trigger if exists organization_post_detach_content on public.organization_posts;
create trigger organization_post_detach_content
  before delete on public.organization_posts
  for each row execute function public.detach_deleted_community_post();

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

create or replace function public.notify_center_admin_of_member_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.app_role = 'member' and new.approval_status = 'pending' then
    insert into public.notifications (
      organization_id,
      recipient_id,
      request_user_id,
      notification_type,
      title,
      body
    )
    select
      new.organization_id,
      admin.id,
      new.id,
      'member_request',
      'New membership request',
      coalesce(nullif(btrim(new.full_name), ''), new.email)
        || ' requested to join your friendly space.'
    from public.users admin
    where admin.organization_id = new.organization_id
      and admin.app_role = 'center_admin'
      and admin.approval_status = 'approved'
    on conflict (recipient_id, request_user_id, notification_type)
      where notification_type = 'member_request'
      do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_center_admin_of_member_request() from public, anon, authenticated;

drop trigger if exists on_member_request_created on public.users;
create trigger on_member_request_created
  after insert on public.users
  for each row execute procedure public.notify_center_admin_of_member_request();

insert into public.notifications (
  organization_id,
  recipient_id,
  request_user_id,
  notification_type,
  title,
  body
)
select
  request.organization_id,
  admin.id,
  request.id,
  'member_request',
  'New membership request',
  coalesce(nullif(btrim(request.full_name), ''), request.email)
    || ' requested to join your friendly space.'
from public.users request
join public.users admin
  on admin.organization_id = request.organization_id
 and admin.app_role = 'center_admin'
 and admin.approval_status = 'approved'
where request.app_role = 'member'
  and request.approval_status = 'pending'
on conflict (recipient_id, request_user_id, notification_type)
  where notification_type = 'member_request'
  do nothing;

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

-- These helpers run as their owner so meeting and attendance policies can
-- inspect each other's tables without recursively invoking row-level security.
create or replace function public.current_user_is_meeting_attendee(target_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meeting_attendance attendance
    join public.members member on member.id = attendance.member_id
    where attendance.meeting_id = target_meeting_id
      and attendance.attended = true
      and member.user_id = (select auth.uid())
      and member.active = true
  );
$$;

create or replace function public.current_user_is_meeting_facilitator(target_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meeting_facilitators facilitator
    where facilitator.meeting_id = target_meeting_id
      and facilitator.user_id = (select auth.uid())
  );
$$;

create or replace function public.current_user_is_admin_for_meeting(target_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meetings meeting
    join public.users admin
      on admin.id = (select auth.uid())
     and admin.organization_id = meeting.organization_id
     and admin.app_role = 'center_admin'
     and admin.approval_status = 'approved'
    where meeting.id = target_meeting_id
  );
$$;

create or replace function public.current_user_can_manage_meeting_attendance(
  target_meeting_id uuid,
  target_member_id uuid,
  target_updated_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_updated_by = (select auth.uid()) and exists (
    select 1
    from public.meetings meeting
    join public.users admin
      on admin.id = (select auth.uid())
     and admin.organization_id = meeting.organization_id
     and admin.app_role = 'center_admin'
     and admin.approval_status = 'approved'
    join public.members member
      on member.id = target_member_id
     and member.organization_id = meeting.organization_id
    where meeting.id = target_meeting_id
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

create or replace function public.request_friendly_space_change(requested_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  requesting_user public.users%rowtype;
begin
  select *
  into requesting_user
  from public.users
  where id = (select auth.uid())
    and account_type = 'personal'
    and app_role = 'member'
    and approval_status = 'approved'
  for update;

  if not found then
    raise exception 'Only an approved member can request a friendly space change';
  end if;

  if requested_organization_id is null
    or requested_organization_id = requesting_user.organization_id
    or not exists (
      select 1
      from public.organizations
      where id = requested_organization_id
    )
  then
    raise exception 'Choose a different, existing friendly space';
  end if;

  update public.members
  set active = false,
      user_id = null
  where user_id = requesting_user.id;

  update public.users
  set organization_id = requested_organization_id,
      approval_status = 'pending',
      member_id = null
  where id = requesting_user.id;

  insert into public.notifications (
    organization_id,
    recipient_id,
    request_user_id,
    notification_type,
    title,
    body
  )
  select
    requested_organization_id,
    admin.id,
    requesting_user.id,
    'member_request',
    'New membership request',
    coalesce(nullif(btrim(requesting_user.full_name), ''), requesting_user.email)
      || ' requested to join your friendly space.'
  from public.users admin
  where admin.organization_id = requested_organization_id
    and admin.app_role = 'center_admin'
    and admin.approval_status = 'approved'
  on conflict (recipient_id, request_user_id, notification_type)
    where notification_type = 'member_request'
    do nothing;
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
revoke all on function public.current_user_is_meeting_attendee(uuid) from public, anon;
grant execute on function public.current_user_is_meeting_attendee(uuid) to authenticated;
revoke all on function public.current_user_is_meeting_facilitator(uuid) from public, anon;
grant execute on function public.current_user_is_meeting_facilitator(uuid) to authenticated;
revoke all on function public.current_user_is_admin_for_meeting(uuid) from public, anon;
grant execute on function public.current_user_is_admin_for_meeting(uuid) to authenticated;
revoke all on function public.current_user_can_manage_meeting_attendance(uuid, uuid, uuid) from public, anon;
grant execute on function public.current_user_can_manage_meeting_attendance(uuid, uuid, uuid) to authenticated;
revoke all on function public.current_user_can_view_event(uuid) from public, anon;
grant execute on function public.current_user_can_view_event(uuid) to authenticated;
revoke all on function public.approve_member_request(uuid) from public, anon;
revoke all on function public.reject_member_request(uuid) from public, anon;
revoke all on function public.request_friendly_space_change(uuid) from public, anon;
revoke all on function public.deactivate_member(uuid) from public, anon;
revoke all on function public.respond_to_event_invitation(uuid, text) from public, anon;
grant execute on function public.approve_member_request(uuid) to authenticated;
grant execute on function public.reject_member_request(uuid) to authenticated;
grant execute on function public.request_friendly_space_change(uuid) to authenticated;
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
grant update (full_name, phone) on public.users to authenticated;
drop policy if exists users_no_client_delete_guard on public.users;
create policy users_no_client_delete_guard
  on public.users
  as restrictive
  for delete
  to authenticated
  using (false);

alter table public.notifications enable row level security;
drop policy if exists notifications_admin_read_own on public.notifications;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own
  on public.notifications
  for select
  to authenticated
  using (
    recipient_id = (select auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = notifications.organization_id
        and u.approval_status = 'approved'
    )
  );
drop policy if exists notifications_admin_update_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (
    recipient_id = (select auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = notifications.organization_id
        and u.approval_status = 'approved'
    )
  )
  with check (
    recipient_id = (select auth.uid())
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = notifications.organization_id
        and u.approval_status = 'approved'
    )
  );
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

alter table public.meetings enable row level security;
drop policy if exists meetings_read_admin_or_attendee on public.meetings;
create policy meetings_read_admin_or_attendee
  on public.meetings
  for select
  to authenticated
  using (
    public.current_user_is_center_admin(organization_id)
    or public.current_user_is_meeting_attendee(id)
    or public.current_user_is_meeting_facilitator(id)
  );
drop policy if exists meetings_admin_insert on public.meetings;
create policy meetings_admin_insert
  on public.meetings
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.current_user_is_center_admin(organization_id)
  );
drop policy if exists meetings_admin_update on public.meetings;
create policy meetings_admin_update
  on public.meetings
  for update
  to authenticated
  using (public.current_user_is_center_admin(organization_id))
  with check (public.current_user_is_center_admin(organization_id));
drop policy if exists meetings_admin_delete on public.meetings;
create policy meetings_admin_delete
  on public.meetings
  for delete
  to authenticated
  using (public.current_user_is_center_admin(organization_id));

alter table public.meeting_facilitators enable row level security;
drop policy if exists meeting_facilitators_read_admin_or_self on public.meeting_facilitators;
create policy meeting_facilitators_read_admin_or_self
  on public.meeting_facilitators
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.meetings meeting
      where meeting.id = meeting_facilitators.meeting_id
        and public.current_user_is_center_admin(meeting.organization_id)
    )
  );
drop policy if exists meeting_facilitators_admin_manage on public.meeting_facilitators;
create policy meeting_facilitators_admin_manage
  on public.meeting_facilitators
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.meetings meeting
      where meeting.id = meeting_facilitators.meeting_id
        and public.current_user_is_center_admin(meeting.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.meetings meeting
      join public.users facilitator
        on facilitator.id = meeting_facilitators.user_id
       and facilitator.organization_id = meeting.organization_id
       and facilitator.app_role in ('member', 'general_user')
       and facilitator.approval_status = 'approved'
      join public.members facilitator_member
        on facilitator_member.user_id = facilitator.id
       and facilitator_member.organization_id = meeting.organization_id
       and facilitator_member.active = true
      where meeting.id = meeting_facilitators.meeting_id
        and public.current_user_is_center_admin(meeting.organization_id)
    )
  );

alter table public.meeting_attendance enable row level security;
drop policy if exists meeting_attendance_read_admin_or_self on public.meeting_attendance;
create policy meeting_attendance_read_admin_or_self
  on public.meeting_attendance
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.members member
      where member.id = meeting_attendance.member_id
        and member.user_id = (select auth.uid())
    )
    or public.current_user_is_admin_for_meeting(meeting_attendance.meeting_id)
  );
drop policy if exists meeting_attendance_admin_manage on public.meeting_attendance;
create policy meeting_attendance_admin_manage
  on public.meeting_attendance
  for all
  to authenticated
  using (
    public.current_user_is_admin_for_meeting(meeting_attendance.meeting_id)
  )
  with check (
    public.current_user_can_manage_meeting_attendance(
      meeting_attendance.meeting_id,
      meeting_attendance.member_id,
      meeting_attendance.updated_by
    )
  );

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
  using (
    exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.approval_status = 'approved'
    )
  );
drop policy if exists events_admin_write on public.events;
create policy events_admin_write
  on public.events
  for all
  to authenticated
  using (public.current_user_is_center_admin(events.organization_id))
  with check (public.current_user_is_center_admin(events.organization_id));
drop policy if exists events_admin_write_guard on public.events;
drop policy if exists events_admin_insert_guard on public.events;
create policy events_admin_insert_guard
  on public.events
  as restrictive
  for insert
  to authenticated
  with check (public.current_user_is_center_admin(events.organization_id));
drop policy if exists events_admin_update_guard on public.events;
create policy events_admin_update_guard
  on public.events
  as restrictive
  for update
  to authenticated
  using (public.current_user_is_center_admin(events.organization_id))
  with check (public.current_user_is_center_admin(events.organization_id));
drop policy if exists events_admin_delete_guard on public.events;
create policy events_admin_delete_guard
  on public.events
  as restrictive
  for delete
  to authenticated
  using (public.current_user_is_center_admin(events.organization_id));

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

alter table public.organization_post_reactions enable row level security;
drop policy if exists organization_post_reactions_same_org on public.organization_post_reactions;
create policy organization_post_reactions_same_org
  on public.organization_post_reactions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_reactions.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_reactions_insert_self on public.organization_post_reactions;
create policy organization_post_reactions_insert_self
  on public.organization_post_reactions
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and reaction = 'love'
    and exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_reactions.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_reactions_delete_self on public.organization_post_reactions;
create policy organization_post_reactions_delete_self
  on public.organization_post_reactions
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_reactions.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_reactions_guard on public.organization_post_reactions;
drop policy if exists organization_post_reactions_select_guard on public.organization_post_reactions;
create policy organization_post_reactions_select_guard
  on public.organization_post_reactions
  as restrictive
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_reactions.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_reactions_insert_guard on public.organization_post_reactions;
create policy organization_post_reactions_insert_guard
  on public.organization_post_reactions
  as restrictive
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_reactions.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_reactions_delete_guard on public.organization_post_reactions;
create policy organization_post_reactions_delete_guard
  on public.organization_post_reactions
  as restrictive
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_reactions.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_reactions_no_update on public.organization_post_reactions;
create policy organization_post_reactions_no_update
  on public.organization_post_reactions
  as restrictive
  for update
  to authenticated
  using (false)
  with check (false);

alter table public.organization_post_views enable row level security;
drop policy if exists organization_post_views_same_org on public.organization_post_views;
create policy organization_post_views_same_org
  on public.organization_post_views
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_views.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_views_insert_self on public.organization_post_views;
create policy organization_post_views_insert_self
  on public.organization_post_views
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_views.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_views_guard on public.organization_post_views;
create policy organization_post_views_guard
  on public.organization_post_views
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_views.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.organization_posts p
      join public.users u on u.organization_id = p.organization_id
      where p.id = organization_post_views.post_id
        and u.id = (select auth.uid())
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_views_update_guard on public.organization_post_views;
create policy organization_post_views_update_guard
  on public.organization_post_views
  as restrictive
  for update
  to authenticated
  using (false)
  with check (false);
drop policy if exists organization_post_views_no_delete on public.organization_post_views;
create policy organization_post_views_no_delete
  on public.organization_post_views
  as restrictive
  for delete
  to authenticated
  using (false);

drop policy if exists organization_post_covers_read_same_org on storage.objects;
create policy organization_post_covers_read_same_org
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'organization-post-covers'
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id::text = (storage.foldername(name))[1]
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_covers_read_guard on storage.objects;
create policy organization_post_covers_read_guard
  on storage.objects
  as restrictive
  for select
  to authenticated
  using (
    bucket_id <> 'organization-post-covers'
    or exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id::text = (storage.foldername(name))[1]
        and u.approval_status = 'approved'
    )
  );

drop policy if exists organization_post_covers_admin_upload on storage.objects;
create policy organization_post_covers_admin_upload
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'organization-post-covers'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id::text = (storage.foldername(name))[1]
        and u.app_role = 'center_admin'
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_covers_upload_guard on storage.objects;
create policy organization_post_covers_upload_guard
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id <> 'organization-post-covers'
    or (
      (storage.foldername(name))[2] = (select auth.uid())::text
      and exists (
        select 1
        from public.users u
        where u.id = (select auth.uid())
          and u.organization_id::text = (storage.foldername(name))[1]
          and u.app_role = 'center_admin'
          and u.approval_status = 'approved'
      )
    )
  );

drop policy if exists organization_post_covers_admin_delete on storage.objects;
create policy organization_post_covers_admin_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'organization-post-covers'
    and exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id::text = (storage.foldername(name))[1]
        and u.app_role = 'center_admin'
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_covers_delete_guard on storage.objects;
create policy organization_post_covers_delete_guard
  on storage.objects
  as restrictive
  for delete
  to authenticated
  using (
    bucket_id <> 'organization-post-covers'
    or exists (
      select 1
      from public.users u
      where u.id = (select auth.uid())
        and u.organization_id::text = (storage.foldername(name))[1]
        and u.app_role = 'center_admin'
        and u.approval_status = 'approved'
    )
  );
drop policy if exists organization_post_covers_no_update on storage.objects;
create policy organization_post_covers_no_update
  on storage.objects
  as restrictive
  for update
  to authenticated
  using (bucket_id <> 'organization-post-covers')
  with check (bucket_id <> 'organization-post-covers');

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

do $$
begin
  if to_regclass('public.activities') is not null then
    alter table public.activities
      add column if not exists screenings_done integer not null default 0,
      add column if not exists health_talks_given integer not null default 0,
      add column if not exists cover_image_path text;
    if to_regclass('public.activity_participants') is not null then
      alter table public.activity_participants
        add column if not exists created_at timestamptz not null default now();
    end if;

    execute $migrate$
      insert into public.events (
        id, organization_id, name, date, location, description, event_type, status,
        cover_image_path, people_reached, pregnancies_identified,
        contraceptives_distributed, health_screenings, health_talks_held,
        notes, created_at
      )
      select
        a.id,
        a.organization_id,
        'Historical ' || replace(coalesce(a.activity_type, 'activity'), '_', ' '),
        a.date,
        a.location,
        a.description,
        case when a.activity_type = 'health_talk' then 'health_talk' else 'other' end,
        'scheduled',
        a.cover_image_path,
        coalesce(a.people_reached, 0),
        coalesce(a.pregnancies_identified, 0),
        coalesce(a.contraceptives_distributed, 0),
        coalesce(a.screenings_done, 0),
        coalesce(a.health_talks_given, 0),
        a.description,
        coalesce(a.created_at, now())
      from public.activities a
      where not exists (select 1 from public.events e where e.id = a.id)
      on conflict (id) do nothing
    $migrate$;

    if to_regclass('public.activity_participants') is not null then
      execute $migrate$
        insert into public.event_invitations (event_id, member_id, status, created_at)
        select a.id, ap.member_id, 'attended', coalesce(ap.created_at, now())
        from public.activity_participants ap
        join public.activities a on a.id = ap.activity_id
        where not exists (
          select 1 from public.event_invitations ei
          where ei.event_id = a.id and ei.member_id = ap.member_id
        )
      $migrate$;
    end if;
  end if;

  execute 'drop function if exists public.current_user_can_view_activity(uuid) cascade';
  execute 'drop function if exists public.current_user_is_admin_for_activity(uuid) cascade';
  if to_regclass('public.activity_participants') is not null then
    execute 'drop table public.activity_participants';
  end if;
  if to_regclass('public.activities') is not null then
    execute 'drop table public.activities';
  end if;
end;
$$;

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
grant select, insert, update, delete on public.event_invitations to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
grant select, insert, update, delete on public.meeting_facilitators to authenticated;
grant select, insert, update, delete on public.meeting_attendance to authenticated;

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
