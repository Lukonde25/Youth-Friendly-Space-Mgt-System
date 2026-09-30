# Youth-Friendly-Space-Mgt-System

## GitHub Pages deployment

This repository builds to Vite's `dist` directory and is configured for the project URL
`https://lukonde25.github.io/Youth-Friendly-Space-Mgt-System/`. GitHub Pages must deploy
the `dist` artifact through GitHub Actions; serving the repository root directly will expose
the development `src/main.jsx` entry and result in a 404.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.
Add the repository Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` so the
workflow can configure the Supabase client in the production build. Every push to `main`
will then build and deploy the app.

## Centre registration and member accounts

Before using registration, run [`supabase/user_auto_create.sql`](./supabase/user_auto_create.sql) in the Supabase SQL Editor. The script adds the account/profile fields, creates the Meetings, centre-news, event-feedback, and notification tables, configures private cover storage, adds event outcome metrics, replaces the first-organisation signup trigger, and applies role- and organisation-scoped row-level security. It expects the existing `organizations`, `users`, `events`, `members`, and `event_invitations` tables. If the legacy `activities` and `activity_participants` tables exist, the script migrates their outcomes and attendance to Events before dropping those tables.

During signup:

- **Friendly space** registers a new centre and makes the first account its centre admin.
- **Personal** submits a request to join a registered centre. The centre admins receive an in-app notification, and must approve the request before the member account is activated and linked to a member record.
- Centre admins can publish posts and Events using an image-cover preview and click-to-expand details. Events include post-event service metrics and documentation, and outcomes can be shared to Centre News.
- Centre admins can schedule facilitator-led Meetings, manage facilitator assignments and member attendance, document meeting notes and photos, and publish meeting summaries. Members can view their attended Meetings read-only.
- Posts support a Love reaction and a view count. A user's Love is toggleable, and views count each approved member once per post.
- Coordinators can manage members, Events, Meetings, join requests, centre news, event attendance, and feedback. Members can manage their own profile, respond to event invitations, share feedback after attended events, and view attended Meetings.
- Existing personal accounts are linked to member records by matching their email and centre when the setup script runs.

Existing centre rows without a name are assigned a temporary `Friendly Space <ID>` name by the setup script. Replace those placeholders with the real centre names in the Supabase `organizations` table.

Email and SMS notification delivery is not configured in this phase. Admin notifications are in-app and update live while the app is open.

## Public space discovery

After the existing setup script has been applied, run
[`supabase/public_discovery.sql`](./supabase/public_discovery.sql) in the Supabase SQL
Editor. Signed-out visitors can browse public space profiles, search by location or
interest, and sort spaces with published coordinates by distance. Centre admins manage
these details from **Public Profile** and can mark individual news posts and events as
public. Posts and events remain private by default, and public event queries omit
private outcome metrics.

The address lookup uses OpenStreetMap's Nominatim only after an admin presses **Find
address on map**; results are cached in that browser. The public Nominatim service is
intended for moderate, user-triggered traffic and allows at most one request per second
across the whole application. For higher usage, configure a compatible provider at
runtime with `window.YOUTH_HEALTH_GEOCODER_URL`. Keep the OpenStreetMap attribution and
do not send personal or confidential information to the geocoder.
