-- Apply after user_auto_create.sql to enable public space discovery.
-- Public event and post visibility is opt-in. Space profiles are public by default
-- because the existing sign-up flow already lists centre names publicly.

alter table public.organizations
  add column if not exists is_public boolean not null default true,
  add column if not exists description text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists province text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists phone_contact text,
  add column if not exists email_contact text,
  add column if not exists opening_hours text,
  add column if not exists interest_tags text[] not null default '{}';

alter table public.events
  add column if not exists is_public boolean not null default false;

alter table public.organization_posts
  add column if not exists is_public boolean not null default false;

drop policy if exists friendly_spaces_signup_list on public.organizations;
create policy friendly_spaces_signup_list
  on public.organizations
  for select
  to anon
  using (is_public);
drop policy if exists organizations_authenticated_profile_read on public.organizations;
create policy organizations_authenticated_profile_read
  on public.organizations
  for select
  to authenticated
  using (
    is_public
    or public.current_user_is_center_admin(id)
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organizations.id
    )
  );
drop policy if exists organizations_public_profile_read_guard on public.organizations;
create policy organizations_public_profile_read_guard
  on public.organizations
  as restrictive
  for select
  to anon
  using (is_public);
drop policy if exists organizations_authenticated_profile_read_guard on public.organizations;
create policy organizations_authenticated_profile_read_guard
  on public.organizations
  as restrictive
  for select
  to authenticated
  using (
    is_public
    or public.current_user_is_center_admin(id)
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organizations.id
    )
  );
revoke select on public.organizations from public, anon, authenticated;
grant select (id, name, is_public, description, address, city, province,
  latitude, longitude, phone_contact, email_contact, opening_hours, interest_tags)
  on public.organizations to anon, authenticated;
grant update (is_public, description, address, city, province, latitude,
  longitude, phone_contact, email_contact, opening_hours, interest_tags)
  on public.organizations to authenticated;
drop policy if exists organizations_admin_update_public_profile on public.organizations;
create policy organizations_admin_update_public_profile
  on public.organizations
  for update
  to authenticated
  using (public.current_user_is_center_admin(id))
  with check (public.current_user_is_center_admin(id));

revoke select on public.organization_posts from public, anon;
grant select (id, organization_id, title, body, is_public, created_at)
  on public.organization_posts to anon;
grant update (is_public) on public.organization_posts to authenticated;
drop policy if exists organization_posts_admin_toggle_public on public.organization_posts;
create policy organization_posts_admin_toggle_public
  on public.organization_posts
  for update
  to authenticated
  using (public.current_user_is_center_admin(organization_id))
  with check (public.current_user_is_center_admin(organization_id));
drop policy if exists organization_posts_public_read on public.organization_posts;
create policy organization_posts_public_read
  on public.organization_posts
  for select
  to anon
  using (
    is_public
    and exists (
      select 1 from public.organizations organization
      where organization.id = organization_posts.organization_id
        and organization.is_public
    )
  );
drop policy if exists organization_posts_public_read_guard on public.organization_posts;
create policy organization_posts_public_read_guard
  on public.organization_posts
  as restrictive
  for select
  to anon
  using (
    is_public and exists (
      select 1 from public.organizations organization
      where organization.id = organization_posts.organization_id
        and organization.is_public
    )
  );
drop policy if exists organization_posts_authenticated_read_guard on public.organization_posts;
create policy organization_posts_authenticated_read_guard
  on public.organization_posts
  as restrictive
  for select
  to authenticated
  using (
    (is_public and exists (
      select 1 from public.organizations organization
      where organization.id = organization_posts.organization_id
        and organization.is_public
    ))
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = organization_posts.organization_id
        and u.approval_status = 'approved'
    )
  );

revoke select on public.events from public, anon;
grant select (id, organization_id, name, date, location, description,
  event_type, status, is_public, created_at)
  on public.events to anon;
drop policy if exists events_public_read on public.events;
create policy events_public_read
  on public.events
  for select
  to anon
  using (
    is_public and status <> 'cancelled'
    and exists (
      select 1 from public.organizations organization
      where organization.id = events.organization_id
        and organization.is_public
    )
  );
drop policy if exists events_read_same_friendly_space_guard on public.events;
create policy events_read_same_friendly_space_guard
  on public.events
  as restrictive
  for select
  to anon
  using (
    is_public and status <> 'cancelled' and exists (
      select 1 from public.organizations organization
      where organization.id = events.organization_id
        and organization.is_public
    )
  );
drop policy if exists events_authenticated_read_guard on public.events;
create policy events_authenticated_read_guard
  on public.events
  as restrictive
  for select
  to authenticated
  using (
    (is_public and status <> 'cancelled' and exists (
      select 1 from public.organizations organization
      where organization.id = events.organization_id
        and organization.is_public
    ))
    or exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.organization_id = events.organization_id
        and u.approval_status = 'approved'
    )
  );
