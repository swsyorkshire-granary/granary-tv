# Fixing the Sky channel listings

Sky Atlantic, Sky Witness and the other Sky channels don't come from the main listings service (onTVnow).
They come from the public guide data behind Sky's website, read straight from the browser by `site/js/sky.js`.
Sky doesn't officially support this, so it can stop working if Sky changes its website.

## How you'll know
- **⚙ Settings** shows `⚠ Sky listings not loading (…)`, with the reason in brackets.
- The Sky rows keep showing the last listings that loaded, and a note under the grid says so.
- Every other channel carries on as normal.

## What fixes itself
- **Sky renumbers a channel:** channels are looked up by name every day, and again whenever a channel returns nothing.
- **A one-off Sky hiccup:** pressing Refresh later tries again.

## What needs a fix, and where
| What Settings says | Likely cause | Fix |
|---|---|---|
| `Sky channel list 404` / `Sky schedule 404` | Sky moved its web addresses | Edit the two addresses in `site/sky-config.json`, then redeploy |
| `Sky returned no programmes` (every day, every channel) | Sky changed the layout of its data | Update `readSchedule()` in `site/js/sky.js`. It's the only code that reads Sky's format |
| `Sky no longer lists this channel` | The channel was closed or renamed | Remove it in ⚙ → Add or remove channels, then add the new name |
| Requests blocked (CORS / network) in the browser console | Sky stopped allowing websites to read it | Move the reading into a Supabase Edge Function that forwards Sky's data (fetching works there), then point `sky-config.json` at it |

## Checking the data by hand
- Channel list (England, region 1): `https://awk.epgsky.com/hawk/linear/services/4101/1`. Each entry has `sid` (Sky's id), `c` (channel number) and `t` (name).
- One day of one channel: `https://awk.epgsky.com/hawk/linear/schedule/YYYYMMDD/SID`, for example `/schedule/20261117/4053` for Sky Atlantic.
  - The programmes are in `schedule[0].events[]`.
  - Each event has `t` (title), `st` (start, in Unix seconds), `d` (duration, in seconds) and `sy` (synopsis).

## Tests
`node tests/sky.mjs` runs the Sky channels against a pretend Sky. It covers the normal case, Sky being down, and Sky renumbering a channel.

## NOW programme links ("Open in NOW")
- **How it works:** the `find-links` Supabase Edge Function (`supabase/functions/find-links/index.ts`, function `now()`) asks NOW's catalogue search, `https://web.clients.nowtv.com/bff/search/v2`, with `term`, `limit` and `contentSegments=ENTERTAINMENT,…`.
  - It sends NOW's standard `X-SkyOTT-*` request labels.
  - No sign-in is needed.
  - Results carry a `slug`, and the page is `https://www.nowtv.com/watch/asset` + slug.
- **The app** looks the address up when you select a Sky programme, then remembers it for 14 days (2 days when nothing was found).
- **If it stops working:** the button just falls back to "Open NOW" plus copying the title, so nothing breaks.
  - Run the function with `debug: true` to see NOW's reply.
  - The usual fixes are a new required header, or a change to the `contentSegments` values.
- **Opening and adding to My List use NOW's own deep links,** the same ones NOW's website uses for its "open in app" button:
  - Format: `nowtv://www.nowtv.com/deeplink?deeplinkData=` + the URL-encoded JSON `{"providerSeriesId":"<id from the search>","type":"CATALOGUE/SERIES","action":"PDP"}`.
  - On a computer, `https://www.nowtv.com/deeplink?deeplinkData=…` does the same.
  - `action` is one of `PDP` (programme page), `PDP_ADD_WATCHLIST` (add to My List, then show the page), `PLAY` or `PDPAUTOPLAY`.
  - NOW carries out the action itself in your signed-in app or browser, so Granary TV never needs your NOW password.
  - Checked on 17 Nov 2026 in Chrome: `PDP` opened Billions, and `PDP_ADD_WATCHLIST` added it to My List.
  - The Fire Stick launches `com.bskyb.nowtv.beta` with the `nowtv://` link, falling back to the nowtv.com page.
  - Where to find these in NOW's website code: the deeplink bundle, `mobileDevices.gb.deepLinkBaseUrl` in `window.__CONFIGURATION__`.
- **NOW's private watchlist service can't be used directly:** it needs your NOW sign-in plus a signature for every request (`x-sky-signature`). The deep link avoids that.
