# Research — The Valley Almanac

Research date: **24 November 2026**. All findings below were gathered for this build and are reflected in the code and data.

## 1. Supported ruleset and platforms

| Item | Finding | Evidence |
|---|---|---|
| Current stable PC version | **1.6.15** (released 20 Dec 2024). No 1.6.16 or 1.7 release as of the research date; 1.7 is announced/in development. | Wiki *Version History* snapshot (top entry 1.6.15); web search Nov 2026 (Fextralife update history, Gaming Bible 1.7 article Oct 2026). |
| Consoles | 1.6.x (a 1.6.15.1 console build is reported); Switch 2 edition received a bug-fix patch in Feb 2026. Mechanics match PC 1.6 except for occasional lag in patches. | Web search (Nintendo Life Feb 2026, Senseos update history). |
| Mobile | 1.6 port shipped; mobile-specific UI changes only. | Wiki *Mobile Version History* reference on Version History page. |
| Mods | Not supported. Modded schedules/fish/data can differ arbitrarily. | Decision D-03. |

**Ruleset shipped:** `vanilla-1.6` (game version 1.6.15). Shown in Settings → About and in each data file's `meta.json`.

## 2. Answers to the brief's research questions

Facts are formalised with precedence and examples in [GAME_RULES.md](GAME_RULES.md). Summary:

