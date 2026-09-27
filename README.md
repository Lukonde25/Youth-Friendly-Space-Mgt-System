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

Before using registration, run [`supabase/user_auto_create.sql`](./supabase/user_auto_create.sql) in the Supabase SQL Editor. The script adds the account/profile fields, creates the centre-news, event-feedback, and admin notifications tables, configures private centre-post cover storage, adds reporting metrics, replaces the old first-organisation signup trigger, and applies role- and organisation-scoped row-level security. It expects the existing `organizations`, `users`, `events`, `members`, `activities`, `activity_participants`, and `event_invitations` tables.

During signup:

- **Friendly space** registers a new centre and makes the first account its centre admin.
- **Personal** submits a request to join a registered centre. The centre admins receive an in-app notification, and must approve the request before the member account is activated and linked to a member record.
- Centre admins can publish posts, events, and activities using an image-cover preview and click-to-expand details. Cover images are resized and compressed in the browser to a maximum of 2 MB and saved in a private Storage bucket accessible only to approved members of the same centre.
- Posts support a Love reaction and a view count. A user's Love is toggleable, and views count each approved member once per post.
- Coordinators can manage members, events, activities, join requests, centre news, attendance, and feedback. Members can manage their own profile, respond to their invitations, share feedback after attended events, and view their own participation.
- Existing personal accounts are linked to member records by matching their email and centre when the setup script runs.

Existing centre rows without a name are assigned a temporary `Friendly Space <ID>` name by the setup script. Replace those placeholders with the real centre names in the Supabase `organizations` table.

Email and SMS notification delivery is not configured in this phase. Admin notifications are in-app and update live while the app is open.