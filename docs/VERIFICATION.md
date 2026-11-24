# Verification report — 24 November 2026

Environment: Linux, Node 22.23.3, npm 10.9.9, system Google Chrome (Playwright channel `chrome`).

## Checks run (all passing at commit time)

| Check | Command | Result |
|---|---|---|
| Data build | `npm run data:build` | 34 villagers, 580 season schedule blocks (+43 marriage), 77 fish/catchables (96 rules), 35 check-ups, 47 crops, 49 forage, 61 bundles, 95 museum items, 81 recipes (32 Queen of Sauce). 3 warnings: no stage table for Unmilled Rice, Taro Root, Qi Fruit (UI flags fertiliser maths as approximate). |
| Data validation | `npm run data:validate` | ✓ 0 errors, 0 warnings (0 unmodelled schedule labels, 0 schedule steps without a place). |
| Typecheck | `npm run typecheck` | ✓ |
| Lint | `npm run lint` | ✓ 0 problems |
| Unit/integration | `npm test` | ✓ 42 tests in 2 files (calendar, clock, conditions, weather, fish, schedules, shops, crops, events/TV, search, backups, opportunities, save import, IndexedDB persistence & profile isolation, schedule-label parser) |
| E2E (Pixel 7 + 1280 px desktop) | `npm run test:e2e` | ✓ 14 passed (7 scenarios × 2 projects): daily workflow incl. reload persistence and no weather carry-over; calendar preview isolation; fish timeline; no horizontal overflow on 12 screens; offline after first visit (service worker); keyboard skip link & Next day; local save import & merge. 10 opt-in screenshot runs skipped. |
| Production build | `npm run build` | ✓ ~250 KB gzipped JS+CSS (≈115 KB of it is the bundled offline game dataset); PWA precache 34 entries ≈1.2 MB. |
| Manual browser review | in-app browser, desktop + dark mode; Playwright screenshots at 320/390/768/1024/1440 px | Fixed during review: 320 px header/day-card overflow, map marker legibility on phones, off-map labels clipped, debounced saves lost on fast reload (now immediate), noisy calendar grid, ambiguous duplicate "Next day" control names, answer-sentence grammar, "next possible" shown for already-available fish, Joja development bundles missing cost/room. No console errors across 30 routes. |

## Golden facts verified against the wiki snapshot
Weekday mapping (Fair = Tuesday 16th); Spring 3 Y1 rain; Summer 13/26 storms; Catfish location-specific seasons; Eel 4 PM–2 AM rain; Shad 9 AM–2 AM rain; Albacore disjoint windows; Legend level 10 spring rain; Rainbow Trout Derby exception; Night Market submarine fish; Sebastian's two rainy routines, Friday pool, Thursday railroad (after Summer 3 Y1), Spring 11 heart branches, Summer 4 check-up; Pierre/Willy/Saloon/Cart hours; Parsnip/Strawberry/Corn crop maths; Queen of Sauce 2-year Sunday cycle (Stir Fry / Pizza); birthdays (Abigail Fall 13, Sebastian Winter 10, Vincent Spring 10); berry windows; Bookseller candidate days.

## Coverage gaps & unresolved uncertainties
- UI components have no unit tests; they're covered by E2E flows and manual review.
- Screen-reader testing was done via accessibility-tree inspection and keyboard E2E, not with VoiceOver/NVDA. Colour contrast follows a WCAG AA-oriented palette but wasn't measured for every token.
- Safari/iOS install and storage eviction were not tested (no Apple device here). The PWA uses standard manifest + service worker.
- Save import is tested with a **synthetic** fixture that follows the documented 1.6 format, not a real save. Real saves may hold edge cases (e.g. multiplayer farmhands — only the host `player` is read).
- Villager location inference comes from wiki prose; individual steps may name a nearby place rather than the exact spot. Festival-day positions are simplified.
- "First day of each season is sunny" is inferred (see GAME_RULES §3); users can override the weather.
- Live SMAPI sync: not built (no game/SMAPI/C# toolchain here). Design in IMPLEMENTATION_PLAN §6.
- Not deployed anywhere; run locally with `npm run dev` or `npm run build && npm run preview`.
