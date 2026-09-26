# Youth-Friendly-Space-Mgt-System

## Centre registration and member accounts

Before using registration, run [`supabase/user_auto_create.sql`](./supabase/user_auto_create.sql) in the Supabase SQL Editor. The script adds the account/profile fields, creates the centre-news and event-feedback tables, adds reporting metrics, replaces the old first-organisation signup trigger, and applies role- and organisation-scoped row-level security. It expects the existing `organizations`, `users`, `events`, `members`, `activities`, `activity_participants`, and `event_invitations` tables.

During signup:

- **Friendly space** registers a new centre and makes the first account its centre admin.
- **Personal** submits a request to join a registered centre. A coordinator must approve the request before the member account is activated and linked to a member record.
- Coordinators can manage members, events, activities, join requests, centre news, attendance, and feedback. Members can manage their own profile, respond to their invitations, share feedback after attended events, and view their own participation.
- Existing personal accounts are linked to member records by matching their email and centre when the setup script runs.

Existing centre rows without a name are assigned a temporary `Friendly Space <ID>` name by the setup script. Replace those placeholders with the real centre names in the Supabase `organizations` table.

Email and SMS invitation/reminder delivery is not configured in this phase.