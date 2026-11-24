# Implementation plan (as built)

## 1. Screen map

```
Bottom nav (phone) / side rail (≥1024px): Today · People · Fish · Calendar · Journal
Header: back/brand · page sign · Map · Search · Menu(Settings)

/                     Today — day card (date, weather, time, Next day, TV forecast, island weather),
                      summary, quick actions, highlights (+See all today incl. shops), rainy-day
                      fishing, For you (watchlist/collection), Coming up, Seasonal deadlines, customise
/welcome              Onboarding (date, weather, farm name; skippable)
/people               Directory: search, filters (favourites, watched, season birthdays, marriage), sort by
                      next birthday, location summary per card
/people/:id           Profile: Schedule (answer sentence, notes, time scrubber, map, branches, Why?),
                      Gifts (personal + universal, hearts slider, gift log), Info, Heart events (spoiler)
/fish                 List: search, filters (catchable/all/season/rain/not caught/watched/bundle needs/
                      crab pot/legendary), location, sort
/fish/timeline        Gantt-style time × fish chart, cursor, wrong-weather toggle, list equivalent
/fish/locations       Map + spot list + per-spot fish
/fish/:id             Profile: today status & reasons, next/last chance, location × season matrix, time bars,
                      map, bundles, recipes, notes, source
/calendar             Season grid, layers, selected-day panel, preview / make current, reminders
/journal…             Watchlist & goals · Fish caught · Bundles · Museum · Recipes · Notes
/map                  Villagers (all or one, time) · Fishing · Explore (layers), list view
/shops /crops /forage /recipes   Reference tools (status today, planner, berry windows, QoS)
/search               Unified offline search
/settings, /about     Farm, profiles, progress, preferences, save import, backup/restore/reset, credits
```

Cross-links: birthdays → villager; bundle items → fish/crop/forage; map markers → spot/shop/villager; shop entries → map; QoS → recipes; fish → bundles & recipes; Today items → their entity.

## 2. Milestones (all completed)

| Stage | Contents | Status |
|---|---|---|
| A | Research, source/licence strategy, wiki snapshot, data pipeline, schemas, calendar/time/weather/condition engine | ✅ |
| B | Fish/schedule/shop/event resolvers, Today, People, Fish (list/timeline/profile), Calendar, search, day controls | ✅ |
| C | Watchlist, favourites, collections (fish/bundles/museum/recipes), notes, spoilers, backups, opportunities ranking | ✅ |
| D | Schematic map (3 modes), villager scrubber/map, fish by location, crop planner, shops/cart/bookseller, forage, TV, museum | ✅ |
| E | Local save import, responsive polish, accessibility, PWA/offline/update prompt, validation, E2E, docs | ✅ (SMAPI bridge: design only) |

## 3. Acceptance criteria → evidence

| Criterion | Evidence |
|---|---|
| Season/year rollover, weekdays | `engine.test.ts › calendar` |
| Noon/midnight/after-midnight clock | `engine.test.ts › game clock` |
| Weather never silently carried | `store.nextDay`; E2E "daily workflow" asserts *Not sure* after Next day |
| Preview never mutates played day | E2E "calendar preview…" |
| Persistence across reload/offline | E2E "daily workflow" (reload), "works offline"; `persistence.test.ts` (IndexedDB, profile isolation) |
| Rain-only / dry-only / all-weather / special fish; location exceptions; disjoint & after-midnight windows; levels; legendary | `engine.test.ts › fish availability` |
| Unknown weather never definitive | `engine.test.ts` ("unknown weather never yields…"), schedule unknown-weather test |
| Watched fish becomes an opportunity; caught vs bundle distinct | `engine.test.ts › daily opportunities` |
| Multiple rainy routines (Sebastian), hearts branches, railroad, festival override, Kent absent, check-up | `engine.test.ts › villager schedules` |
| Shop closures & precedence, cart, festivals, boundaries | `engine.test.ts › shops` |
| Crop maths (last day, regrowth, fertiliser, multi-season, greenhouse) | `engine.test.ts › crops` |
| QoS cycle, birthdays, festivals, berries, Bookseller possible | `engine.test.ts › calendar events and TV` |
| Backup validation & malicious input | `engine.test.ts › profiles and backups` |
| Save import | `persistence.test.ts › save import` |
| No horizontal scroll at phone/desktop sizes | E2E "no horizontal page scroll" (Pixel 7 + 1280px) + screenshots at 320/390/768/1024/1440 |
| Keyboard access | E2E skip link + Next day via keyboard |
| Data integrity | `npm run data:validate` |

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Wiki tables mislabelled or simplified | Parser reports unmodelled labels (currently 0); "Why this schedule?" exposes the label & condition; source links on every profile. |
| Location inference from prose wrong | Place dictionary + overrides ("follows Sam to his room"); inferred steps flagged; validation lists steps with no place (currently 0). |
| Storage eviction (Safari) | Persistence request, export/import backups, explicit warning in Settings. |
| Game update changes data | Versioned ruleset, reproducible pipeline, update procedure in DATA_SOURCES.md. |
| Service-worker version skew | Prompted updates; profile sanitizer migrates on load. |

## 5. Deliberately out of scope
Shipping/achievement trackers, quest simulation, fish catch probabilities, farm-map fishing mixes, monster/mining guides beyond museum sources, multiplayer, notifications (no reliable background signal exists for a manually-updated game day).

## 6. Optional live sync — technical design (not built)

**Why not built:** requires Stardew Valley + SMAPI installed and a C# toolchain to build/test a mod; none available in this environment. Shipping it untested would violate "no fake integrations".

**Design:**
1. *SMAPI mod* (`ValleyAlmanacBridge`, C#, net6): on `GameLoop.TimeChanged` / `DayStarted` / `SaveLoaded`, snapshot `Game1.year/currentSeason/dayOfMonth/timeOfDay`, `isRaining/isLightning/isSnowing/isDebrisWeather/isGreenRain`, island `LocationContext` weather, `Game1.player.fishingLevel`, `friendshipData`, `fishCaught`, `mailReceived` flags (same mapping as `src/engine/saveImport.ts`).
2. *Transport:* local HTTP server bound to `127.0.0.1:47123` (opt-in in the mod config) serving `GET /state` JSON with a random pairing token; CORS limited to the Almanac's origin. No internet traffic.
3. *PWA:* Settings → "Live sync (PC + SMAPI)" field for the pairing token; polls every 10 s while visible; shows a "Live" badge; merges only date/weather/time automatically and asks before merging progress; falls back silently to manual mode.
4. *Limits:* PC/Mac/Linux only; browsers block mixed content from HTTPS origins to `http://127.0.0.1` unless the PWA is served from localhost or the bridge offers HTTPS — the simplest supported path is running the Almanac locally (`npm run preview`) on the same PC.
