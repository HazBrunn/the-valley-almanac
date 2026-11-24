#!/usr/bin/env node
/**
 * Fetches raw wikitext for a fixed list of Stardew Valley Wiki pages into
 * data-sources/wiki/raw/. This is a one-off, polite snapshot (1 request every
 * 1.5 s, identifying user agent, ?action=raw so no HTML rendering load) used as
 * an input to the import pipeline. It is NOT run at app runtime.
 *
 * Wiki content is licensed CC BY-NC-SA 3.0 — see docs/DATA_SOURCES.md.
 *
 * Usage: node scripts/fetch-wiki.mjs [--force]
 */
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
/** curl is used (rather than Node fetch) because it is the plain HTTP client the wiki serves without an interactive challenge; we never attempt to solve or evade a challenge. */
async function get(url) {
  try {
    const { stdout } = await run('curl', ['-s', '-f', '-A', UA, url], { maxBuffer: 64 * 1024 * 1024 });
    return { ok: true, status: 200, text: async () => stdout };
  } catch (e) {
    return { ok: false, status: e.code ?? 'error', text: async () => '' };
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'data-sources/wiki/raw');
const force = process.argv.includes('--force');
const UA = 'ValleyAlmanac-DataImport/0.1 (personal non-commercial fan project)';

const villagers = JSON.parse(await readFile(join(root, 'data-sources/svd/villagers.json'), 'utf8')).map((v) => v.name);
const fish = JSON.parse(await readFile(join(root, 'data-sources/svd/fish.json'), 'utf8')).map((f) => f.name);
const other = [
  'Calendar', 'Festivals', 'Egg_Festival', 'Desert_Festival', 'Flower_Dance', 'Luau', 'Trout_Derby',
  'Dance_of_the_Moonlight_Jellies', 'Stardew_Valley_Fair', "Spirit's_Eve", 'Festival_of_Ice', 'SquidFest',
  'Night_Market', 'Feast_of_the_Winter_Star', 'Traveling_Cart', 'Bookseller', 'The_Queen_of_Sauce', 'Weather',
  "Harvey's_Clinic", "Pierre's_General_Store", 'Blacksmith', "Carpenter's_Shop", "Marnie's_Ranch", 'Fish_Shop',
  'The_Stardrop_Saloon', 'JojaMart', 'Museum', "Wizard's_Tower", "Adventurer's_Guild", 'Oasis', 'Casino',
  'Ice_Cream_Stand', 'Foraging', 'Salmonberry', 'Blackberry', 'Fishing', 'Crab_Pot', 'Television',
  'Fortune_Teller', 'Green_Rain', 'Ginger_Island', 'Desert_Trader', 'Island_Trader', 'Krobus', 'Crops',
  'Friendship', 'Modding:Schedule_data', 'Legendary_Fish', 'Fish_Pond', 'Rain_Totem', 'Days_of_the_Week',
  'Seasons', 'Spring', 'Summer', 'Fall', 'Winter', 'Fertilizer', 'Speed-Gro', 'Greenhouse', 'Bundles',
  'Remixed_Bundles', 'Sewers', 'Railroad', 'Secret_Woods', 'Bus_Stop', 'Quarry', 'The_Desert',
  "Willy's_Boat", 'Movie_Theater', 'Stardrop_Saloon', 'Cooking', 'Version_History', 'Fish', 'Farm_Maps', 'Artifacts', 'Minerals', 'Shops', 'Villagers',
];

const pages = [...new Set([...villagers, ...fish, ...other].map((p) => p.replace(/ /g, '_')))];
await mkdir(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const manifest = [];
for (const page of pages) {
  const file = join(outDir, `${page.replace(/[:/]/g, '__')}.wiki`);
  if (!force) {
    try { await access(file); manifest.push({ page, file: file.slice(root.length + 1), cached: true }); continue; } catch { /* fetch */ }
  }
  const url = `https://stardewvalleywiki.com/${encodeURIComponent(page).replace(/%3A/g, ':')}?action=raw`;
  const res = await get(url);
  if (!res.ok) { console.warn(`! ${res.status} ${page}`); manifest.push({ page, status: res.status }); await sleep(1500); continue; }
  let text = await res.text();
  const redirect = /^#REDIRECT\s*\[\[([^\]#|]+)/i.exec(text);
  if (redirect) {
    await sleep(1500);
    const target = redirect[1].trim().replace(/ /g, '_');
    const r2 = await get(`https://stardewvalleywiki.com/${encodeURIComponent(target).replace(/%3A/g, ':')}?action=raw`);
    if (r2.ok) text = await r2.text();
  }
  await writeFile(file, text);
  manifest.push({ page, url, retrieved: new Date().toISOString(), bytes: text.length, file: file.slice(root.length + 1) });
  console.log(`✓ ${page} (${text.length})`);
  await sleep(1500);
}
await writeFile(join(root, 'data-sources/wiki/manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`done: ${manifest.length} pages`);
