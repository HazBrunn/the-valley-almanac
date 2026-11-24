# Data sources, provenance and update procedure

## Source register

| ID | Source | URL | Retrieved | Version coverage | Licence / attribution | Used for | Known gaps / conflicts |
|---|---|---|---|---|---|---|---|
| S1 | Stardew Valley Wiki — raw wikitext snapshot (~190 pages, list in `scripts/fetch-wiki.mjs`, manifest in `data-sources/wiki/manifest.json`) | https://stardewvalleywiki.com/ | 2026-11-24 | 1.6.15 (wiki current) | CC BY-NC-SA 3.0 — "Stardew Valley Wiki contributors" | Villager schedules, fish rules (infobox + intro text), festival times, shop hours/closures, Traveling Cart & Bookseller rules, clinic check-ups, Queen of Sauce air dates, crop stage lengths, weather rules | Wiki tables are human-written; label wording varies. `Willy's_Boat` and `Shops` pages failed to fetch (curl exit 22) and were not needed. |
| S2 | stardew-valley-data v1.1.1 (commit `028b2966`) | https://github.com/chiefpansancolt/stardew-valley-data | 2026-11-24 | 1.6 | MIT © 2026 Christopher Pezza (`data-sources/svd/LICENSE`) | Villager list, birthdays, gift tastes, heart-event summaries, fish base stats (price, difficulty, description, item IDs), crops, forage, bundles (standard + remix), artifacts/minerals, cooking recipes, universal gifts, Bookseller candidate days | Fish location/season data is flattened (not used for rules). Museum minerals include ores/nodes → filtered to `kind === 'mineral'` (95 donatables). Its images are game sprites → **not used**. |
| S3 | Curated rules (`data-sources/curated/*.ts`) | this repo | 2026-11-24 | 1.6.15 | Derived from S1 (+S2); same attribution | Fish conjunction rules, map regions/places (original schematic coordinates), villager homes, festival/shop/berry/TV tables | Hand-curated; each section cites its wiki page. |
| S4 | Official site / release notes | https://www.stardewvalley.net/ | 2026-11-24 | — | © ConcernedApe | Version confirmation (with S1 Version History) | Official site has no machine-readable patch list. |

Cross-checks performed by the build: Bookseller candidate days (S2 vs S1 table — match); Queen of Sauce: exactly 32 Sunday recipes, unique air dates (validated); crop stage lengths sum to S2 growth days (44 of 47 crops; Unmilled Rice, Taro Root and Qi Fruit have no stage table → fertiliser maths flagged as approximate in the UI).

## Pipeline

```
data-sources/
  wiki/raw/*.wiki        ← npm run data:fetch   (one-off polite snapshot; never at runtime)
  svd/*.json             ← copied from stardew-valley-data v1.1.1 (MIT)
  curated/*.ts           ← hand-curated rules with evidence comments
scripts/
  fetch-wiki.mjs         snapshot fetcher (1 req / 1.5 s, honest UA, ?action=raw)
  lib/wikitext.ts        wikitext cleaning, sections, infobox
  lib/schedules.ts       schedule table tokenizer, label → typed Condition, step → place
  build-data.ts          → src/data/generated/*.json + meta.json (checksums) + report.json
  validate-data.ts       schema, unique ids, references, time ranges, conditions, coverage
src/data/generated/      versioned, normalised JSON bundled into the app (and precached)
```

Commands:

```bash
npm run data:fetch      # only when refreshing the wiki snapshot (skips cached pages; --force to refetch)
npm run data:build      # deterministic transform; prints counts and warnings
npm run data:validate   # fails the build on any structural error
```

`report.json` lists every warning (unparsed labels, steps without a place, crops without stage data). `meta.json` records the ruleset, game version, sources and a SHA-256 checksum per dataset.

Safety: imported data is plain JSON; conditions are a closed, typed union evaluated by `src/engine/conditions.ts` — no executable expressions are ever read from data.

## Updating to a new game version (e.g. 1.7)

1. Bump `stardew-valley-data` snapshot: copy the new `data/*.json` into `data-sources/svd/`, update `SOURCE.txt`.
2. `npm run data:fetch -- --force` to refresh the wiki snapshot (respect rate limits; review `manifest.json`).
3. Review the wiki *Version History* for changed fish, schedules, shops and festivals; update `data-sources/curated/*.ts` (each block cites its page).
4. Update `gameVersion` / `ruleset` in `scripts/build-data.ts` and `scripts/validate-data.ts`.
5. `npm run data:build && npm run data:validate && npm test` — fix new warnings, update golden tests that assert changed mechanics.
6. **IDs:** entity IDs are slugs of English names (`fish/catfish`, `villager/sebastian`). If the game renames an entity, add an alias migration in `sanitizeProfile` (src/engine/profile.ts) mapping old → new IDs so saved progress (caught fish, watchlist refs) survives; removed entities are simply ignored by the UI (their saved flags are kept but unused).
7. Bump `PROFILE_SCHEMA_VERSION` only if the saved profile shape changes, and add a migration branch in `sanitizeProfile`.

## Data gaps (honest list)

- Farm-map fishing (Riverland/Forest/etc.) mixes other areas' fish probabilistically — described in research, not modelled as rules.
- Fish spawn chances, bubble spots, bait effects beyond legendary/level/event rules are not modelled.
- NPC schedules on main festival days are simplified to "at the festival during its hours, at home before".
- Spouse routines use the wiki's "Marriage" schedule tables where present; spouse farmhouse positions aren't modelled.
- Remixed bundles: the user ticks which bundles they have; we don't predict the random selection.
- Shipping collection and achievements are not tracked.
- Quests: reference list only (S2 `quests.json` not surfaced in UI) — manual goals/notes cover quest tracking.
