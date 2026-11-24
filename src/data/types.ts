/**
 * Types of the normalised, generated datasets in src/data/generated/*.json.
 * Produced by scripts/build-data.ts; consumed by the engine and UI.
 */
import type { Season } from '../engine/calendar';
import type { Condition } from '../engine/conditions';
import type { ProgressFlag } from '../engine/progress';
import type { TimeWindow } from '../engine/time';

export interface SourceRef {
  label: string;
  url: string;
  license: string;
  retrieved: string;
}

export interface Meta {
  ruleset: string;
  gameVersion: string;
  platforms: string;
  generatedAt: string;
  sources: SourceRef[];
  checksums: Record<string, string>;
}

export interface Region {
  id: string;
  name: string;
  x: number;
  y: number;
  offMap?: boolean;
  description: string;
  requires?: ProgressFlag;
}

export interface Place {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  kind: 'shop' | 'home' | 'building' | 'outdoor' | 'water' | 'service';
}

export interface GiftTastes {
  loves: string[];
  likes: string[];
  neutrals: string[];
  dislikes: string[];
  hates: string[];
}

export interface Villager {
  id: string;
  name: string;
  birthday: { season: Season; day: number };
  home: string;
  address: string;
  occupation: string;
  description: string;
  marriageable: boolean;
  gifts: GiftTastes;
  heartEvents: { heart: number; description: string; details: string }[];
  availability?: { requires?: ProgressFlag; note: string; spoiler?: boolean };
  /** Short notes from the wiki schedule section intro (resort visits etc.) */
  scheduleNotes: string[];
  /** May randomly visit the Ginger Island resort once it is open */
  resortVisitor: boolean;
  /** Fixed location, no daily schedule (e.g. Dwarf, Krobus, Wizard, Sandy) */
  stationary?: string;
  source: string;
}

export interface ScheduleStep {
  time: number;
  text: string;
  place: string | null;
  kind: 'at' | 'travel';
  /** place inherited from previous step because the text names none */
  inferred?: boolean;
}

export interface ScheduleBlock {
  id: string;
  label: string;
  /** season section this block belongs to; 'any' = applies all year */
  season: Season | 'any';
  condition: Condition;
  /** Blocks sharing a group are random alternatives (e.g. Rain option 1/2) */
  variantGroup?: string;
  /** Labels/qualifiers we could not translate into typed conditions */
  unparsed?: string[];
  steps: ScheduleStep[];
}

export interface VillagerSchedule {
  villagerId: string;
  blocks: ScheduleBlock[];
  marriage: ScheduleBlock[];
}

export type FishArea = string;

export interface FishAreaInfo {
  id: FishArea;
  name: string;
  region: string;
  water: 'fresh' | 'salt' | 'cave' | 'special';
  requires?: ProgressFlag;
  description: string;
}

export interface FishRule {
  id: string;
  areas: FishArea[];
  seasons: Season[];
  weather: 'rain' | 'dry' | 'any';
  windows: TimeWindow[];
  days?: [number, number];
  minLevel?: number;
  islandWeather?: boolean;
  requires: ProgressFlag[];
  spot?: string;
  note?: string;
  event?: string;
}

export interface Fish {
  id: string;
  name: string;
  description: string;
  method: 'rod' | 'crab-pot';
  category: string;
  legendary?: 'legendary' | 'legendary-2';
  sellPrice: number;
  difficulty?: number;
  behavior?: string;
  rules: FishRule[];
  notes: string[];
  usedIn: string[];
  color: string;
  source: string;
}

export interface Festival {
  id: string;
  name: string;
  season: Season;
  startDay: number;
  endDay: number;
  start: number;
  end: number;
  place: string;
  region: string;
  kind: 'main' | 'mini';
  requires?: ProgressFlag;
  description: string;
}

export interface Checkup {
  villagerId: string;
  season: Season;
  day: number;
  window: TimeWindow;
  note?: string;
}

export interface Shop {
  id: string;
  name: string;
  place: string;
  owner?: string;
  open: number;
  close: number;
  buildingOpen?: number;
  buildingClose?: number;
  closedWeekdays: string[];
  exceptions: ShopExceptionData[];
  seasons?: Season[];
  requires?: ProgressFlag;
  closedOnMainFestivals: boolean;
  sells: string;
  notes: string[];
}

export type ShopExceptionData =
  | { kind: 'closedWeekdayUnlessFlag'; weekday: string; flag: ProgressFlag; note: string }
  | { kind: 'closedWeekdayIfFlag'; weekday: string; flag: ProgressFlag; note: string }
  | { kind: 'closedIfFlag'; flag: ProgressFlag; note: string }
  | { kind: 'closedWeekdayUnlessRain'; weekday: string; note: string }
  | { kind: 'closedWhenRaining'; note: string }
  | { kind: 'earlyCloseWeekday'; weekday: string; close: number; note: string }
  | { kind: 'closedDates'; season: Season; days: number[]; from?: number; note: string };

export interface Crop {
  id: string;
  name: string;
  seasons: Season[];
  growDays: number;
  /** stage lengths (wiki), used for exact fertiliser maths when present */
  phases: number[] | null;
  regrowDays: number | null;
  seedName: string;
  seedPrices: { place: string; price: number }[];
  sellPrice: number;
  trellis: boolean;
  giant: boolean;
  category: string;
  harvest: { min: number; max: number };
  paddy: boolean;
  source: string;
}

export interface Forage {
  id: string;
  name: string;
  seasons: Season[];
  locations: string;
  sellPrice: number;
  regions: string[];
  window?: { season: Season; from: number; to: number };
}

export interface Bundle {
  id: string;
  name: string;
  room: string;
  roomName: string;
  group: number;
  remix: boolean;
  type: 'items' | 'gold';
  goldCost?: number;
  itemsRequired: number;
  items: { name: string; quantity: number; quality?: string; ref?: { kind: string; id: string } }[];
  reward: string;
}

export interface MuseumItem {
  id: string;
  name: string;
  kind: 'artifact' | 'mineral';
  description: string;
  sellPrice: number;
  sources: string[];
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: { name: string; quantity: number }[];
  sources: string[];
  sellPrice: number;
  /** Queen of Sauce original Sunday air date in the 2-year cycle */
  tv?: { cycleYear: 1 | 2; season: Season; day: number };
}

export interface CalendarExtras {
  bookseller: Record<Season, number[]>;
  berries: { id: string; name: string; item: string; season: Season; from: number; to: number; region: string; note: string }[];
  greenRainDays: number[];
  tvChannels: { id: string; name: string; days: 'daily' | string[]; note: string }[];
}

export interface UniversalGifts {
  loves: string[];
  likes: string[];
  neutrals: string[];
  dislikes: string[];
  hates: string[];
}
