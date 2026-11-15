# GRANARY TV — Technical handover

**Prepared:** 14 November 2026  
**Purpose:** Transfer the project to another developer / Claude Code without losing the working baseline or repeating earlier experiments.

## 1. Current live position — start here

- Site: https://neon-empanada-981548.netlify.app/
- Main guide: https://neon-empanada-981548.netlify.app/
- TV guide: https://neon-empanada-981548.netlify.app/tv.html
- iPad / browser library: https://neon-empanada-981548.netlify.app/library-test.html
- TV library: https://neon-empanada-981548.netlify.app/library-tv-test.html
- Supabase project URL: https://tbnjyytzoyvdymdpimko.supabase.co
- Supabase project ref: `tbnjyytzoyvdymdpimko`

**User's latest confirmation:** The V16.1 site with the Library Navigation Fix has been deployed and the user said “Ok works”. The direct iPad library page also opens. Treat `CURRENT_STABLE_V16.1/` as the known-good source baseline. Do not replace it with V17.

The main guide's My Library navigation was missing in the previous V16.1 package. `CURRENT_STABLE_V16.1/index.html` and `tv.html` are the navigation-fixed files. The user confirmed the deployment works, but no independent browser test or full cross-device regression test has been performed.

## 2. Project purpose

Granary TV is a personal UK television guide and programme library hosted on Netlify, using Supabase for authentication and saved user data. It is used on iPad and televisions (Fire TV / Sony Bravia and LG OLED). The user wants a simple guide, saved programme library, programme metadata/artwork, and reliable programme-specific links to subscribed streaming services.

Streaming services the user has said they subscribes to:
- BBC iPlayer
- ITVX
- Channel 4
- Channel 5
- Amazon Prime Video
- Disney+
- NOW
- Apple TV+

NOW includes Sky-branded channels such as Sky Atlantic, Sky Witness, Sky Comedy, Sky Documentaries and Sky Crime. The guide has had rows for these channels, but the listings source did not provide reliable listings for all of them.

## 3. Files in this handover

### `CURRENT_STABLE_V16.1/`
The complete current known-good website source:
- `index.html` — main guide, with My Library navigation fix
- `tv.html` — TV layout, with My Library navigation fix
- `library-test.html` — iPad/browser library
- `library-tv-test.html` — TV library
- `README_V16.txt` and `README_V16_1.txt` — release notes
- `supabase_programme_metadata_v16.sql` — original V16 metadata table setup SQL (reference only; do not rerun without checking database first)

### `EXPERIMENTAL_V17/`
The separate V17 experiment:
- V17 copies of the guide and library pages
- `link-test-bench.html` — private signed-in Link Test Bench
- `README_V17.txt`
- `supabase_provider_links_v17_SAFE_SETUP.sql` — safe create-if-not-exists setup supplied to user

V17 had a persistent status-save problem in the UI. User selected “Programme page verified”, but the saved-link list continued to display `candidate`. Several patches were attempted; do not assume the status bug is fixed. The user also saw channel/listing regressions after a V17 deployment. Keep V17 experimental and do not deploy it over the stable site until fully audited and tested.

### `REFERENCE/`
ZIP copies of the latest confirmed stable deployment and the latest V17 patch package, for comparison and forensic reference only.

## 4. Supabase structure and state

The user has confirmed these tables were created in Supabase:

### `library_items`
- Existing saved programme library table.
- User authentication and saved library entries were working before V17.
- Existing row-level security policies restrict each user to their own rows.
- Do not drop, recreate, truncate, or rename this table.

### `programme_metadata`
Created using V16 SQL. Fields documented in the original SQL include:
- `id` UUID primary key
- `user_id` referencing `auth.users`
- `normalized_title`, `search_title`
- `source` (TVmaze), `source_id`, `matched_title`, `match_status`
- `image_url`, `summary`, `source_url`, `genres`, `premiered`, `updated_at`
- unique constraint on `(user_id, normalized_title)`
- RLS and own-row policies

The metadata lookup uses TVmaze for show metadata/artwork/summaries/genres. TVmaze does **not** prove UK streaming availability or supply guaranteed direct provider episode links. The site credits TVmaze; its API terms require attribution and CC BY-SA compliance: https://www.tvmaze.com/api

### `programme_provider_links` (V17)
User said they ran the revised “safe” V17 SQL. It creates a separate table with `user_id`, normalized/programme title, service, candidate URL, verification status, checked timestamp and notes, with per-user RLS policies. **This has not been independently inspected in the live Supabase database.** Do not rerun setup SQL blindly. First inspect the actual table and policies in Supabase Dashboard.

Allowed status values in the V17 SQL: `candidate`, `page_verified`, `playback_confirmed`, `broken`, `not_available`.

Important discrepancy: the UI displayed `candidate` after a user had selected “Programme page verified”. The user successfully opened the official Vera ITVX series page (`https://www.itv.com/watch/vera/1a7314`) but the saved record remained displayed as candidate. Do not mark it playback-confirmed. The user did not establish that playback started.

## 5. Current known working behaviour

