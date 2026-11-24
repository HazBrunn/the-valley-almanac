/** Offline unified search across all entity types, with aliases and light typo tolerance. */
import { villagers, fish, crops, forage, bundles, recipes, museum, shops, festivals, places, fishAreas } from '../data';
import { SEASON_LABEL } from './calendar';

export type EntityType = 'villager' | 'fish' | 'crop' | 'forage' | 'bundle' | 'recipe' | 'museum' | 'shop' | 'festival' | 'place' | 'fishing-spot';

export const ENTITY_LABEL: Record<EntityType, string> = {
  villager: 'Villager',
  fish: 'Fish',
  crop: 'Crop',
  forage: 'Forage',
  bundle: 'Bundle',
  recipe: 'Recipe',
  museum: 'Museum',
  shop: 'Shop',
  festival: 'Festival',
  place: 'Place',
  'fishing-spot': 'Fishing spot',
};

export interface SearchEntry {
  type: EntityType;
  id: string;
  title: string;
  snippet: string;
  href: string;
  keywords: string[];
  spoiler?: boolean;
}

const ALIASES: Record<string, string[]> = {
  sebastian: ['seb', 'sebby'],
  abigail: ['abby'],
  elliott: ['elliot'],
  'community-center': ['cc', 'community centre'],
  saloon: ['stardrop', 'gus bar', 'pub'],
  'traveling-cart': ['travelling cart', 'cart', 'merchant'],
  'mountain-lake': ['lake'],
  'fish-shop': ['willy shop', 'bait'],
  jojamart: ['joja'],
  pierres: ['pierre', 'seeds shop', 'general store'],
};

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

let cache: SearchEntry[] | null = null;

export function searchIndex(): SearchEntry[] {
  if (cache) return cache;
  const e: SearchEntry[] = [];
  for (const v of villagers)
    e.push({
      type: 'villager',
      id: v.id,
      title: v.name,
      snippet: `Birthday ${SEASON_LABEL[v.birthday.season]} ${v.birthday.day} · ${v.address}`,
      href: `/people/${v.id}`,
      keywords: [v.name, v.occupation, ...(ALIASES[v.id] ?? [])],
      spoiler: v.availability?.spoiler,
    });
  for (const f of fish)
    e.push({
      type: 'fish',
      id: f.id,
      title: f.name,
      snippet: `${f.method === 'crab-pot' ? 'Crab pot' : f.legendary ? 'Legendary fish' : 'Fish'} · ${f.sellPrice}g`,
      href: `/fish/${f.id}`,
      keywords: [f.name, f.category, ...(f.legendary ? ['legendary'] : [])],
    });
  for (const c of crops)
    e.push({ type: 'crop', id: c.id, title: c.name, snippet: `${c.seasons.map((s) => SEASON_LABEL[s]).join(', ')} · ${c.growDays} days`, href: `/crops?crop=${c.id}`, keywords: [c.name, c.seedName, c.category] });
  for (const f of forage)
    e.push({ type: 'forage', id: f.id, title: f.name, snippet: f.locations.slice(0, 80), href: `/forage#${f.id}`, keywords: [f.name] });
  for (const b of bundles)
    e.push({ type: 'bundle', id: b.id, title: b.name, snippet: `${b.roomName}${b.remix ? ' · remixed' : ''}`, href: `/journal/bundles#${b.id}`, keywords: [b.name, b.roomName, ...b.items.map((i) => i.name)] });
  for (const r of recipes)
    e.push({ type: 'recipe', id: r.id, title: r.name, snippet: r.ingredients.map((i) => i.name).join(', ').slice(0, 80), href: `/recipes#${r.id}`, keywords: [r.name] });
  for (const m of museum)
    e.push({ type: 'museum', id: m.id, title: m.name, snippet: m.kind === 'artifact' ? 'Artifact' : 'Mineral', href: `/journal/museum#${m.id}`, keywords: [m.name, m.kind] });
  for (const s of shops) e.push({ type: 'shop', id: s.id, title: s.name, snippet: s.sells, href: `/shops#${s.id}`, keywords: [s.name, ...(ALIASES[s.id] ?? [])] });
  for (const f of festivals)
    e.push({ type: 'festival', id: f.id, title: f.name, snippet: `${SEASON_LABEL[f.season]} ${f.startDay}${f.endDay > f.startDay ? `–${f.endDay}` : ''}`, href: `/calendar?season=${f.season}&day=${f.startDay}`, keywords: [f.name, 'festival'] });
  for (const p of places) e.push({ type: 'place', id: p.id, title: p.name, snippet: 'Location', href: `/map?place=${p.id}`, keywords: [p.name, ...(ALIASES[p.id] ?? [])] });
  for (const a of fishAreas) e.push({ type: 'fishing-spot', id: a.id, title: a.name, snippet: a.description, href: `/fish/locations?area=${a.id}`, keywords: [a.name, ...(ALIASES[a.id] ?? [])] });
  cache = e.map((x) => ({ ...x, keywords: x.keywords.filter((k): k is string => typeof k === 'string' && k.length > 0).map(norm) }));
  return cache;
}

function lev1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function search(query: string, opts: { limit?: number; spoilers?: boolean; types?: EntityType[] } = {}): SearchEntry[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ');
  const scored: { e: SearchEntry; score: number }[] = [];
  for (const e of searchIndex()) {
    if (opts.types && !opts.types.includes(e.type)) continue;
    if (e.spoiler && !opts.spoilers) continue;
    let score = 0;
    const title = norm(e.title);
    if (title === q) score = 100;
    else if (title.startsWith(q)) score = 80;
    else if (e.keywords.some((k) => k === q)) score = 75;
    else if (title.split(' ').some((w) => w.startsWith(q))) score = 65;
    else if (e.keywords.some((k) => k.includes(q))) score = 45;
    else if (words.every((w) => e.keywords.some((k) => k.split(' ').some((kw) => kw.startsWith(w) || (w.length >= 4 && lev1(w, kw)))))) score = 35;
    if (score > 0) {
      if (e.type === 'villager' || e.type === 'fish') score += 3;
      scored.push({ e, score });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title))
    .slice(0, opts.limit ?? 30)
    .map((s) => s.e);
}
