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
