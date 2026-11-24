/**
 * Farm profile: the user's saved, durable state. Pure types + validation/migration so
 * backups can be imported safely. Transient preview/UI state is NOT stored here.
 */
import { isValidDate, isSeason, type GameDate } from './calendar';
import { isWeather, type Weather } from './weather';
import { isValidGameTime, type GameMinutes } from './time';
import { PROGRESS_FLAGS, type FarmType, type PlayerProgress, type ProgressFlag } from './progress';

export const PROFILE_SCHEMA_VERSION = 1;

export type WatchKind = 'fish' | 'villager' | 'crop' | 'forage' | 'bundle' | 'event' | 'recipe' | 'museum' | 'custom';

export interface WatchItem {
  id: string;
  kind: WatchKind;
  /** entity id (absent for custom goals) */
  ref?: string;
  title: string;
  note?: string;
  /** optional in-game due/reminder date */
  due?: GameDate;
  pinned?: boolean;
  /** hidden until this date */
  snoozedUntil?: GameDate;
  done?: boolean;
  /** recurring opportunities stay after completion of one occurrence */
  recurring?: boolean;
  createdAt: GameDate;
}

export interface NoteItem {
  id: string;
  text: string;
  date: GameDate;
  updatedAt: number;
}

export interface Collections {
  /** fish id → caught */
  fishCaught: Record<string, true>;
  /** bundle id → item index → submitted */
  bundleItems: Record<string, Record<number, true>>;
  /** bundles the player actually has (remixed CC) */
  bundleSelection: Record<string, true>;
  /** museum item id → donated */
  museumDonated: Record<string, true>;
  /** recipe id → known */
  recipesKnown: Record<string, true>;
  /** recipe id → cooked */
  recipesCooked: Record<string, true>;
}

export interface Preferences {
  spoilers: 'hide' | 'show';
  hiddenLayers: string[];
  hiddenTodaySections: string[];
  collectionFocus: boolean;
  /** reminders dismissed for a particular day: `${dayIndex}:${id}` */
  dismissed: string[];
}

export interface DayRecord {
  date: GameDate;
  weather: Weather;
  islandWeather: Weather;
  time: GameMinutes | null;
}

export interface Profile {
  schema: number;
  id: string;
  farmName: string;
  playerName: string;
  ruleset: 'vanilla-1.6';
  platform: 'pc' | 'console' | 'mobile' | 'unknown';
  createdAt: number;
  updatedAt: number;
  onboarded: boolean;
  day: DayRecord;
  /** known forecast for tomorrow from the TV */
  tomorrowWeather: Weather;
  /** previous days for undo (most recent last, capped) */
  history: DayRecord[];
  progress: PlayerProgress;
  favourites: Record<string, true>;
  watchlist: WatchItem[];
  notes: NoteItem[];
  collections: Collections;
  prefs: Preferences;
  /** manual gift log: villagerId → list of {date, item} */
  gifts: Record<string, { date: GameDate; item: string }[]>;
}

export const EMPTY_COLLECTIONS: Collections = {
  fishCaught: {},
  bundleItems: {},
  bundleSelection: {},
  museumDonated: {},
  recipesKnown: {},
  recipesCooked: {},
};

export function newProfile(id: string, farmName = 'My Farm', now = Date.now()): Profile {
  return {
    schema: PROFILE_SCHEMA_VERSION,
    id,
    farmName,
    playerName: '',
    ruleset: 'vanilla-1.6',
    platform: 'unknown',
    createdAt: now,
    updatedAt: now,
    onboarded: false,
    day: { date: { year: 1, season: 'spring', day: 1 }, weather: 'sun', islandWeather: 'unknown', time: null },
    tomorrowWeather: 'unknown',
    history: [],
    progress: { flags: {}, hearts: {} },
    favourites: {},
    watchlist: [],
    notes: [],
    collections: structuredClone(EMPTY_COLLECTIONS),
    prefs: { spoilers: 'hide', hiddenLayers: [], hiddenTodaySections: [], collectionFocus: false, dismissed: [] },
    gifts: {},
  };
}

// ------------------------------------------------------------------ validation

export class ImportError extends Error {}

