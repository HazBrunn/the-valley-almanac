/**
 * Typed access to the generated, versioned datasets plus lookup indexes.
 * The JSON is produced by `npm run data:build` (scripts/build-data.ts).
 */
import regionsJson from './generated/regions.json';
import placesJson from './generated/places.json';
import villagersJson from './generated/villagers.json';
import schedulesJson from './generated/schedules.json';
import fishAreasJson from './generated/fish-areas.json';
import fishJson from './generated/fish.json';
import festivalsJson from './generated/festivals.json';
import checkupsJson from './generated/checkups.json';
import extrasJson from './generated/calendar-extras.json';
import shopsJson from './generated/shops.json';
import cropsJson from './generated/crops.json';
import forageJson from './generated/forage.json';
import bundlesJson from './generated/bundles.json';
import museumJson from './generated/museum.json';
import recipesJson from './generated/recipes.json';
import universalJson from './generated/universal-gifts.json';
import metaJson from './generated/meta.json';
import type * as T from './types';

export const regions = regionsJson as T.Region[];
export const places = placesJson as T.Place[];
export const villagers = (villagersJson as T.Villager[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const schedules = schedulesJson as unknown as T.VillagerSchedule[];
export const fishAreas = fishAreasJson as T.FishAreaInfo[];
export const fish = (fishJson as T.Fish[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const festivals = festivalsJson as T.Festival[];
export const checkups = checkupsJson as T.Checkup[];
export const calendarExtras = extrasJson as T.CalendarExtras;
export const shops = shopsJson as T.Shop[];
export const crops = (cropsJson as T.Crop[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const forage = (forageJson as T.Forage[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const bundles = bundlesJson as T.Bundle[];
export const museum = (museumJson as T.MuseumItem[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const recipes = (recipesJson as T.Recipe[]).slice().sort((a, b) => a.name.localeCompare(b.name));
export const universalGifts = universalJson as T.UniversalGifts;
export const meta = metaJson as T.Meta;

const index = <X extends { id: string }>(xs: X[]) => new Map(xs.map((x) => [x.id, x] as const));
export const villagerById = index(villagers);
export const scheduleById = new Map(schedules.map((s) => [s.villagerId, s] as const));
export const fishById = index(fish);
export const fishAreaById = index(fishAreas);
export const placeById = index(places);
export const regionById = index(regions);
export const shopById = index(shops);
export const cropById = index(crops);
export const forageById = index(forage);
export const bundleById = index(bundles);
export const recipeById = index(recipes);
export const museumById = index(museum);
export const festivalById = index(festivals);

export function placeName(id: string | null | undefined): string {
  if (!id) return 'Unknown location';
  return placeById.get(id)?.name ?? id;
}

export function regionOfPlace(id: string | null | undefined): T.Region | undefined {
  if (!id) return undefined;
  const p = placeById.get(id);
  return p ? regionById.get(p.region) : undefined;
}

export type { T as DataTypes };
