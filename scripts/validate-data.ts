/**
 * Validates the generated datasets: schema shape, unique IDs, cross references, time
 * ranges, condition well-formedness and coverage. Exits non-zero on any error.
 * Run with `npm run data:validate` (after `npm run data:build`).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type * as T from '../src/data/types';
import type { Condition } from '../src/engine/conditions';
import { PROGRESS_FLAGS } from '../src/engine/progress';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = <X>(name: string): X => JSON.parse(readFileSync(join(root, 'src/data/generated', `${name}.json`), 'utf8')) as X;
const errors: string[] = [];
const warnings: string[] = [];
const err = (m: string) => errors.push(m);

const SEASONS = new Set(['spring', 'summer', 'fall', 'winter']);
const FLAGS = new Set<string>(PROGRESS_FLAGS);
const DAY_START = 360;
const DAY_END = 1560;

function unique<X extends { id: string }>(name: string, xs: X[]) {
  const seen = new Set<string>();
  for (const x of xs) {
    if (!x.id || typeof x.id !== 'string') err(`${name}: missing id`);
    if (seen.has(x.id)) err(`${name}: duplicate id ${x.id}`);
    seen.add(x.id);
  }
  return seen;
}

function checkWindow(where: string, w: { start: number; end: number }) {
  if (!(w.start >= DAY_START && w.end <= DAY_END && w.start < w.end)) err(`${where}: bad time window ${w.start}-${w.end}`);
  if (w.start % 10 !== 0 || w.end % 10 !== 0) err(`${where}: window not on the 10-minute clock`);
}

function checkCondition(where: string, c: Condition, villagerIds: Set<string>) {
  switch (c.kind) {
    case 'all':
    case 'any':
      if (!Array.isArray(c.of)) err(`${where}: ${c.kind} without list`);
      c.of.forEach((x) => checkCondition(where, x, villagerIds));
      break;
    case 'not':
      checkCondition(where, c.of, villagerIds);
      break;
    case 'season':
      if (!c.in.every((s) => SEASONS.has(s))) err(`${where}: bad season`);
      break;
    case 'dayOfMonth':
      if (!c.in.every((d) => d >= 1 && d <= 28)) err(`${where}: bad day`);
      break;
    case 'dateRange':
      if (!SEASONS.has(c.season) || c.from < 1 || c.to > 28 || c.from > c.to) err(`${where}: bad date range`);
      break;
    case 'flag':
      if (!FLAGS.has(c.flag)) err(`${where}: unknown flag ${c.flag}`);
      break;
    case 'hearts':
      if (!villagerIds.has(c.npc)) err(`${where}: hearts for unknown villager ${c.npc}`);
      break;
    case 'unknown':
      warnings.push(`${where}: unmodelled condition — ${c.note}`);
      break;
    default:
      break;
  }
}

const meta = load<T.Meta>('meta');
const regions = load<T.Region[]>('regions');
const places = load<T.Place[]>('places');
const villagers = load<T.Villager[]>('villagers');
const schedules = load<T.VillagerSchedule[]>('schedules');
const areas = load<T.FishAreaInfo[]>('fish-areas');
const fish = load<T.Fish[]>('fish');
const festivals = load<T.Festival[]>('festivals');
const checkups = load<T.Checkup[]>('checkups');
const shops = load<T.Shop[]>('shops');
const crops = load<T.Crop[]>('crops');
const forage = load<T.Forage[]>('forage');
const bundles = load<T.Bundle[]>('bundles');
const museum = load<T.MuseumItem[]>('museum');
const recipes = load<T.Recipe[]>('recipes');

if (meta.gameVersion !== '1.6.15') err('meta: unexpected game version');
const regionIds = unique('regions', regions);
const placeIds = unique('places', places);
for (const p of places) if (!regionIds.has(p.region)) err(`place ${p.id}: unknown region ${p.region}`);
const villagerIds = unique('villagers', villagers);
for (const v of villagers) {
  if (!placeIds.has(v.home)) err(`villager ${v.id}: unknown home ${v.home}`);
  if (!SEASONS.has(v.birthday.season) || v.birthday.day < 1 || v.birthday.day > 28) err(`villager ${v.id}: bad birthday`);
}
// Every season/day should have at most... (sanity) birthdays are unique per date in vanilla
const bdays = new Map<string, string>();
for (const v of villagers) {
  const k = `${v.birthday.season}-${v.birthday.day}`;
  if (bdays.has(k)) warnings.push(`birthday collision ${k}: ${bdays.get(k)} & ${v.id}`);
  bdays.set(k, v.id);
}

let blocks = 0;
for (const s of schedules) {
  if (!villagerIds.has(s.villagerId)) err(`schedule for unknown villager ${s.villagerId}`);
  for (const b of [...s.blocks, ...s.marriage]) {
    blocks++;
    checkCondition(`schedule ${b.id} (${b.label})`, b.condition, villagerIds);
    if (!b.steps.length) err(`schedule ${b.id}: no steps`);
    let last = -1;
    for (const st of b.steps) {
      if (st.time < DAY_START - 120 || st.time > DAY_END) err(`schedule ${b.id}: step time ${st.time} out of range`);
      if (st.time < last) err(`schedule ${b.id}: steps not sorted`);
      last = st.time;
      if (st.place !== null && !placeIds.has(st.place)) err(`schedule ${b.id}: unknown place ${st.place}`);
      if (st.place === null) warnings.push(`schedule ${b.id}: step without place “${st.text}”`);
    }
  }
}
for (const v of villagers) if (!v.stationary && !schedules.find((s) => s.villagerId === v.id)?.blocks.length) err(`villager ${v.id}: no schedule blocks`);

const areaIds = unique('fish-areas', areas);
for (const a of areas) if (!regionIds.has(a.region)) err(`fish area ${a.id}: unknown region`);
unique('fish', fish);
const ruleIds = new Set<string>();
for (const f of fish) {
  if (!f.rules.length) err(`fish ${f.id}: no rules`);
  if (!(f.sellPrice >= 0)) err(`fish ${f.id}: bad price`);
  for (const r of f.rules) {
    if (ruleIds.has(r.id)) err(`fish rule duplicate ${r.id}`);
    ruleIds.add(r.id);
    if (!r.areas.length || !r.areas.every((a) => areaIds.has(a))) err(`fish ${f.id}: bad areas`);
    if (!r.seasons.length || !r.seasons.every((s) => SEASONS.has(s))) err(`fish ${f.id}: bad seasons`);
    if (!['rain', 'dry', 'any'].includes(r.weather)) err(`fish ${f.id}: bad weather`);
    if (!r.windows.length) err(`fish ${f.id}: no windows`);
    r.windows.forEach((w) => checkWindow(`fish ${f.id}`, w));
    if (!r.requires.every((x) => FLAGS.has(x))) err(`fish ${f.id}: unknown requirement`);
    if (r.days && (r.days[0] < 1 || r.days[1] > 28)) err(`fish ${f.id}: bad day range`);
  }
}

unique('festivals', festivals);
for (const f of festivals) {
  if (!placeIds.has(f.place)) err(`festival ${f.id}: unknown place`);
  checkWindow(`festival ${f.id}`, { start: f.start, end: f.end });
}
for (const c of checkups) if (!villagerIds.has(c.villagerId)) err(`checkup: unknown villager ${c.villagerId}`);
unique('shops', shops);
for (const s of shops) {
  if (!placeIds.has(s.place)) err(`shop ${s.id}: unknown place ${s.place}`);
  checkWindow(`shop ${s.id}`, { start: s.open, end: s.close });
}
unique('crops', crops);
for (const c of crops) {
  if (!c.seasons.length) warnings.push(`crop ${c.id}: no outdoor season (greenhouse/island only)`);
  if (!(c.growDays > 0)) err(`crop ${c.id}: bad growDays`);
  if (c.phases && c.phases.reduce((a, b) => a + b, 0) !== c.growDays) err(`crop ${c.id}: phases do not sum to growDays`);
}
unique('forage', forage);
unique('bundles', bundles);
for (const b of bundles) {
  if (b.type === 'items' && b.itemsRequired > b.items.length) err(`bundle ${b.id}: requires more items than listed`);
  for (const i of b.items) if (i.ref && !['fish', 'crop', 'forage'].includes(i.ref.kind)) err(`bundle ${b.id}: bad ref`);
}
unique('museum', museum);
if (museum.length !== 95) err(`museum: expected 95 donatable items, found ${museum.length}`);
unique('recipes', recipes);
const tv = recipes.filter((r) => r.tv);
if (tv.length !== 32) err(`recipes: expected 32 Queen of Sauce recipes, found ${tv.length}`);
const tvSlots = new Set(tv.map((r) => `${r.tv!.cycleYear}-${r.tv!.season}-${r.tv!.day}`));
if (tvSlots.size !== 32) err('recipes: Queen of Sauce air dates are not unique');
for (const r of tv) if (r.tv!.day % 7 !== 0) err(`recipe ${r.id}: TV air date is not a Sunday`);

// Coverage summary
const summary = {
  villagers: villagers.length,
  scheduleBlocks: blocks,
  fish: fish.length,
  fishRules: ruleIds.size,
  festivals: festivals.length,
  shops: shops.length,
  crops: crops.length,
  forage: forage.length,
  bundles: bundles.length,
  museum: museum.length,
  recipes: recipes.length,
};
console.log('Coverage:', JSON.stringify(summary));
console.log(`${warnings.length} warnings`);
for (const w of warnings.slice(0, 20)) console.log(`  ⚠ ${w}`);
if (warnings.length > 20) console.log(`  … ${warnings.length - 20} more`);
if (errors.length) {
  console.error(`${errors.length} ERRORS`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('✓ Data valid');
