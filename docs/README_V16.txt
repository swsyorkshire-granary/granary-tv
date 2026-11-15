GRANARY TV V16 — AUTOMATIC PROGRAMME METADATA FOUNDATION

What this release does
- Adds a TVmaze-backed programme metadata lookup to both iPad and TV library pages.
- On opening the library, titles not yet matched are searched automatically.
- Only a unique exact title match is accepted automatically. Ambiguous/non-exact results are marked for review; no guessed match or streaming availability is asserted.
- Stores title match, artwork, synopsis, genres and source URL in a separate Supabase table. Existing library_items and saved entries are not modified.
- Metadata lookup is dynamic: adding a new library programme does not require a Netlify rebuild.

IMPORTANT SETUP — DO THIS BEFORE DEPLOYING
1. In Supabase Dashboard, open SQL Editor.
2. Paste and run the complete contents of supabase_programme_metadata_v16.sql.
3. Confirm the programme_metadata table appears in Table Editor.
4. Upload the ZIP contents to Netlify Drop / deploy as usual.
5. Open My Library while signed in and allow a short time for first-time lookups.

Data source and limitations
- TVmaze public API: https://www.tvmaze.com/api (no API key; CORS enabled).
- TVmaze data is CC BY-SA; the library credits TVmaze.
- TVmaze supplies show metadata, images and episode information, not guaranteed UK streaming availability or direct provider episode links.
- The initial V16 foundation does not yet implement episode watched-state tracking or verified streaming availability. Those are later steps.

Rollback
- Keep the V15.1 ZIP. Redeploy it if necessary.
- The new table is separate; V15.1 ignores it.
