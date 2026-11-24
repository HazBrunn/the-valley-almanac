/**
 * Local Stardew Valley save-file import (PC/Mac/Linux saves are plain XML).
 * The file is parsed entirely in the browser with DOMParser and never uploaded. Only
 * a small summary is extracted; the user chooses which parts to merge.
 *
 * Element names follow the 1.6 save format (as documented by the MIT-licensed
 * stardew-valley-data save parser). Anything missing is reported as "not found"
 * instead of guessed.
 */
import { fish, museum, recipes, villagers } from '../data';
import { isSeason, type GameDate } from './calendar';
import type { FarmType, ProgressFlag } from './progress';
import type { Weather } from './weather';

export const MAX_SAVE_BYTES = 80 * 1024 * 1024;

export interface SaveSummary {
  gameVersion: string | null;
  farmName: string | null;
  playerName: string | null;
  date: GameDate | null;
  weather: Weather;
  farmType: FarmType | null;
  fishingLevel: number | null;
  spouse: string | null | undefined;
  hearts: Record<string, number>;
  fishCaught: string[];
  recipesKnown: string[];
  recipesCooked: string[];
  museumDonated: string[];
  flags: Partial<Record<ProgressFlag, boolean>>;
  unknownFish: number;
  warnings: string[];
}

const FARM_TYPES: FarmType[] = ['standard', 'riverland', 'forest', 'hilltop', 'wilderness', 'four-corners', 'beach'];

/** Direct child element by local name. */
function child(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return null;
}
function text(el: Element | null | undefined, name: string): string | null {
  const c = child(el, name);
  return c ? (c.textContent ?? '').trim() : null;
}
/** Items of a serialized dictionary: <item><key>…</key><value>…</value></item> */
function dictItems(el: Element | null): { key: Element | null; value: Element | null }[] {
  if (!el) return [];
  return Array.from(el.children)
    .filter((c) => c.localName === 'item')
    .map((i) => ({ key: child(i, 'key'), value: child(i, 'value') }));
}
const keyString = (k: Element | null) => (k ? (child(k, 'string')?.textContent ?? k.textContent ?? '').trim() : '');
const normalizeId = (id: string) => id.replace(/^\([A-Z]+\)/, '');

