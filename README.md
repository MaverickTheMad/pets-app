# Pets — Grove · Pet Records

A shared pet-records app for **Mav & Ren**, part of the reilly.live suite.
Profiles, vaccinations, medications, vet visits & receipts, weight tracking,
allergies/conditions, and a reminders home screen that surfaces what's due soon
across every pet.

- **Live:** pets.reilly.live
- **Repo:** github.com/MaverickTheMad/pets-app (branch `main`)
- **Stack:** React 18 + Vite · Supabase (`reilly-home`, schema `pets`) · Vercel · Cloudflare Access
- **Accent:** Honey `#D8A24F` (dark) / `#B07F2E` (light) · Fonts: Fraunces + Plus Jakarta Sans + JetBrains Mono

## How it works

- **Reminders tab (home):** the day opens on what's actually due. Vaccine
  `next_due` dates and medication `refill_due` dates auto-surface — no double
  entry. Grouped Overdue → This week → Next 30 days → Later. Custom reminders
  (flea/tick, heartworm, grooming, nail trim) support an optional repeat
  interval; tapping **Done** rolls them forward and an undo toast catches
  mistaps.
- **Pets tab:** card list of every pet. Each card opens a full profile sheet —
  species/breed/sex/fixed, birthday (with "estimated" flag for rescues),
  adoption, microchip, photo, vet contact, feeding — plus every sub-record:
  vaccinations with quick-add chips per species, medications with dose &
  refill, vet visits with cost, a weight log with an inline Honey sparkline,
  and allergy/condition tags. Pets can be archived (records kept) rather than
  deleted.
- **Documents tab:** vault for vet receipts, invoices, lab results, adoption
  papers, and insurance docs (PDF or photo). Filter by pet or household;
  receipts/invoices roll up to a running Honey total at the top.

Polish-guide hygiene throughout: one house-green primary CTA per screen,
action-named copy ("Save vaccination" not "Submit"), undo toasts on every
high-frequency delete, confirm sheets on archive, equal-width quick-action
rows, teaching empty states with a CTA inside, and full dark mode as the
default.

## Setup

1. **DB:** run `schema.sql` in the `reilly-home` Supabase SQL editor. It
   creates the `pets` schema, all tables, grants, RLS, and the `pet-docs`
   storage bucket. Then add `pets` under **Settings → API → Exposed schemas**.
2. **Env:** copy `.env.example` → `.env` and fill in the `reilly-home` URL +
   **anon public** key (never `service_role`). Set both vars in the Vercel
   project too.
3. **Run:** `npm install` then `npm run dev`.
4. **Deploy:** push to `main` (Vercel auto-deploys), add the `pets.reilly.live`
   CNAME in Cloudflare, then create a Cloudflare Access app on the subdomain
   with the shared Household policy.
5. **Dashboard:** flip the Pets card on `home.reilly.live` from "soon" to
   "live" — the Honey accent and paw tile already match.

## Notes

- Pet photos and uploaded documents both live in the public `pet-docs` bucket
  under `photos/` and `docs/` prefixes — one bucket, two folders, simpler
  policies.
- Local-time date helpers (`parseLocalDate`, `todayStr`) prevent the timezone
  drift that bit Ren's Journal early on.
- Archive (don't delete) for pets that pass or are rehomed — every record
  stays in the DB and can be restored.