- Main guide and TV guide had been working in V16.1.
- Main guide navigation now includes My Library; user confirmed the navigation-fix deployment works.
- Direct iPad library URL opens.
- User accounts/password reset are via Supabase Auth. User reset password and could sign into the V17 Test Bench after the sign-in patch.
- Existing saved programmes and metadata are believed to remain in Supabase, but do not claim database contents were independently verified.
- V16.1 library programme metadata uses TVmaze for title matching, artwork and summaries.
- V16.1 provider fallback is a title-specific search scoped to the relevant provider domain, clearly labelled Search rather than Watch. Verified programme-specific URLs should take precedence when available.

## 6. Known faults / unfinished work

1. **V17 status persistence/display:** UI selection “Programme page verified” was saved/displayed as `candidate`. Reproduce in a local/staging copy and inspect both the exact Supabase row and UI state. Determine whether it is a form-state race, status mapping mismatch, wrong field name, stale query result, or insert/upsert issue. Do not guess.
2. **V17 integration and regressions:** V17 deployment appeared to lose channel/listing functionality and library navigation/visibility. Do not use as live baseline.
3. **Channel listings:** Channel 4/5 showed HTTP 429 at one point; NOW/Sky channel rows showed “Not in feed”. Do not fabricate schedules. Investigate feed terms, rate limits and alternative licensed/public sources.
4. **Library navigation:** fixed in current V16.1 source. Preserve it.
5. **Programme discovery:** Future goal is search by title/actor/genre, metadata, broadcast schedule, service availability and add to library.
6. **Episode tracking:** watched/unwatched and series/episode tracking not yet completed.
7. **Device QA:** Need full keyboard/remote navigation and layout testing on Fire TV and LG; iPad also.

## 7. Link verification rules

Keep these concepts distinct:
- **Candidate:** untested URL.
- **Programme page verified:** official programme/series page opened correctly. This does not prove playback.
- **Playback confirmed:** user actually started playback while signed into the service.
- **Broken / Not available:** not a valid destination or no availability found.

Never label a homepage or generic search result as a verified programme page. Use a clearly labelled provider-specific search fallback when no verified direct URL exists. Do not imply that TVmaze confirms streaming availability.

The Vera ITVX URL tested by the user and opened correctly:
`https://www.itv.com/watch/vera/1a7314`
This is a confirmed page-open test only, not playback confirmation.

## 8. Deployment / safety instructions

- Hosting: Netlify site `neon-empanada-981548`.
- Stable baseline: `CURRENT_STABLE_V16.1/`.
- Always retain a Netlify rollback deployment and a local copy of the known-good source.
- Before deployment, compare all four HTML files, test JavaScript syntax, verify ZIP root structure, and run functional smoke tests.
- Deploy the whole four-page site as a coherent package; do not deploy partial page sets.
- Never run `DROP`, `TRUNCATE`, `DELETE` or destructive schema migrations against production without explicit backup and review.
- Do not rerun the V16 or V17 SQL just because the SQL file is in the bundle. Inspect the live schema first.
- Keep the user's existing Supabase Auth accounts and `library_items` data intact.

## 9. Credentials and security

The site code contains the Supabase project URL and a Supabase **publishable/anon key**. These are designed for client-side use when Row Level Security is correctly configured. The project URL and project ref are listed above.

**No Supabase service-role key, database password, user password, or private token is included in this handover.** Never ask the user to paste those into chat or commit them to GitHub. If the receiving developer needs privileged database access, use Supabase's secure dashboard/secret management and the minimum permissions necessary. Check RLS before any change.

The user should connect their own Netlify, GitHub and Supabase accounts to the coding environment. Do not transfer account passwords in a document.

## 10. Instructions to the incoming AI/developer

Start by reading this document and inspecting every file in `CURRENT_STABLE_V16.1/` before editing anything.

1. Treat V16.1 with Library Navigation Fix as the production baseline.
2. Audit the code and database integration; report what you can prove versus what remains unknown.
3. Inspect live Supabase table definitions and RLS policies without modifying them.
4. Reproduce V17's status bug in a local/staging environment and trace the exact database payload and returned row.
5. Compare V17 changes against V16.1 and identify regressions. Port only independently tested features.
6. Build a staging copy and run tests for login, add/remove library items, metadata matching, provider fallback, verified link persistence, and all four pages.
7. Test mobile/iPad and TV remote navigation.
8. Only after the user approves a complete tested release, deploy once. Preserve rollback.

The user prefers concise plain-English instructions, minimal deployments, and does not want repeated approval requests for each small step. Do not ask the user to manually test things that can be checked in code. Only request device/subscription playback checks that cannot be done technically.

## 11. What is not included / limits of this handover

- No live Netlify account export or deployment history export.
- No live Supabase database dump or proof of current row contents/policies.
- No user passwords or service-role credentials.
- No guarantee that external provider links remain available; streaming rights and URLs can change.
- No playback validation through the user's private streaming subscriptions.

This package is intended to give a new developer the complete available code baseline, experimental V17 work, SQL references, environment identifiers, project history, requirements and known issues. The receiving developer must still connect to the user's own accounts and independently inspect live state before making changes.