export function parseSaveXml(xml: string): SaveSummary {
  if (xml.length > MAX_SAVE_BYTES) throw new Error('That file is too large to be a Stardew Valley save.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('That file is not valid XML — pick the save file named like YourFarm_123456789 (not SaveGameInfo).');
  const root = doc.documentElement;
  if (!root || (root.localName !== 'SaveGame' && root.localName !== 'Farmer'))
    throw new Error('This doesn’t look like a Stardew Valley save file.');
  if (root.localName === 'Farmer')
    throw new Error('This is the small “SaveGameInfo” file. Choose the larger file in the same folder that is named after your farm.');

  const warnings: string[] = [];
  const player = child(root, 'player');
  const season = text(root, 'currentSeason');
  const year = Number(text(root, 'year'));
  const day = Number(text(root, 'dayOfMonth'));
  const date = isSeason(season) && year >= 1 && day >= 1 && day <= 28 ? { year, season, day } : null;
  if (!date) warnings.push('Date not found.');

  const bool = (name: string) => text(root, name) === 'true';
  const weather: Weather = bool('isGreenRain') ? 'green-rain' : bool('isLightning') ? 'storm' : bool('isRaining') ? 'rain' : bool('isSnowing') ? 'snow' : bool('isDebrisWeather') ? 'wind' : text(root, 'isRaining') !== null ? 'sun' : 'unknown';

  const whichFarm = Number(text(root, 'whichFarm'));
  const modFarm = text(root, 'whichModFarm') ?? '';
  const farmType: FarmType | null = Number.isInteger(whichFarm) && FARM_TYPES[whichFarm] ? FARM_TYPES[whichFarm]! : /meadow/i.test(modFarm) ? 'meadowlands' : null;

  const lvl = Number(text(player, 'fishingLevel'));
  const fishingLevel = Number.isFinite(lvl) && text(player, 'fishingLevel') !== null ? lvl : null;

  const spouseRaw = text(player, 'spouse');
  const spouseV = spouseRaw ? villagers.find((v) => v.name.toLowerCase() === spouseRaw.toLowerCase()) : undefined;
  const spouse = spouseRaw === null ? undefined : spouseRaw === '' ? null : (spouseV?.id ?? null);

  const hearts: Record<string, number> = {};
  for (const { key, value } of dictItems(child(player, 'friendshipData'))) {
    const name = keyString(key);
    const v = villagers.find((x) => x.name === name);
    const points = Number(text(child(value, 'Friendship'), 'Points'));
    if (v && Number.isFinite(points)) hearts[v.id] = Math.min(14, Math.max(0, Math.floor(points / 250)));
  }

  const byItemId = new Map(fish.map((f) => [f.itemId, f.id] as const));
  const fishCaught: string[] = [];
  let unknownFish = 0;
  for (const { key } of dictItems(child(player, 'fishCaught'))) {
    const id = byItemId.get(normalizeId(keyString(key)));
    if (id) fishCaught.push(id);
    else unknownFish++;
  }

  const recipeByName = new Map(recipes.map((r) => [r.name.toLowerCase(), r.id] as const));
  const recipesKnown = dictItems(child(player, 'cookingRecipes'))
    .map(({ key }) => recipeByName.get(keyString(key).toLowerCase()))
    .filter((x): x is string => !!x);
  // recipesCooked is keyed by item id
  const recipeIdByItem = new Map(recipes.map((r) => [r.itemId, r.id] as const));
  const recipesCooked: string[] = [];
  for (const { key } of dictItems(child(player, 'recipesCooked'))) {
    const rid = recipeIdByItem.get(normalizeId(keyString(key)));
    if (rid) recipesCooked.push(rid);
  }

  const museumIds = new Map(museum.map((m) => [m.itemId, m.id] as const));
  const museumDonated: string[] = [];
  for (const loc of Array.from(root.getElementsByTagName('GameLocation'))) {
    const type = loc.getAttribute('xsi:type') ?? loc.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type');
    if (type !== 'LibraryMuseum') continue;
    for (const { value } of dictItems(child(loc, 'museumPieces'))) {
      const id = museumIds.get(normalizeId((child(value, 'string')?.textContent ?? value?.textContent ?? '').trim()));
      if (id) museumDonated.push(id);
    }
  }

  const mail = new Set(Array.from(child(player, 'mailReceived')?.children ?? []).map((c) => (c.textContent ?? '').trim()));
  const flags: Partial<Record<ProgressFlag, boolean>> = {};
  if (mail.size) {
    flags.communityCenterComplete = mail.has('ccIsComplete');
    flags.jojaRoute = mail.has('JojaMember');
    flags.busRepaired = mail.has('ccVault') || mail.has('jojaVault');
    flags.islandAccess = mail.has('willyBoatFixed');
    flags.resortOpen = mail.has('Island_Resort');
    flags.movieTheater = mail.has('ccMovieTheater') || mail.has('ccMovieTheaterJoja');
    flags.beachBridge = mail.has('beachBridgeFixed') ? true : undefined;
    if (flags.beachBridge === undefined) delete flags.beachBridge;
  } else warnings.push('Mail flags not found; world progress left unchanged.');
  const rusty = text(player, 'hasRustyKey');
  if (rusty !== null) flags.sewersAccess = rusty === 'true';
  const skull = text(player, 'hasSkullKey');
  if (skull !== null) flags.skullKey = skull === 'true';

  return {
    gameVersion: text(root, 'gameVersion'),
    farmName: text(player, 'farmName'),
    playerName: text(player, 'name'),
    date,
    weather,
    farmType,
    fishingLevel,
    spouse,
    hearts,
    fishCaught,
    recipesKnown,
    recipesCooked,
    museumDonated,
    flags,
    unknownFish,
    warnings,
  };
}
