# Game rules as implemented (vanilla 1.6.15)

Every rule cites its code and is exercised by tests in `src/engine/*.test.ts` (golden fixtures) unless noted.

## §1 Calendar — `src/engine/calendar.ts`
- `GameDate = { year ≥ 1, season, day 1–28 }`; absolute index `(year−1)·112 + seasonIdx·28 + day−1`.
- Weekday = `WEEKDAYS[(day−1) % 7]`; day 1 is Monday in every season. *Example:* Spring 5 → Friday; Fall 16 → Tuesday (Fair).
- `addDays` handles season and year rollover (Winter 28 Y1 + 1 = Spring 1 Y2). Real-world dates are never consulted.

## §2 Clock — `src/engine/time.ts`
- Times are **minutes since 0:00 of the game day**; the day runs 6:00 AM (360) to 2:00 AM (1560). 12:00 AM = 1440, 1:30 AM = 1530 — after-midnight times stay on the same game day.
- Clock strings 12:00 AM–5:59 AM parse as after midnight (24:00–29:59).
- Step: 10 minutes.
- **Interval semantics:** half-open `[start, end)`, matching the game's `timeOfDay >= start && timeOfDay < end`. *Example:* Eel "4pm–2am": 3:50 PM → later, 4:00 PM → now, 1:50 AM → now.

## §3 Weather — `src/engine/weather.ts`
- States: sun, rain, storm, wind, snow, green-rain, **unknown**.
- For fish and schedules only "raining" matters: rain/storm/green-rain = raining; sun/wind/snow = not raining; unknown → `unknown` (three-valued).
- Natural options: spring sun/rain/storm/wind; summer sun/rain/storm/green-rain; fall sun/rain/storm/wind; winter sun/snow (+ rain only via Rain Totem, offered as an option).
- Fixed weather (auto-filled on *Next day*, with the reason shown): festival days sunny; Spring 1, 2, 4, 5 Y1 sunny; Spring 3 Y1 rain; first day of each season sunny (*inferred*: the wiki states a Rain Totem cannot change the 1st of a season, consistent with the game forcing sun; the user can always override); Summer 13 & 26 storm.
- **Next-day default:** new day = fixed weather if any, else the TV forecast the user entered for tomorrow, else **unknown**. Yesterday's weather is never carried over. Time resets to 6:00 AM if a time was set. Island weather resets to unknown.

## §4 Conditions — `src/engine/conditions.ts`
Closed typed union: `all / any / not / season / weekday / dayOfMonth / date / dateRange / year / raining / weather / time / flag / hearts / married / fishingLevel / random / unknown`. Three-valued evaluation (`true | false | 'unknown'`) with human-readable *unmet* and *unknown* reasons. Missing inputs (hearts not entered, flag not set, weather unknown) yield `unknown`, never a default. `random` is always `unknown` (the app never assigns probabilities).
Derived flags: `railroadOpen` = date ≥ Summer 3 Y1; `kentHome` = Year ≥ 2.

## §5 Villager schedules — `src/engine/schedule.ts`
Precedence:
1. **Stationary** villagers (Dwarf, Krobus, Wizard) — fixed place note.
2. **Not present** (e.g. Kent before Year 2) — explained.
3. **Main festival day** — schedules pause; villagers are at the festival place during its hours, home before.
4. **Marriage** — if `spouse === villager`, the wiki "Marriage" blocks are used.
5. **Ordered season list** (wiki order = priority). Walk blocks for the season (+ all-year blocks):
   - condition `false` → skip (kept for the "Why?" panel with reasons);
   - condition `true` → **definite**, stop;
   - condition `unknown` → **possible** branch with the missing inputs listed, continue;
   - a **variant group** ("Rain (Option 1/2)") whose only unknown is randomness → all variants are **random** branches and the walk stops (the group is certain to apply).
6. Notes: clinic check-up today, mini-festival today, possible random resort visit (only when the resort is known to be open), marriage hint.

*Examples (tested):* Sebastian, rainy Spring 5 Y2 → two random branches; at 2 PM either Beach piers or still at home/heading to the Saloon. Sunny Friday → "Friday" block, Saloon from 5:20 PM, travelling 3:00–5:20 PM. Spring 11 with hearts unknown → both hearts-dependent blocks shown as possible. Thursday in Year 1 spring → railroad closed → Regular schedule; Year 2 → Thursday (Railroad) block. Summer 4 → clinic check-up block.

**Locating** (`locateAt`): the last step with `time ≤ t`. A "travel" step means the villager *left* at that time heading to the named place; we show "on the way, left X at T, next listed at T2" and never interpolate a position. Before the first step: "not out yet". Steps whose text names no place inherit the previous place and are flagged.