const MAX_IMPORT_BYTES = 2_000_000;
const MAX_LIST = 5000;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 200, fallback = ''): string => (typeof v === 'string' ? v.slice(0, max) : fallback);

function date(v: unknown, fallback: GameDate): GameDate {
  if (isObj(v) && isSeason(v.season) && typeof v.year === 'number' && typeof v.day === 'number') {
    const d = { year: Math.floor(v.year), season: v.season, day: Math.floor(v.day) };
    if (isValidDate(d)) return d;
  }
  return fallback;
}

function trueMap(v: unknown, keyPattern = /^[\w\-.']{1,80}$/): Record<string, true> {
  const out: Record<string, true> = {};
  if (!isObj(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v)) {
    if (val === true && keyPattern.test(k) && n++ < MAX_LIST) out[k] = true;
  }
  return out;
}

function dayRecord(v: unknown, fallback: DayRecord): DayRecord {
  if (!isObj(v)) return fallback;
  return {
    date: date(v.date, fallback.date),
    weather: isWeather(v.weather) ? v.weather : 'unknown',
    islandWeather: isWeather(v.islandWeather) ? v.islandWeather : 'unknown',
    time: typeof v.time === 'number' && isValidGameTime(v.time) ? v.time : null,
  };
}

/** Turn untrusted JSON (backup file) into a valid Profile, migrating older schemas. */
export function sanitizeProfile(raw: unknown, idFallback: string): Profile {
  if (!isObj(raw)) throw new ImportError('This file is not a Valley Almanac profile.');
  const schema = typeof raw.schema === 'number' ? raw.schema : 0;
  if (schema > PROFILE_SCHEMA_VERSION) throw new ImportError('This backup was made by a newer version of the app.');
  const base = newProfile(str(raw.id, 64) || idFallback);
  const p: Profile = {
    ...base,
    farmName: str(raw.farmName, 60, base.farmName) || base.farmName,
    playerName: str(raw.playerName, 60),
    platform: (['pc', 'console', 'mobile', 'unknown'] as const).includes(raw.platform as never) ? (raw.platform as Profile['platform']) : 'unknown',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : base.createdAt,
    updatedAt: Date.now(),
    onboarded: raw.onboarded === true,
    day: dayRecord(raw.day, base.day),
    tomorrowWeather: isWeather(raw.tomorrowWeather) ? raw.tomorrowWeather : 'unknown',
    history: Array.isArray(raw.history) ? raw.history.slice(-30).map((h) => dayRecord(h, base.day)) : [],
  };
  // progress
  if (isObj(raw.progress)) {
    const pr = raw.progress;
    const flags: Partial<Record<ProgressFlag, boolean>> = {};
    if (isObj(pr.flags)) for (const f of PROGRESS_FLAGS) if (typeof pr.flags[f] === 'boolean') flags[f] = pr.flags[f] as boolean;
    const hearts: Record<string, number> = {};
    if (isObj(pr.hearts))
      for (const [k, v] of Object.entries(pr.hearts)) if (/^[a-z-]{2,30}$/.test(k) && typeof v === 'number' && v >= 0 && v <= 14) hearts[k] = Math.floor(v);
    p.progress = {
      flags,
      hearts,
      ...(pr.spouse === null || (typeof pr.spouse === 'string' && /^[a-z-]{2,30}$/.test(pr.spouse)) ? { spouse: pr.spouse as string | null } : {}),
      ...(typeof pr.fishingLevel === 'number' && pr.fishingLevel >= 0 && pr.fishingLevel <= 14 ? { fishingLevel: Math.floor(pr.fishingLevel) } : {}),
      ...(typeof pr.farmType === 'string' && ['standard', 'riverland', 'forest', 'hilltop', 'wilderness', 'four-corners', 'beach', 'meadowlands'].includes(pr.farmType)
        ? { farmType: pr.farmType as FarmType }
        : {}),
      ...(pr.bundleMode === 'standard' || pr.bundleMode === 'remixed' ? { bundleMode: pr.bundleMode } : {}),
    };
  }
  p.favourites = trueMap(raw.favourites);
  if (Array.isArray(raw.watchlist))
    p.watchlist = raw.watchlist.slice(0, 500).flatMap((w): WatchItem[] => {
      if (!isObj(w)) return [];
      const kinds: WatchKind[] = ['fish', 'villager', 'crop', 'forage', 'bundle', 'event', 'recipe', 'museum', 'custom'];
      if (!kinds.includes(w.kind as WatchKind)) return [];
      return [
        {
          id: str(w.id, 64) || Math.random().toString(36).slice(2),
          kind: w.kind as WatchKind,
          ...(typeof w.ref === 'string' ? { ref: str(w.ref, 80) } : {}),
          title: str(w.title, 120) || 'Goal',
          ...(typeof w.note === 'string' ? { note: str(w.note, 1000) } : {}),
          ...(w.due ? { due: date(w.due, base.day.date) } : {}),
          ...(w.snoozedUntil ? { snoozedUntil: date(w.snoozedUntil, base.day.date) } : {}),
          pinned: w.pinned === true,
          done: w.done === true,
          recurring: w.recurring === true,
          createdAt: date(w.createdAt, base.day.date),
        },
      ];
    });
  if (Array.isArray(raw.notes))
    p.notes = raw.notes.slice(0, 1000).flatMap((n): NoteItem[] =>
      isObj(n) ? [{ id: str(n.id, 64) || Math.random().toString(36).slice(2), text: str(n.text, 5000), date: date(n.date, base.day.date), updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now() }] : [],
    );
  if (isObj(raw.collections)) {
    const c = raw.collections;
    const bundleItems: Collections['bundleItems'] = {};
    if (isObj(c.bundleItems))
      for (const [k, v] of Object.entries(c.bundleItems)) {
        if (!/^[\w\-.']{1,80}$/.test(k) || !isObj(v)) continue;
        const items: Record<number, true> = {};
        for (const [i, t] of Object.entries(v)) if (t === true && /^\d{1,3}$/.test(i)) items[Number(i)] = true;
        bundleItems[k] = items;
      }
    p.collections = {
      fishCaught: trueMap(c.fishCaught),
      bundleItems,
      bundleSelection: trueMap(c.bundleSelection),
      museumDonated: trueMap(c.museumDonated),
      recipesKnown: trueMap(c.recipesKnown),
      recipesCooked: trueMap(c.recipesCooked),
    };
  }
  if (isObj(raw.prefs)) {
    const pr = raw.prefs;
    const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500).map((x) => x.slice(0, 120)) : []);
    p.prefs = {
      spoilers: pr.spoilers === 'show' ? 'show' : 'hide',
      hiddenLayers: strList(pr.hiddenLayers),
      hiddenTodaySections: strList(pr.hiddenTodaySections),
      collectionFocus: pr.collectionFocus === true,
      dismissed: strList(pr.dismissed),
    };
  }
  if (isObj(raw.gifts)) {
    for (const [k, v] of Object.entries(raw.gifts)) {
      if (!/^[a-z-]{2,30}$/.test(k) || !Array.isArray(v)) continue;
      p.gifts[k] = v.slice(0, 200).flatMap((g) => (isObj(g) ? [{ date: date(g.date, base.day.date), item: str(g.item, 80) }] : []));
    }
  }
  return p;
}

export interface BackupFile {
  app: 'the-valley-almanac';
  exportedAt: number;
  schema: number;
  profiles: Profile[];
}

export function parseBackup(text: string): Profile[] {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError('That file is too large to be a Valley Almanac backup.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('That file is not valid JSON.');
  }
  if (!isObj(data) || data.app !== 'the-valley-almanac' || !Array.isArray(data.profiles))
    throw new ImportError('This file is not a Valley Almanac backup.');
  if (data.profiles.length === 0 || data.profiles.length > 20) throw new ImportError('The backup has no usable farm profiles.');
  return data.profiles.map((p, i) => sanitizeProfile(p, `imported-${Date.now()}-${i}`));
}

export function makeBackup(profiles: Profile[]): BackupFile {
  return { app: 'the-valley-almanac', exportedAt: Date.now(), schema: PROFILE_SCHEMA_VERSION, profiles };
}
