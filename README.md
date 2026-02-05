# Delta Hub (static web app + Supabase)

This is a static web app meant to be hosted on GitHub Pages. It uses Supabase for auth, database, storage, and realtime chat.

## Setup

1) Create a Supabase project.
2) In Supabase SQL editor, run `supabase.sql` from this repo to create tables and RLS policies.
3) Create two storage buckets (both private):
   - `media_public`
   - `media_private`
4) Create users in Supabase Auth (invite-only). Assign roles in `profiles`.
5) Update `app.js` with your Supabase URL + anon key.

## Deploy to GitHub Pages

- Push `/app` to a GitHub repo.
- Enable GitHub Pages on the `main` branch and `/app` folder.

## Invite-only access

Signups are disabled in the UI. Admin creates users in Supabase Auth and shares credentials or password reset link.

## Files

- `app/index.html`
- `app/styles.css`
- `app/app.js`
- `supabase.sql`
