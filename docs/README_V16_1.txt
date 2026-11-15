GRANARY TV V16.1 – PROGRAMME-SPECIFIC PROVIDER SEARCH LINKS

This update builds on V16 and preserves the existing Supabase programme metadata table and library data.

Change: when a programme has a verified programme-specific URL, the library uses it. Otherwise, the primary button and Other services links now open a title-specific web search restricted to the relevant provider domain, rather than the provider homepage. Labels clearly say Search, and do not imply that availability is confirmed.

No SQL changes are required. Do not rerun the V16 SQL. No individual programme hard-coding is needed for this fallback.

TVmaze remains the metadata source. Its public API supports show search and requires attribution under CC BY-SA: https://www.tvmaze.com/api

Deploy the complete ZIP as a whole. Keep V15.1 and V16 backups. Test Vera: its primary button should say Search ITVX for Vera and open results scoped to itv.com/watch, not the ITVX homepage.
