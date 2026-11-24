/**
 * Crop planner maths (docs/GAME_RULES.md §8).
 *
 * - A seed planted on day D with G growth days is ready to harvest on day D + G.
 * - Crops die when a season starts that is not in their season list (the night after
 *   day 28), so the harvest must happen by day 28 of the last consecutive valid season.
 * - Greenhouse / Ginger Island farm: any season.
 * - Fertiliser / Agriculturist: the game reduces the growth phases by
 *   ceil(totalDays × speed) days, removing one day per phase in passes (max 3 passes),
 *   never shortening the first phase below 1 day (HoeDirt.applySpeedIncreases).
 *   Speed: Speed-Gro 10%, Deluxe Speed-Gro 25%, Hyper Speed-Gro 33%, Agriculturist +10%,
 *   irrigated paddy crops (Rice, Taro) +25%.
 */
import type { Crop } from '../data/types';
import { addDays, DAYS_PER_SEASON, SEASONS, type GameDate, type Season, seasonIndex, nextSeason } from './calendar';

export type Fertiliser = 'none' | 'speed-gro' | 'deluxe-speed-gro' | 'hyper-speed-gro';

export const FERTILISER_LABEL: Record<Fertiliser, string> = {
  none: 'No speed fertiliser',
  'speed-gro': 'Speed-Gro (10%)',
  'deluxe-speed-gro': 'Deluxe Speed-Gro (25%)',
  'hyper-speed-gro': 'Hyper Speed-Gro (33%)',
};

const FERT_SPEED: Record<Fertiliser, number> = { none: 0, 'speed-gro': 0.1, 'deluxe-speed-gro': 0.25, 'hyper-speed-gro': 0.33 };

export interface CropModifiers {
  fertiliser: Fertiliser;
  agriculturist: boolean;
  /** paddy crop planted next to water */
  irrigated: boolean;
  /** greenhouse or island farm — no season limit */
  protectedArea: boolean;
}

export const NO_MODIFIERS: CropModifiers = { fertiliser: 'none', agriculturist: false, irrigated: false, protectedArea: false };

export function speedFor(crop: Crop, mods: CropModifiers): number {
  let speed = FERT_SPEED[mods.fertiliser];
  if (mods.agriculturist) speed += 0.1;
  if (mods.irrigated && crop.paddy) speed += 0.25;
  return speed;
}

/** Effective growth days and whether the exact (per-phase) algorithm was used. */
export function effectiveGrowDays(crop: Crop, mods: CropModifiers): { days: number; exact: boolean } {
  const speed = speedFor(crop, mods);
  if (speed <= 0) return { days: crop.growDays, exact: true };
  // float32-like rounding guard: avoid 2.0000000001 → 3
  let toRemove = Math.ceil(Math.round(crop.growDays * speed * 1e6) / 1e6);
  if (!crop.phases) return { days: Math.max(1, crop.growDays - toRemove), exact: false };
  const phases = [...crop.phases];
  for (let tries = 0; toRemove > 0 && tries < 3; tries++) {
    for (let i = 0; i < phases.length; i++) {
      if (i > 0 || phases[i]! > 1) {
        phases[i]!--;
        toRemove--;
      }
      if (toRemove <= 0) break;
    }
  }
  return { days: phases.reduce((a, b) => a + Math.max(0, b), 0), exact: true };
}

/** The final day (as a date) the crop can stay alive after being planted on `plant`. */
export function seasonDeadline(crop: Crop, plant: GameDate): GameDate | null {
  if (!crop.seasons.includes(plant.season)) return null;
  let season: Season = plant.season;
  let year = plant.year;
  for (let i = 0; i < 4; i++) {
    const n = nextSeason(season);
    if (!crop.seasons.includes(n) || i === 3) break;
    if (n === 'spring') year++;
    season = n;
  }
  return { year, season, day: DAYS_PER_SEASON };
}

export interface CropPlan {
  crop: Crop;
  plant: GameDate;
  growDays: number;
  exact: boolean;
  valid: boolean;
  reason?: string;
  harvests: GameDate[];
  deadline: GameDate | null;
}

export function calculateCropPlan(crop: Crop, plant: GameDate, mods: CropModifiers = NO_MODIFIERS, maxHarvests = 40): CropPlan {
  const { days, exact } = effectiveGrowDays(crop, mods);
  const base = { crop, plant, growDays: days, exact };
  if (!mods.protectedArea && !crop.seasons.includes(plant.season)) {
    return { ...base, valid: false, reason: `${crop.name} cannot grow in ${plant.season}.`, harvests: [], deadline: null };
  }
  const deadline = mods.protectedArea ? null : seasonDeadline(crop, plant);
  const limitIndex = deadline ? dateIndex(deadline) : dateIndex(plant) + 112; // one year in protected areas
  const harvests: GameDate[] = [];
  let next = addDays(plant, days);
  if (dateIndex(next) > limitIndex) {
    return { ...base, valid: false, reason: `Not enough days left: it needs ${days} days but the season ends first.`, harvests: [], deadline };
  }
  while (dateIndex(next) <= limitIndex && harvests.length < maxHarvests) {
    harvests.push(next);
    if (!crop.regrowDays) break;
    next = addDays(next, crop.regrowDays);
  }
  return { ...base, valid: true, harvests, deadline };
}

function dateIndex(d: GameDate): number {
  return (d.year - 1) * 112 + seasonIndex(d.season) * 28 + d.day - 1;
}

/** Last day of `season` on which planting still yields a harvest (outdoors). */
export function lastSafePlantingDay(crop: Crop, season: Season, year: number, mods: CropModifiers = NO_MODIFIERS): number | null {
  if (!crop.seasons.includes(season)) return null;
  for (let day = DAYS_PER_SEASON; day >= 1; day--) {
    if (calculateCropPlan(crop, { year, season, day }, { ...mods, protectedArea: false }, 1).valid) return day;
  }
  return null;
}

export function cropsForSeason(crops: Crop[], season: Season): Crop[] {
  return crops.filter((c) => c.seasons.includes(season));
}

export const ALL_SEASONS = SEASONS;