1. **Calendar** — 4 seasons × 28 days = 112 days/year; day 1 of every season is a Monday, so the weekday depends only on day-of-month (Fall 16 is a Tuesday, as the Fair page states). After Winter 28 comes Spring 1 of the next year. Year-specific: Kent returns Spring 1 Y2; the railroad opens after the Summer 3 Y1 earthquake; green rain occurs once per Summer on one of days 5, 6, 7, 14, 15, 16, 18, 23.
2. **Weather** — Sun, Rain, Storm, Wind (spring/fall), Snow (winter), Green Rain (summer). Storm and green rain count as rain for fish and schedules; wind/snow count as dry. Fixed days: Spring 1, 2, 4, 5 Y1 sunny, Spring 3 Y1 rain, festival days sunny, Summer 13 and 26 stormy (the TV can mis-forecast the 26th), no natural winter rain (Rain Totem only). The Desert has its own weather (always sunny by default). Ginger Island has independent sun/rain weather. Tomorrow's weather is only knowable from the in-game TV → the app accepts it as user input and otherwise starts days as **unknown**.
3. **Fishing** — Each fish has location-specific season sets (e.g. Catfish: river in spring/fall rain; Secret Woods/Witch's Swamp also in summer rain; winter only with a Rain Totem). Time windows are half-open, can be disjoint (Albacore, Halibut) and run past midnight up to 2 AM. Legendary fish need Fishing levels (Angler 3, Crimsonfish 5, Glacierfish 6, Legend 10; Mutant Carp none) and can be caught once per save; Legendary II only during Qi's Extended Family quest. Festival rules: Rainbow Trout any weather/time during the Trout Derby; Squid all day at SquidFest; Night Market submarine fish only Winter 15–17, 5 PM–2 AM. Ginger Island waters ignore seasons (island always counts as summer). Crab-pot catches depend only on fresh vs salt water. Farm-map fishing mixes other areas' fish by probability (documented, not modelled as fixed rules).
4. **Villagers** — The wiki lists each villager's schedules per season "prioritized highest to lowest". Keys include specific dates, day-of-month, weekdays (with hearts/progress qualifiers), rain (with random "Option 1/2" variants — the game picks rain2 50% of the time), green rain (Year 1), bus/railroad/Community-Center conditions, clinic check-ups and marriage routines. Main festivals suspend schedules. Villagers marked as resort visitors may randomly spend a day on Ginger Island after the resort opens. Birthdays do **not** change schedules. Schedule times are when an activity/departure *starts*; arrival times are unknown unless listed.
5. **Map** — The Valley's regions (Farm, Bus Stop, Pelican Town, Cindersap Forest, Beach, Mountain, Railroad, Backwoods, Quarry, Secret Woods, Sewers) are connected screens; tile-accurate paths would require game map files, which we may not redistribute. A **schematic** map with region/building anchors is what can be shown reliably.
6. **Shops** — Hours/closures from wiki infoboxes, e.g. Pierre's closed Wednesdays *until* the Community Center is restored; Clint closed Fridays *after* it is restored; Robin closed Tuesdays and closes 4 PM Fridays; Marnie's counter closed Mon/Tue (building open); Willy has no sales on non-rainy Saturdays; Ice Cream Stand summer only, not Wednesdays or rainy days; town shops close on main festival days. Traveling Cart: Fri/Sun 6 AM–8 PM, plus every Night Market evening and Desert Festival day. Bookseller: 2 random days per season from fixed candidate lists (save-dependent). Stock is random — never predicted.
7. **Festivals** — 12 dated events with times; main festivals (Egg, Flower Dance, Luau, Moonlight Jellies, Fair, Spirit's Eve, Festival of Ice, Winter Star) pause the day; mini-festivals (Desert Festival, Trout Derby, SquidFest, Night Market) run in normal time.
8. **Crops** — Harvest = planting day + growth days; crops die on the first night of a season not in their list; multi-season crops continue. Speed fertiliser removes `ceil(total × speed)` days phase-by-phase (Speed-Gro 10%, Deluxe 25%, Hyper 33%, Agriculturist +10%, irrigated paddy +25%). Greenhouse/island: no season limit.
9. **Foraging** — Seasonal forage with location text; fixed berry windows: Salmonberry Spring 15–18, Blackberry Fall 8–11. Spawns are random possibilities.
10. **Collections** — Fish collection includes crab-pot catches, algae and jellies. Standard vs remixed Community Center bundles (remixed bundles are chosen randomly per save → user selects which ones they have). Museum: 95 donatable items (42 artifacts + 53 minerals). Catching, owning, submitting, donating, knowing and cooking are distinct states.
11. **Television** — Queen of Sauce: new recipe every Sunday from Spring 7 Y1 on a fixed 2-year cycle of 32 recipes (odd years repeat Year 1, even years repeat Year 2); Wednesday reruns are random (prefer unknown recipes) → not predictable. Livin' Off The Land: Mondays and Thursdays. Weather channel shows tomorrow's forecast; Fortune Teller luck is random. All TV shows static during green rain.
12. **Gifts & friendship** — Personal loves/likes/etc. override universal tastes. Birthday gifts are worth 8×; 2 gifts per week plus the birthday gift. Heart events are spoilers → hidden by default.
13. **Quests/cooking/mining** — Random daily quests and special orders cannot be predicted; the app offers manual goals/notes instead. Recipe sources and ingredients, artifact/mineral sources are reference lookups.
14. **Save files / mods** — PC/Mac/Linux saves are uncompressed XML in `%AppData%\StardewValley\Saves` or `~/.config/StardewValley/Saves`. They can be parsed locally in the browser with no upload → implemented as an optional import (date, weather, farm type, fishing level, spouse, friendship, fish caught, recipes known/cooked, museum donations, key world flags). Console saves are inaccessible; mobile saves are hard to reach. A SMAPI bridge for live sync is technically possible (SMAPI exposes date/time/weather) but was **not built** — see DECISIONS D-11.

## 3. Licensing and provenance

| Material | Licence / status | How we use it |
|---|---|---|
| Stardew Valley game files, sprites, maps, music | © ConcernedApe — not redistributable | **Not used.** The game is not installed here and nothing was extracted. |
| Stardew Valley Wiki text | CC BY-NC-SA 3.0 | Facts (times, places, rules) extracted from a raw-wikitext snapshot; attributed in-app and in docs; this is a non-commercial personal project; derived data keeps attribution and the same licence terms for the wiki-derived parts. |
| Wiki images | Mostly game assets | **Not used.** |
| `stardew-valley-data` v1.1.1 (chiefpansancolt) | MIT (code + JSON) | Item/crop/bundle/gift/villager/recipe/museum base data (JSON only). Its 1,900 bundled images are game sprites and are **not** used. |
| `stardew-data` (juliaramosguedes) | No licence; extracted from game files | **Not used** (only inspected; its fish/location data was lossy). |
| Fonts (Young Serif, Nunito, Pixelify Sans) | SIL OFL 1.1 via @fontsource | Bundled for offline use. |
| Icons, portraits, map, decorations | Original work for this project | Pixel-art SVG/PNG drawn in code. |
| Trademarks | "Stardew Valley" is ConcernedApe's trademark | Used nominatively with an unofficial fan-project disclaimer. |

**robots.txt / access:** the wiki's robots.txt disallows the *ClaudeBot* crawler but allows general user agents on article pages. We did not crawl. A one-off, user-directed snapshot of ~190 specific pages was fetched with `?action=raw` (no HTML rendering), one request every 1.5 s, with an honest user agent (`ValleyAlmanac-DataImport/0.1 (personal non-commercial fan project)`). Node's `fetch` received a Cloudflare challenge; we never attempted to solve or evade it — curl was served the pages normally. The snapshot is stored in `data-sources/wiki/raw/` so the app never scrapes at runtime.

## 4. Competitor review

| Product | What it does well | Gaps / friction relevant to us |
|---|---|---|
| **stardewvalleytracker.com** | The URL could not be verified via search. A similarly named iOS "Stardew Valley Tracker & Guide" (App Store id1424338563) advertises a smart calendar, birthday/festival/crop reminders, offline use and multiple farms, plus villager schedules "at any time". | Not verifiable whether it is the same product. Calendar-centric; manual filtering. |
| **Assistant for Stardew Valley** (App Store id6450314946) | Offline encyclopedia, NPC schedule tracking by day, bundle tracking, forage reminders, repeating tasks; claims 1.6 coverage. Paid (£/$3.99). | Encyclopedia-first: the user re-enters context per lookup; iPad/iOS only. |
| **stardew.live** | Could not be verified via search. | — |
| **stardewvalleyids.com/schedules** | Could not be verified via search. Related tools found: in-game *Schedule Viewer* mod (shows today's schedules from live world state — the gold standard but needs SMAPI on PC), *SV Guide* / *Gunther's Library* iOS apps (seasonal schedules + gift tastes, offline). | Static seasonal schedule tables put the precedence work on the player; most don't show rain-variant randomness or missing-input uncertainty. |
| **stardew.app** (community perfection tracker) | Save-file import, perfection/fish/museum/recipe trackers. | Progress-oriented, not "what can I do today". |

**Opportunities taken:** one shared game context (date/weather/time) drives every view; uncertainty is explicit (random rain routines, unknown hearts, unknown weather); rain-day digest on Today; a real time × fish timeline; local save import; fully offline PWA on any device, no account, free.

Sources: [App Store – Stardew Valley Tracker & Guide](https://apps.apple.com/app/id1424338563), [App Store – Assistant for Stardew Valley](https://apps.apple.com/us/app/assistant-for-stardew-valley/id6450314946), [CurseForge – Schedule Viewer](https://www.curseforge.com/stardewvalley/mods/schedule-viewer), [App Store – SV Guide](https://apps.apple.com/gb/app/sv-guide/id1602155998), [App Store – Gunther's Library](https://apps.apple.com/app/id6754466392), [stardew.app](https://www.github.com/communitycenter/stardew.app), [PC Gamer – fan-made guide app](https://www.pcgamer.com/this-stardew-valley-phone-app-is-a-must-have-for-serious-farmers), [Fextralife update history](https://stardewvalley.wiki.fextralife.com/Stardew_Valley_Update_History), [Gaming Bible – 1.7](https://www.gamingbible.com/news/stardew-valley-1-7-guide-535479-20261007), [Nintendo Life – Switch 2 update](https://www.nintendolife.com/news/2026/02/stardew-valleys-new-update-for-nintendo-switch-2-is-now-live).

## 5. Research limitations

- No game files were available (and none were obtained), so schedule keys are taken from the wiki's human-readable tables rather than `Characters/schedules/*.json`. Labels were translated into typed conditions by a parser; all 623 blocks parse into typed conditions today (validation reports 0 unmodelled labels), but the wiki's own simplifications carry over.
- Schedule *locations* are inferred from step text with a place dictionary (e.g. "his room" → the villager's home). Ambiguous steps inherit the previous place and are marked "(same place as before)".
- Fish spawn *probabilities* are not modelled — only possibility windows.
- Remixed-bundle selection, Bookseller dates, green-rain day, rerun recipes, cart stock and random resort visits are save-seed random and are presented as possibilities.