**Label translation** (`scripts/lib/schedules.ts`): dates ("Spring 11 and 25", "Tuesday the 9th"), weekday lists/ranges ("Monday - Friday"), rain/green rain, festival names, "Bus Service Restored", "Railroad Accessible", Year 1/2+, hearts ("No player has 6 hearts"), Community Center restored/not, Joja, Kent, beach bridge, "Option N" variants, "As Vendor" (random). Anything else → `unknown` with the original text (currently none).

## §6 Fish — `src/engine/fish.ts`, data `data-sources/curated/fish-rules.ts`
- Each rule is one conjunction: areas × seasons × weather × time windows (+ optional day range, minimum Fishing level, required progress flags, island weather). The resolver never combines one rule's area with another rule's season.
- Area access: rules covering locked areas (Secret Woods, Sewers, Desert, Ginger Island…) need the matching flag; unknown → conditional.
- Status: `now` (inside a window), `later` (a window later today), `today` (no time set), `conditional` (day-level unknown and not past), `earlier` (windows passed), `unavailable`. Best status across rules wins.
- Ginger Island rules use the separate island weather.
- *Next availability*: scans forward ≤ 112 days for the first date whose **date** conditions match; weather and unknown requirements are returned as "needs …" (future weather is never assumed).
- *Last chance*: last day in this season where a rule's date conditions hold, only if the fish does not continue into next season.

*Examples (tested):* Catfish spring rain 2 PM → now; summer rain town river → unavailable, Secret Woods (unlocked) → now, Secret Woods (access unknown) → conditional; midnight → earlier (6 AM–12 AM). Albacore 6:10 AM now, noon later, 6 PM now. Legend: level unknown → conditional, 9 → unavailable, 10 → now; next = Spring 1 next year, needs rain. Rainbow Trout any weather on Summer 20–21. Blobfish only Winter 15–17 evenings.

## §7 Shops — `src/engine/shops.ts`
Order: unlock requirement → Traveling Cart special openings (Night Market 5 PM–2 AM; Desert Festival 12 PM–2 AM, needs bus) → season restriction → main festival closure → closed weekdays → exceptions (closed weekday unless/if flag, closed if flag, closed weekday unless rain, closed when raining, early close weekday, closed dates/after time) → owner check-up note → time of day (open / opens later / closed now). Unknown flags or weather → **Depends**. Building hours are reported separately from service.

## §8 Crops — `src/engine/crops.ts`
- Harvest date = plant date + effective growth days; regrowing crops then every `regrowDays`.
- Outdoor deadline: day 28 of the last *consecutive* season in the crop's list starting from the planting season. Protected areas (greenhouse/island): no limit (planner shows one year).
- Speed: fertiliser 10/25/33 %, Agriculturist +10 %, irrigated paddy +25 %. Days removed = `ceil(total × speed)` distributed one per phase per pass (max 3 passes), phase 0 never below 1 day (exact when wiki stage lengths exist; otherwise flagged approximate).
- *Examples (tested):* Parsnip 4 d, last safe Spring 24; Speed-Gro → 3 d; Hyper + Agriculturist → 2 d. Strawberry from Spring 1 → harvests 9, 13, 17, 21, 25. Corn (summer + fall) planted Summer 1 → deadline Fall 28.

## §9 Calendar events — `src/engine/events.ts`
Certain: birthdays, festivals (with times), Traveling Cart days, berry windows, clinic check-ups, Queen of Sauce Sunday recipe (`cycleYear = year odd ? 1 : 2`, from Spring 7 Y1), Livin' Off The Land (Mon/Thu), storm days, earthquake (Summer 3 Y1), Kent's return (Spring 1 Y2), secret-gift letter (Winter 18), last outdoor planting days. **Possible:** Bookseller candidate days, green rain candidate days, Wednesday reruns.

## §10 Daily opportunities — `src/engine/opportunities.ts`
Today = calendar events (minus per-day dismissals) + rain-only fish when raining (caught fish de-emphasised) or a "set the weather" prompt listing rain-only possibilities when unknown + watchlist items resolved through the same engines (fish status, villager birthday/location, crop last-planting, forage window, bundle progress, due dates) + optional "not caught yet" suggestions + next-7-day certain events + seasonal deadlines. Deterministic one-paragraph summary (no LLM).

## §11 Collections — `src/engine/collections.ts`
Distinct states: fish *caught*; bundle item *submitted*; museum item *donated*; recipe *known*, *cooked*. Standard mode uses non-remix bundles; remixed mode uses the bundles the player ticks (all shown until chosen). Bundle needs link to fish/crop/forage entities.
