/**
 * Reproducible data build: lawful source snapshots → typed, normalised JSON in
 * src/data/generated/. Run with `npm run data:build`.
 *
 * Inputs (see docs/DATA_SOURCES.md):
 *  - data-sources/svd/*.json      stardew-valley-data v1.1.1 (MIT)
 *  - data-sources/wiki/raw/*.wiki Stardew Valley Wiki raw wikitext snapshot (CC BY-NC-SA 3.0)
 *  - data-sources/curated/*.ts    hand-curated rules with evidence notes
 *
 * Never fills gaps with invented values: anything unmapped is reported in
 * src/data/generated/report.json and surfaced honestly in the UI.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { section, cleanWikitext } from './lib/wikitext';
import { extractRawBlocks, buildBlocks } from './lib/schedules';
import { CURATED_FISH } from '../data-sources/curated/fish-rules';
import { REGIONS, PLACES, VILLAGER_HOME, VILLAGER_AVAILABILITY, FESTIVALS, SHOPS, BERRY_WINDOWS, TV_CHANNELS } from '../data-sources/curated/world';
import { parseClock } from '../src/engine/time';
import type * as T from '../src/data/types';

type Season = 'spring' | 'summer' | 'fall' | 'winter';
const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/data/generated');
mkdirSync(out, { recursive: true });

const RETRIEVED = '2026-11-24';
const svd = <X>(name: string): X => JSON.parse(readFileSync(join(root, 'data-sources/svd', `${name}.json`), 'utf8')) as X;
const wikiPath = (page: string) => join(root, 'data-sources/wiki/raw', `${page.replace(/ /g, '_').replace(/[:/]/g, '__')}.wiki`);
const wiki = (page: string): string => (existsSync(wikiPath(page)) ? readFileSync(wikiPath(page), 'utf8') : '');
const wikiUrl = (page: string) => `https://stardewvalleywiki.com/${encodeURIComponent(page.replace(/ /g, '_'))}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const clock = (s: string): number => {
  const v = parseClock(s);
  if (v === null) throw new Error(`Bad clock string: ${s}`);
  return v;
};
const report: { warnings: string[]; counts: Record<string, number> } = { warnings: [], counts: {} };
const warn = (w: string) => report.warnings.push(w);

// ---------------------------------------------------------------- places
const regions: T.Region[] = REGIONS.map((r) => ({ ...r, requires: r.requires as T.Region['requires'] }));
const places: T.Place[] = PLACES.map(({ aliases: _aliases, ...p }) => p);

// ---------------------------------------------------------------- villagers + schedules
interface SvdVillager {
  id: string;
  name: string;
  birthday: { day: number; season: Season };
  address: string;
  occupation: string;
  description: string;
  marriageable: boolean;
  events: { heart: number; id: number; description: string; details: string }[];
  loves: string[];
  likes: string[];
  neutrals: string[];
  dislikes: string[];
  hates: string[];
}
const svdVillagers = svd<SvdVillager[]>('villagers');
const villagers: T.Villager[] = [];
const schedules: T.VillagerSchedule[] = [];
const STATIONARY: Record<string, string> = {
  dwarf: 'The Dwarf stays by the Mines entrance and does not move.',
  krobus: 'Krobus is always in the Sewers (once you have the Rusty Key).',
  wizard: "The Wizard stays in the Wizard's Tower (open 6 AM–11 PM), except on some festival days.",
};

for (const v of svdVillagers) {
  const text = wiki(v.name);
  const sched = section(text, 'Schedule') ?? '';
  const intro = sched.split(/\{\||\{\{ScheduleHeader/)[0] ?? '';
  const notes = intro
    .split('\n')
    .map((l) => cleanWikitext(l).text)
    .filter((l) => l.length > 20 && !/^Shown below/i.test(l));
  const resortVisitor = /may randomly spend the day there/i.test(intro);
  const home = VILLAGER_HOME[v.id];
  if (!home) warn(`villager ${v.id}: no home mapping`);
  const avail = VILLAGER_AVAILABILITY[v.id];
  villagers.push({
    id: v.id,
    name: v.name,
    birthday: v.birthday,
    home: home ?? 'town-square',
    address: v.address,
    occupation: v.occupation,
    description: v.description,
    marriageable: v.marriageable,
    gifts: { loves: v.loves, likes: v.likes, neutrals: v.neutrals, dislikes: v.dislikes, hates: v.hates },
    heartEvents: v.events.map((e) => ({ heart: e.heart, description: e.description, details: e.details })),
    ...(avail ? { availability: { ...avail, requires: avail.requires as NonNullable<T.Villager['availability']>['requires'] } } : {}),
    scheduleNotes: notes,
    resortVisitor,
    ...(STATIONARY[v.id] ? { stationary: STATIONARY[v.id] } : {}),
    source: wikiUrl(v.name),
  });
  const raw = extractRawBlocks(sched);
  const { blocks, marriage, warnings } = buildBlocks(raw, v.id);
  warnings.forEach(warn);
  if (!blocks.length && !STATIONARY[v.id]) warn(`villager ${v.id}: no schedule blocks parsed`);
  schedules.push({ villagerId: v.id, blocks, marriage });
}
report.counts.villagers = villagers.length;
report.counts.scheduleBlocks = schedules.reduce((n, s) => n + s.blocks.length, 0);

// ---------------------------------------------------------------- fish
interface SvdFish {
  id: string;
  name: string;
  description: string;
  catchType: string;
  category: string;
  sellPrice: number;
  difficulty?: number;
  usedIn?: string[];
}
const FISH_AREAS: T.FishAreaInfo[] = [
  { id: 'ocean', name: 'Ocean (The Beach)', region: 'beach', water: 'salt', description: 'Anywhere along the beach and piers.' },
  { id: 'river-town', name: 'Town river', region: 'town', water: 'fresh', description: 'The river running through Pelican Town.' },
  { id: 'river-forest', name: 'Forest river', region: 'forest', water: 'fresh', description: 'The river through Cindersap Forest.' },
  { id: 'mountain-lake', name: 'Mountain lake', region: 'mountain', water: 'fresh', description: "The lake by Robin's house." },
  { id: 'forest-pond', name: 'Forest pond', region: 'forest', water: 'fresh', description: "The pond in north-west Cindersap Forest, near the farm's south exit." },
  { id: 'forest-waterfalls', name: 'Forest waterfalls', region: 'forest', water: 'fresh', description: 'Bottom of the waterfalls east of the Abandoned House (south Cindersap Forest).' },
  { id: 'secret-woods', name: 'Secret Woods pond', region: 'secret-woods', water: 'fresh', requires: 'secretWoods', description: 'Small pond in the Secret Woods.' },
  { id: 'sewers', name: 'The Sewers', region: 'sewers', water: 'special', requires: 'sewersAccess', description: 'Water channels in the Sewers.' },
  { id: 'mutant-bug-lair', name: 'Mutant Bug Lair', region: 'sewers', water: 'special', requires: 'mutantBugLair', description: 'Through the Sewers.' },
  { id: 'witchs-swamp', name: "Witch's Swamp", region: 'witchs-swamp', water: 'special', requires: 'witchsSwamp', description: "Beyond the Witch's Hut." },
  { id: 'desert', name: 'Desert pond', region: 'desert', water: 'fresh', requires: 'busRepaired', description: 'The pond in the Calico Desert.' },
  { id: 'mines-20', name: 'Mines floor 20', region: 'mines', water: 'cave', description: 'Water on floor 20 of the Mines.' },
  { id: 'mines-60', name: 'Mines floor 60', region: 'mines', water: 'cave', description: 'Water on floor 60 of the Mines.' },
  { id: 'mines-100', name: 'Mines floor 100', region: 'mines', water: 'cave', description: 'Lava on floor 100 of the Mines.' },
  { id: 'volcano', name: 'Volcano Caldera', region: 'island', water: 'cave', requires: 'islandAccess', description: 'Lava at the top of the Ginger Island volcano.' },
  { id: 'submarine', name: 'Night Market submarine', region: 'beach', water: 'salt', description: 'Deep-sea submarine ride at the Night Market (Winter 15–17, 5 PM–2 AM).' },
  { id: 'island-ocean', name: 'Ginger Island ocean', region: 'island', water: 'salt', requires: 'islandAccess', description: 'Island West (ocean), South and Southeast.' },
  { id: 'island-freshwater', name: 'Ginger Island freshwater', region: 'island', water: 'fresh', requires: 'islandAccess', description: 'Island North and West (freshwater).' },
  { id: 'pirate-cove', name: 'Pirate Cove', region: 'island', water: 'salt', requires: 'islandAccess', description: 'Cave on Ginger Island Southeast.' },
];
const areaIds = new Set(FISH_AREAS.map((a) => a.id));
const FISH_COLORS: Record<string, string> = {};
const parseWindow = (s: string): { start: number; end: number } => {
  if (s === 'any') return { start: 360, end: 1560 };
  const [a, b] = s.split('-');
  const start = clock(a!);
  let end = clock(b!);
  if (end <= start) end += 24 * 60; // defensive
  return { start, end };
};
const svdFish = svd<SvdFish[]>('fish');
const fish: T.Fish[] = [];
for (const c of CURATED_FISH) {
  const base = svdFish.find((f) => f.name === c.name);
  if (!base) {
    warn(`fish ${c.name}: not in stardew-valley-data`);
    continue;
  }
  const id = slug(c.name);
  const rules: T.FishRule[] = c.rules.map((r, i) => {
    for (const a of r.areas) if (!areaIds.has(a)) throw new Error(`Unknown fish area ${a} for ${c.name}`);
    return {
      id: `${id}-${i + 1}`,
      areas: r.areas,
      seasons: r.seasons,
      weather: r.weather,
      windows: r.time.map(parseWindow),
      ...(r.days ? { days: r.days } : {}),
      ...(r.minLevel ? { minLevel: r.minLevel } : {}),
      ...(r.islandWeather ? { islandWeather: true } : {}),
      requires: (r.requires ?? []) as T.FishRule['requires'],
      ...(r.spot ? { spot: r.spot } : {}),
      ...(r.note ? { note: r.note } : {}),
      ...(r.event ? { event: r.event } : {}),
    };
  });
  fish.push({
    id,
    name: c.name,
    description: base.description,
    method: c.method,
    category: base.category,
    ...(c.legendary ? { legendary: c.legendary } : {}),
    sellPrice: base.sellPrice,
    ...(typeof base.difficulty === 'number' ? { difficulty: base.difficulty } : {}),
    rules,
    notes: c.notes ?? [],
    usedIn: base.usedIn ?? [],
    color: FISH_COLORS[id] ?? hueFor(id),
    source: wikiUrl(c.name),
  });
}
for (const f of svdFish) if (!CURATED_FISH.some((c) => c.name === f.name)) warn(`fish ${f.name}: no curated rules (excluded)`);
report.counts.fish = fish.length;

function hueFor(s: string): string {
  const h = createHash('md5').update(s).digest()[0]!;
  return `hsl(${Math.round((h / 255) * 360)} 45% 55%)`;
}

// ---------------------------------------------------------------- festivals / checkups / calendar extras
const festivals: T.Festival[] = FESTIVALS.map((f) => ({
  ...f,
  start: clock(f.start),
  end: clock(f.end) <= clock(f.start) ? clock(f.end) + 24 * 60 : clock(f.end),
  requires: f.requires as T.Festival['requires'],
}));

const checkups: T.Checkup[] = [];
{
  const clinic = wiki("Harvey's Clinic");
  const appts = clinic.split('==Appointments==')[1] ?? '';
  let season: Season | null = null;
  for (const line of appts.split('\n')) {
    const h = /^===\s*(Spring|Summer|Fall|Winter)\s*===/.exec(line);
    if (h) season = h[1]!.toLowerCase() as Season;
    const row = /^\|(\d{1,2})\|\|(.*?)\|\|\s*([\d:]+\s*[ap]m)\s*-\s*([\d:]+\s*[ap]m)/i.exec(line);
    if (row && season) {
      const who = cleanWikitext(row[2]!).text.trim();
      const name = who.replace(/\(.*\)/, '').trim();
      const v = svdVillagers.find((x) => x.name === name);
      if (!v) {
        warn(`checkup: unknown villager ${who}`);
        continue;
      }
      checkups.push({
        villagerId: v.id,
        season,
        day: Number(row[1]),
        window: { start: clock(row[3]!), end: clock(row[4]!) },
        ...(/\(/.test(who) ? { note: who.match(/\((.*)\)/)![1] } : {}),
      });
    }
  }
}
report.counts.checkups = checkups.length;

const seasonsData = svd<{ id: Season; bookseller: number[] }[]>('seasons');
const extras: T.CalendarExtras = {
  bookseller: Object.fromEntries(SEASONS.map((s) => [s, seasonsData.find((x) => x.id === s)?.bookseller ?? []])) as Record<Season, number[]>,
  berries: BERRY_WINDOWS,
  greenRainDays: [5, 6, 7, 14, 15, 16, 18, 23],
  tvChannels: TV_CHANNELS as T.CalendarExtras['tvChannels'],
};
{
  // cross-check bookseller days with wiki table
  const bs = wiki('Bookseller');
  for (const s of SEASONS) {
    const m = new RegExp(`\\{\\{Season\\|${s}\\}\\}\\s*\\n\\|([\\d, ]+)`, 'i').exec(bs);
    const wikiDays = m ? m[1]!.split(',').map((d) => Number(d.trim())) : null;
    if (!wikiDays || wikiDays.join() !== extras.bookseller[s].join()) warn(`bookseller ${s}: dataset ${extras.bookseller[s]} vs wiki ${wikiDays}`);
  }
}

// ---------------------------------------------------------------- shops
const shops: T.Shop[] = SHOPS.map((s) => ({
  id: s.id,
  name: s.name,
  place: s.place,
  ...(s.owner ? { owner: s.owner } : {}),
  open: clock(s.open),
  close: clock(s.close) <= clock(s.open) ? clock(s.close) + 24 * 60 : clock(s.close),
  ...(s.buildingOpen ? { buildingOpen: clock(s.buildingOpen), buildingClose: clock(s.buildingClose!) } : {}),
  closedWeekdays: s.closedWeekdays ?? [],
  exceptions: (s.exceptions ?? []).map((e) => {
    if (e.kind === 'earlyCloseWeekday') return { ...e, close: clock(e.close) };
    if (e.kind === 'closedDates') return { ...e, season: e.season as Season, ...(e.from ? { from: clock(e.from) } : {}) };
    return e;
  }) as T.ShopExceptionData[],
  ...(s.seasons ? { seasons: s.seasons as Season[] } : {}),
  ...(s.requires ? { requires: s.requires as T.Shop['requires'] } : {}),
  closedOnMainFestivals: s.closedOnMainFestivals ?? false,
  sells: s.sells,
  notes: s.notes ?? [],
}));

// ---------------------------------------------------------------- crops
interface SvdCrop {
  id: string;
  name: string;
  category: string;
  seasons: Season[];
  growDays: number;
  regrowDays: number | null;
  seedName: string;
  seedBuyPrices: { place: string; price: number }[];
  cropSellPrice: number;
  trellis: boolean;
  giant: boolean;
  harvestQuantity: { min: number; max: number };
}
const cropsWiki = wiki('Crops');
const phasesFor = (name: string): number[] | null => {
  const idx = cropsWiki.search(new RegExp(`===\\s*\\[\\[File:[^\\]]*\\]\\]\\s*\\[\\[${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|[^\\]]*)?\\]\\]\\s*===`));
  if (idx < 0) return null;
  const chunk = cropsWiki.slice(idx, idx + 6000);
  const end = chunk.indexOf('Total:');
  if (end < 0) return null;
  const days = [...chunk.slice(0, end).matchAll(/^\|\s*(\d+)\s*days?\s*$/gm)].map((m) => Number(m[1]));
  const total = /Total:\s*(\d+)/.exec(chunk.slice(end))?.[1];
  if (!days.length || Number(total) !== days.reduce((a, b) => a + b, 0)) return null;
  return days;
};
const crops: T.Crop[] = svd<SvdCrop[]>('crops').map((c) => {
  const phases = phasesFor(c.name);
  if (!phases) warn(`crop ${c.name}: no stage lengths found (fertiliser maths approximate)`);
  else if (phases.reduce((a, b) => a + b, 0) !== c.growDays) {
    warn(`crop ${c.name}: wiki stages sum ${phases.reduce((a, b) => a + b, 0)} ≠ dataset growDays ${c.growDays}`);
  }
  return {
    id: slug(c.name),
    name: c.name,
    seasons: c.seasons.filter((s) => (SEASONS as string[]).includes(s)),
    growDays: c.growDays,
    phases: phases && phases.reduce((a, b) => a + b, 0) === c.growDays ? phases : null,
    regrowDays: c.regrowDays,
    seedName: c.seedName,
    seedPrices: c.seedBuyPrices ?? [],
    sellPrice: c.cropSellPrice,
    trellis: c.trellis,
    giant: c.giant,
    category: c.category,
    harvest: c.harvestQuantity ?? { min: 1, max: 1 },
    paddy: /rice|taro/i.test(c.name),
    source: wikiUrl(c.name),
  };
});
report.counts.crops = crops.length;

// ---------------------------------------------------------------- forage
interface SvdForage {
  id: string;
  name: string;
  seasons: string[];
  locations: string;
  sellPrice: number;
}
const REGION_WORDS: [RegExp, string][] = [
  [/pelican town|town/i, 'town'],
  [/cindersap|forest/i, 'forest'],
  [/beach|ocean/i, 'beach'],
  [/mountain/i, 'mountain'],
  [/railroad/i, 'railroad'],
  [/backwoods/i, 'backwoods'],
  [/bus stop/i, 'bus-stop'],
  [/secret woods/i, 'secret-woods'],
  [/desert/i, 'desert'],
  [/ginger island|island/i, 'island'],
  [/mines|cavern|cave/i, 'mines'],
  [/farm/i, 'farm'],
];
const forage: T.Forage[] = svd<SvdForage[]>('forageables').map((f) => {
  const seasons = f.seasons.filter((s) => (SEASONS as string[]).includes(s)) as Season[];
  const berry = BERRY_WINDOWS.find((b) => b.item === f.name);
  return {
    id: slug(f.name),
    name: f.name,
    seasons: seasons.length ? seasons : SEASONS,
    locations: f.locations,
    sellPrice: f.sellPrice,
    regions: REGION_WORDS.filter(([re]) => re.test(f.locations)).map(([, id]) => id),
    ...(berry ? { window: { season: berry.season, from: berry.from, to: berry.to } } : {}),
  };
});
report.counts.forage = forage.length;

// ---------------------------------------------------------------- bundles
interface SvdBundle {
  id: string;
  type: 'items' | 'gold';
  name: string;
  room: string;
  bundleGroup: number;
  items?: { name: string; quantity: number; quality?: string }[];
  itemsRequired?: number;
  remixBundle?: boolean;
  reward?: { name: string; quantity: number };
  goldCost?: number;
  cost?: number;
}
const ROOM_NAMES: Record<string, string> = {
  'crafts-room': 'Crafts Room',
  pantry: 'Pantry',
  'fish-tank': 'Fish Tank',
  'boiler-room': 'Boiler Room',
  'bulletin-board': 'Bulletin Board',
  vault: 'Vault',
  'abandoned-joja-mart': 'Abandoned JojaMart',
};
const refFor = (name: string): { kind: string; id: string } | undefined => {
  const id = slug(name);
  if (fish.some((f) => f.id === id)) return { kind: 'fish', id };
  if (crops.some((c) => c.id === id)) return { kind: 'crop', id };
  if (forage.some((f) => f.id === id)) return { kind: 'forage', id };
  return undefined;
};
const bundles: T.Bundle[] = svd<SvdBundle[]>('bundles').map((b) => {
  const gold = b.type === 'gold' ? Number(/([\d,]+)g/.exec(b.name)?.[1]?.replace(/,/g, '') ?? 0) : undefined;
  return {
    id: slug(b.id),
    name: b.name,
    room: b.room,
    roomName: ROOM_NAMES[b.room] ?? b.room,
    group: b.bundleGroup,
    remix: !!b.remixBundle,
    type: b.type,
    ...(gold ? { goldCost: gold } : {}),
    itemsRequired: b.itemsRequired ?? (b.items?.length ?? 0),
    items: (b.items ?? []).map((i) => ({ ...i, ...(refFor(i.name) ? { ref: refFor(i.name) } : {}) })),
    reward: b.reward ? `${b.reward.quantity > 1 ? `${b.reward.quantity} × ` : ''}${b.reward.name}` : '',
  };
});
report.counts.bundles = bundles.length;

// ---------------------------------------------------------------- museum
interface SvdMuseum {
  id: string;
  name: string;
  description?: string;
  sellPrice?: number;
  locations?: string[] | string;
  location?: string[] | string;
  sources?: string[];
  type?: string;
}
const toList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []);
const museum: T.MuseumItem[] = [
  ...svd<SvdMuseum[]>('artifacts').map((a) => ({ a, kind: 'artifact' as const })),
  ...svd<SvdMuseum[]>('minerals')
    .filter((m) => !m.type || !/node/i.test(m.type))
    .map((a) => ({ a, kind: 'mineral' as const })),
].map(({ a, kind }) => ({
  id: `${kind}-${slug(a.name)}`,
  name: a.name,
  kind,
  description: a.description ?? '',
  sellPrice: a.sellPrice ?? 0,
  sources: [...toList(a.locations), ...toList(a.location), ...toList(a.sources)],
}));
report.counts.museum = museum.length;

// ---------------------------------------------------------------- recipes + Queen of Sauce
interface SvdRecipe {
  id: string;
  name: string;
  description: string;
  sellPrice: number;
  ingredients: { name: string; quantity: number }[];
  recipeSources: { type: string; [k: string]: unknown }[];
}
const qos = wiki('The Queen of Sauce');
const qosDates = new Map<string, { cycleYear: 1 | 2; season: Season; day: number }>();
{
  const rows = qos.split('\n|-');
  for (const r of rows) {
    const name = /^\|(?:class=\"[^\"]*\"\|)?\[\[(?!File:)([^\]|]+)(?:\|[^\]]*)?\]\]\s*$/m.exec(r)?.[1];
    const date = /\|\s*(?:data-sort-value="[^"]*"\|)?\s*(\d{1,2}) (Spring|Summer|Fall|Winter), Year ([12])/.exec(r);
    if (name && date) qosDates.set(name, { cycleYear: Number(date[3]) as 1 | 2, season: date[2]!.toLowerCase() as Season, day: Number(date[1]) });
  }
}
const describeSource = (s: { type: string; [k: string]: unknown }): string => {
  switch (s.type) {
    case 'default':
      return 'Known from the start';
    case 'friendship':
      return `Mail from ${String(s.villager ?? 'a villager')} at ${String(s.hearts ?? '?')} hearts`;
    case 'queen-of-sauce':
      return 'The Queen of Sauce (TV)';
    case 'shop':
      return `Bought at ${String(s.shop ?? s.place ?? 'a shop')}${s.price ? ` for ${String(s.price)}g` : ''}`;
    case 'skill':
      return `${String(s.skill ?? 'Skill')} level ${String(s.level ?? '?')}`;
    default:
      return Object.entries(s)
        .filter(([k]) => k !== 'type')
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ') || s.type;
  }
};
const recipes: T.Recipe[] = svd<SvdRecipe[]>('cooking').map((r) => ({
  id: slug(r.name),
  name: r.name,
  description: r.description,
  ingredients: r.ingredients.map((i) => ({ name: i.name, quantity: i.quantity })),
  sources: r.recipeSources.map(describeSource),
  sellPrice: r.sellPrice,
  ...(qosDates.get(r.name) ? { tv: qosDates.get(r.name)! } : {}),
}));
const tvCount = recipes.filter((r) => r.tv).length;
if (tvCount !== 32) warn(`queen of sauce: matched ${tvCount} recipes to air dates (expected 32)`);
report.counts.recipes = recipes.length;
report.counts.tvRecipes = tvCount;

// ---------------------------------------------------------------- universal gifts
const universal = svd<T.UniversalGifts>('universal-gifts');

// ---------------------------------------------------------------- write
const files: Record<string, unknown> = {
  regions,
  places,
  villagers,
  schedules,
  'fish-areas': FISH_AREAS,
  fish,
  festivals,
  checkups,
  'calendar-extras': extras,
  shops,
  crops,
  forage,
  bundles,
  museum,
  recipes,
  'universal-gifts': universal,
};
const checksums: Record<string, string> = {};
for (const [name, data] of Object.entries(files)) {
  const json = JSON.stringify(data);
  checksums[name] = createHash('sha256').update(json).digest('hex').slice(0, 16);
  writeFileSync(join(out, `${name}.json`), json);
}
const meta: T.Meta = {
  ruleset: 'vanilla-1.6',
  gameVersion: '1.6.15',
  platforms: 'PC (Windows/macOS/Linux) 1.6.15; consoles and mobile on 1.6.x share these mechanics but may lag behind PC patches.',
  generatedAt: RETRIEVED,
  sources: [
    { label: 'Stardew Valley Wiki (raw wikitext snapshot)', url: 'https://stardewvalleywiki.com/', license: 'CC BY-NC-SA 3.0', retrieved: RETRIEVED },
    { label: 'stardew-valley-data v1.1.1 by Christopher Pezza', url: 'https://github.com/chiefpansancolt/stardew-valley-data', license: 'MIT', retrieved: RETRIEVED },
  ],
  checksums,
};
writeFileSync(join(out, 'meta.json'), JSON.stringify(meta, null, 2));
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Data built: ${Object.entries(report.counts).map(([k, v]) => `${k}=${v}`).join(' ')}; ${report.warnings.length} warnings (see src/data/generated/report.json)`);
