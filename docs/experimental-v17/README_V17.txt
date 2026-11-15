GRANARY TV V17 – LINK TEST BENCH + VERIFIED LINK INTEGRATION

V17 keeps the V16.1 guide, library, metadata matching and existing Supabase data. It adds a private signed-in Link Test Bench and connects verified provider links back into both My Library pages.

SETUP: The safe V17 SQL setup has already been run separately. Do not run the SQL file in this ZIP again unless specifically instructed. It creates a separate table with row-level security and does not alter library_items or programme_metadata.

SIGN-IN FIX: The original Test Bench accidentally used the name URL for the Supabase project URL, masking the browser URL constructor. The corrected page uses SUPABASE_URL and window.URL, waits for Supabase initialization, catches sign-in/network errors, and displays clear status messages. It uses the same existing Granary TV account.

HOW TO USE: Deploy the corrected ZIP. Open My Library > Link Test Bench. Sign in with the existing Granary TV password. Select a saved programme and service, paste a candidate programme/episode URL, open it to test, then record Candidate, Programme page verified, Playback confirmed, Broken/wrong destination, or Not available. Save.

INTEGRATION: My Library reads programme_provider_links from Supabase. A saved link is used on programme cards only when its status is Programme page verified or Playback confirmed. Candidate, broken and not-available records are never presented as trusted watch links; the card falls back to the targeted service search. Link corrections and verification updates therefore do not require a website deployment.

IMPORTANT: Opening a page is not proof that an episode plays. Mark Playback confirmed only after playback actually starts on the user's device. A service may require sign-in, subscription, or regional rights. V16.1 remains the backup.
