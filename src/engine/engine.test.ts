/**
 * Golden tests for the shared rules engine. Every expectation below is cross-checked
 * against the Stardew Valley Wiki snapshot (data-sources/wiki/raw) — see
 * docs/GAME_RULES.md for the cited facts.
 */
import { describe, expect, it } from 'vitest';
import { addDays, weekdayOf, fromDayIndex, toDayIndex, formatDate, type GameDate } from './calendar';
import { parseClock, formatTime, inWindow, fromHhmm } from './time';
import { evaluate, type Condition } from './conditions';
import { fixedWeatherFor, isRaining } from './weather';
import type { GameContext } from './context';
import { resolveFishAvailability, nextAvailability, lastDayThisSeason } from './fish';
import { resolveVillagerSchedule, locateAt, summariseLocation } from './schedule';
import { resolveShopAvailability } from './shops';
import { calculateCropPlan, effectiveGrowDays, lastSafePlantingDay, NO_MODIFIERS } from './crops';
import { qosSundayRecipe, resolveCalendarEvents } from './events';
import { search } from './search';
import { parseBackup, makeBackup, newProfile, ImportError } from './profile';
import { resolveDailyOpportunities } from './opportunities';
import { fishById, shopById, cropById } from '../data';
import type { PlayerProgress } from './progress';

const P0: PlayerProgress = { flags: {}, hearts: {} };
const ctx = (date: Partial<GameDate> & { season: GameDate['season']; day: number }, over: Partial<GameContext> = {}): GameContext => ({
  date: { year: 1, ...date },
  weather: 'sun',
  islandWeather: 'unknown',
  time: null,
  progress: P0,
  ...over,
});
const fishFor = (id: string) => {
  const f = fishById.get(id);
  if (!f) throw new Error(`no fish ${id}`);
  return f;
};

describe('calendar', () => {
  it('rolls over seasons and years', () => {
    expect(addDays({ year: 1, season: 'spring', day: 28 }, 1)).toEqual({ year: 1, season: 'summer', day: 1 });
    expect(addDays({ year: 1, season: 'winter', day: 28 }, 1)).toEqual({ year: 2, season: 'spring', day: 1 });
    expect(addDays({ year: 2, season: 'spring', day: 1 }, -1)).toEqual({ year: 1, season: 'winter', day: 28 });
    expect(fromDayIndex(toDayIndex({ year: 3, season: 'fall', day: 17 }))).toEqual({ year: 3, season: 'fall', day: 17 });
  });
  it('derives weekdays (day 1 is Monday every season)', () => {
    expect(weekdayOf({ day: 1 })).toBe('monday');
    expect(weekdayOf({ day: 5 })).toBe('friday');
    expect(weekdayOf({ day: 16 })).toBe('tuesday'); // Stardew Valley Fair is "Tuesday, the 16th of Fall"
    expect(weekdayOf({ day: 28 })).toBe('sunday');
    expect(formatDate({ year: 2, season: 'spring', day: 5 }, { weekday: true })).toBe('Friday, Spring 5, Year 2');
  });
});

describe('game clock', () => {
  it('parses and formats noon, midnight and after-midnight times on the same game day', () => {
    expect(parseClock('12pm')).toBe(720);
    expect(parseClock('12am')).toBe(1440);
    expect(parseClock('1:40 AM')).toBe(1540);
    expect(parseClock('2am')).toBe(1560);
    expect(parseClock('6:10am')).toBe(370);
    expect(formatTime(1440)).toBe('12:00 AM');
    expect(formatTime(1470)).toBe('12:30 AM');
    expect(formatTime(720)).toBe('12:00 PM');
    expect(fromHhmm(2550)).toBe(1550);
  });
  it('uses half-open intervals', () => {
    const w = { start: 960, end: 1560 };
    expect(inWindow(950, w)).toBe(false);
    expect(inWindow(960, w)).toBe(true);
    expect(inWindow(1550, w)).toBe(true);
    expect(inWindow(1560, w)).toBe(false);
  });
});

describe('conditions (three-valued)', () => {
  it('returns unknown for missing inputs, never a guess', () => {
    const c: Condition = { kind: 'all', of: [{ kind: 'season', in: ['spring'] }, { kind: 'raining', value: true }] };
    const base = { date: { year: 1, season: 'spring' as const, day: 5 }, time: null, progress: P0 };
    expect(evaluate(c, { ...base, weather: 'unknown' }).value).toBe('unknown');
    expect(evaluate(c, { ...base, weather: 'storm' }).value).toBe(true);
    expect(evaluate(c, { ...base, weather: 'snow' }).value).toBe(false);
    expect(evaluate({ kind: 'any', of: [{ kind: 'season', in: ['summer'] }, { kind: 'random', note: 'x' }] }, { ...base, weather: 'sun' }).value).toBe('unknown');
  });
  it('treats storm and green rain as rain, snow and wind as dry', () => {
    expect(isRaining('storm')).toBe(true);
    expect(isRaining('green-rain')).toBe(true);
    expect(isRaining('snow')).toBe(false);
    expect(isRaining('wind')).toBe(false);
    expect(isRaining('unknown')).toBe(null);
  });
  it('knows fixed weather days', () => {
    expect(fixedWeatherFor({ year: 1, season: 'spring', day: 3 }, false)?.weather).toBe('rain');
    expect(fixedWeatherFor({ year: 3, season: 'summer', day: 13 }, false)?.weather).toBe('storm');
    expect(fixedWeatherFor({ year: 2, season: 'spring', day: 13 }, true)?.weather).toBe('sun');
    expect(fixedWeatherFor({ year: 2, season: 'spring', day: 9 }, false)).toBeNull();
  });
});

describe('fish availability', () => {
  it('Catfish: river in spring rain; Secret Woods also in summer rain (location-specific season)', () => {
    const catfish = fishFor('catfish');
    expect(resolveFishAvailability(catfish, ctx({ season: 'spring', day: 5 }, { weather: 'rain', time: 840 })).status).toBe('now');
    expect(resolveFishAvailability(catfish, ctx({ season: 'spring', day: 5 }, { weather: 'sun', time: 840 })).status).toBe('unavailable');
    const summerRain = ctx({ season: 'summer', day: 5 }, { weather: 'rain', time: 840 });
    expect(resolveFishAvailability(catfish, summerRain, { area: 'river-town' }).status).toBe('unavailable');
    expect(resolveFishAvailability(catfish, { ...summerRain, progress: { flags: { secretWoods: true }, hearts: {} } }, { area: 'secret-woods' }).status).toBe('now');
    // Secret Woods access unknown → conditional, not a false yes
    expect(resolveFishAvailability(catfish, summerRain, { area: 'secret-woods' }).status).toBe('conditional');
    // 6am–12am window: midnight is outside
    expect(resolveFishAvailability(catfish, ctx({ season: 'fall', day: 2 }, { weather: 'rain', time: 1440 })).status).toBe('earlier');
  });
  it('unknown weather never yields a definite answer for weather-dependent fish', () => {
    const r = resolveFishAvailability(fishFor('eel'), ctx({ season: 'spring', day: 9 }, { weather: 'unknown', time: 1000 }));
    expect(r.status).toBe('conditional');
    expect(r.unknowns.join(' ')).toMatch(/rain/i);
  });
  it('Eel: ocean 4pm–2am in rain (after-midnight window)', () => {
    const eel = fishFor('eel');
    const rain = (time: number) => ctx({ season: 'spring', day: 9 }, { weather: 'rain', time });
    expect(resolveFishAvailability(eel, rain(950)).status).toBe('later');
    expect(resolveFishAvailability(eel, rain(960)).status).toBe('now');
    expect(resolveFishAvailability(eel, rain(1550)).status).toBe('now');
    expect(resolveFishAvailability(eel, ctx({ season: 'summer', day: 9 }, { weather: 'rain', time: 1000 })).status).toBe('unavailable');
  });
  it('Shad: river 9am–2am, rain, spring–fall', () => {
    const shad = fishFor('shad');
    expect(resolveFishAvailability(shad, ctx({ season: 'summer', day: 2 }, { weather: 'storm', time: 540 })).status).toBe('now');
    expect(resolveFishAvailability(shad, ctx({ season: 'summer', day: 2 }, { weather: 'storm', time: 530 })).status).toBe('later');
    expect(resolveFishAvailability(shad, ctx({ season: 'winter', day: 2 }, { weather: 'rain', time: 600 })).status).toBe('unavailable');
  });
  it('Albacore: disjoint windows 6–11am and 6pm–2am', () => {
    const alb = fishFor('albacore');
    const f = (time: number) => resolveFishAvailability(alb, ctx({ season: 'fall', day: 3 }, { time })).status;
    expect(f(370)).toBe('now');
    expect(f(720)).toBe('later');
    expect(f(1080)).toBe('now');
  });
  it('Sunfish needs no rain; wind counts as dry', () => {
    expect(resolveFishAvailability(fishFor('sunfish'), ctx({ season: 'spring', day: 3 }, { weather: 'wind', time: 600 })).status).toBe('now');
    expect(resolveFishAvailability(fishFor('sunfish'), ctx({ season: 'spring', day: 3 }, { weather: 'rain', time: 600 })).status).toBe('unavailable');
  });
  it('Legend: spring rain at the mountain lake with Fishing level 10', () => {
    const legend = fishFor('legend');
    const base = ctx({ season: 'spring', day: 4 }, { weather: 'rain', time: 700 });
    expect(resolveFishAvailability(legend, base).status).toBe('conditional');
    expect(resolveFishAvailability(legend, { ...base, progress: { ...P0, fishingLevel: 9 } }).status).toBe('unavailable');
    expect(resolveFishAvailability(legend, { ...base, progress: { ...P0, fishingLevel: 10 } }).status).toBe('now');
    const next = nextAvailability(legend, ctx({ season: 'summer', day: 4 }, { progress: { ...P0, fishingLevel: 10 } }));
    expect(next?.date).toEqual({ year: 2, season: 'spring', day: 1 });
    expect(next?.needs).toContain('rain');
  });
  it('Rainbow Trout: any weather during the Trout Derby only', () => {
    const t = fishFor('rainbow-trout');
    expect(resolveFishAvailability(t, ctx({ season: 'summer', day: 20 }, { weather: 'rain', time: 1300 })).status).toBe('now');
    expect(resolveFishAvailability(t, ctx({ season: 'summer', day: 22 }, { weather: 'rain', time: 1300 })).status).toBe('unavailable');
  });
  it('Night Market submarine fish only Winter 15–17 evenings', () => {
    const b = fishFor('blobfish');
    expect(resolveFishAvailability(b, ctx({ season: 'winter', day: 16 }, { time: 1100 })).status).toBe('now');
    expect(resolveFishAvailability(b, ctx({ season: 'winter', day: 16 }, { time: 900 })).status).toBe('later');
    expect(resolveFishAvailability(b, ctx({ season: 'winter', day: 18 }, { time: 1100 })).status).toBe('unavailable');
  });
  it('last-chance detection for seasonal fish', () => {
    expect(lastDayThisSeason(fishFor('eel'), ctx({ season: 'spring', day: 20 }))).toEqual({ year: 1, season: 'spring', day: 28 });
    // Sardine continues spring → … no, Sardine is spring/fall/winter; spring→summer gap
    expect(lastDayThisSeason(fishFor('bream'), ctx({ season: 'spring', day: 20 }))).toBeNull();
  });
});

describe('villager schedules', () => {
  it('Sebastian has two random rainy-day routines (beach pier or home/Saloon)', () => {
    const res = resolveVillagerSchedule('sebastian', ctx({ year: 2, season: 'spring', day: 5 }, { weather: 'rain' }));
    expect(res?.kind).toBe('schedule');
    if (res?.kind !== 'schedule') return;
    expect(res.branches).toHaveLength(2);
    expect(res.branches.every((b) => b.certainty === 'random')).toBe(true);
    const at2pm = res.branches.map((b) => locateAt(b.block, 840, 'carpenter').place);
    expect(at2pm).toContain('pier');
    expect(at2pm).toContain('carpenter');
    expect(summariseLocation(res, 840)).toMatch(/Either/);
  });
  it('Sebastian plays pool at the Saloon on sunny spring Fridays', () => {
    const res = resolveVillagerSchedule('sebastian', ctx({ year: 2, season: 'spring', day: 5 }, { weather: 'sun' }));
    if (res?.kind !== 'schedule') throw new Error('expected schedule');
    expect(res.branches).toHaveLength(1);
    expect(res.branches[0]!.block.label).toBe('Friday');
    expect(locateAt(res.branches[0]!.block, 1080, 'carpenter')).toMatchObject({ status: 'at', place: 'saloon' });
    const travelling = locateAt(res.branches[0]!.block, 960, 'carpenter');
    expect(travelling.status).toBe('travelling');
    expect(travelling.place).toBe('saloon');
  });
  it('unknown weather yields rain and dry branches rather than a guess', () => {
    const res = resolveVillagerSchedule('sebastian', ctx({ year: 2, season: 'spring', day: 5 }, { weather: 'unknown' }));
    if (res?.kind !== 'schedule') throw new Error('expected schedule');
    expect(res.branches.length).toBeGreaterThanOrEqual(3);
    expect(res.branches.some((b) => b.certainty === 'definite' && b.block.label === 'Friday')).toBe(true);
  });
  it('friendship-dependent date schedules branch until hearts are entered', () => {
    const unknown = resolveVillagerSchedule('sebastian', ctx({ year: 1, season: 'spring', day: 11 }));
    if (unknown?.kind !== 'schedule') throw new Error();
    expect(unknown.branches.filter((b) => b.certainty === 'possible').length).toBeGreaterThanOrEqual(2);
    const known = resolveVillagerSchedule('sebastian', ctx({ year: 1, season: 'spring', day: 11 }, { progress: { flags: {}, hearts: { sebastian: 8 } } }));
    if (known?.kind !== 'schedule') throw new Error();
    expect(known.branches).toHaveLength(1);
    expect(known.branches[0]!.block.label).toMatch(/at least 6 hearts/);
  });
  it('railroad schedule only after the Summer 3, Year 1 earthquake', () => {
    // Spring 4 is a Thursday; in Year 1 the railroad is closed so the regular schedule applies
    const y1 = resolveVillagerSchedule('sebastian', ctx({ year: 1, season: 'spring', day: 4 }));
    const y2 = resolveVillagerSchedule('sebastian', ctx({ year: 2, season: 'spring', day: 4 }));
    if (y1?.kind !== 'schedule' || y2?.kind !== 'schedule') throw new Error();
    expect(y1.branches[0]!.block.label).toBe('Regular Schedule');
    expect(y2.branches[0]!.block.label).toMatch(/Thursday/);
  });
  it('festival days override schedules; Kent is absent in Year 1', () => {
    expect(resolveVillagerSchedule('abigail', ctx({ season: 'spring', day: 13 }))?.kind).toBe('festival');
    expect(resolveVillagerSchedule('kent', ctx({ season: 'summer', day: 2 }))?.kind).toBe('absent');
    expect(resolveVillagerSchedule('kent', ctx({ year: 2, season: 'summer', day: 2 }))?.kind).toBe('schedule');
    expect(resolveVillagerSchedule('dwarf', ctx({ season: 'summer', day: 2 }))?.kind).toBe('stationary');
  });
  it('clinic check-ups are date-specific schedules (Sebastian, Summer 4)', () => {
    const res = resolveVillagerSchedule('sebastian', ctx({ year: 2, season: 'summer', day: 4 }));
    if (res?.kind !== 'schedule') throw new Error();
    expect(res.branches[0]!.block.label).toBe('Summer 4');
    expect(locateAt(res.branches[0]!.block, 750, 'carpenter').place).toBe('clinic');
    expect(res.notes.join(' ')).toMatch(/check-up/);
  });
});

describe('shops', () => {
  it("Pierre's closes Wednesdays until the Community Center is restored", () => {
    const pierre = shopById.get('pierres')!;
    const wed = ctx({ season: 'spring', day: 3 }, { time: 600 });
    expect(resolveShopAvailability(pierre, wed).status).toBe('conditional');
    expect(resolveShopAvailability(pierre, { ...wed, progress: { flags: { communityCenterComplete: false }, hearts: {} } }).status).toBe('closed-today');
    expect(resolveShopAvailability(pierre, { ...wed, progress: { flags: { communityCenterComplete: true }, hearts: {} } }).status).toBe('open');
  });
  it("Willy's shop: no sales on non-rainy Saturdays", () => {
    const willy = shopById.get('fish-shop')!;
    expect(resolveShopAvailability(willy, ctx({ season: 'spring', day: 6 }, { weather: 'sun', time: 600 })).status).toBe('closed-today');
    expect(resolveShopAvailability(willy, ctx({ season: 'spring', day: 6 }, { weather: 'rain', time: 600 })).status).toBe('open');
    expect(resolveShopAvailability(willy, ctx({ season: 'spring', day: 6 }, { weather: 'unknown', time: 600 })).status).toBe('conditional');
  });
  it('opening boundaries and festival closures', () => {
    const saloon = shopById.get('saloon')!;
    expect(resolveShopAvailability(saloon, ctx({ season: 'spring', day: 2 }, { time: 710 })).status).toBe('opens-later');
    expect(resolveShopAvailability(saloon, ctx({ season: 'spring', day: 2 }, { time: 720 })).status).toBe('open');
    expect(resolveShopAvailability(saloon, ctx({ season: 'spring', day: 2 }, { time: 1440 })).status).toBe('closed-now');
    expect(resolveShopAvailability(saloon, ctx({ season: 'spring', day: 13 }, { time: 800 })).status).toBe('closed-today');
  });
  it('Traveling Cart: Fridays & Sundays, plus Night Market evenings', () => {
    const cart = shopById.get('traveling-cart')!;
    expect(resolveShopAvailability(cart, ctx({ season: 'spring', day: 5 })).status).toBe('open');
    expect(resolveShopAvailability(cart, ctx({ season: 'spring', day: 6 })).status).toBe('closed-today');
    const nm = resolveShopAvailability(cart, ctx({ season: 'winter', day: 16 }, { time: 1000 }));
    expect(nm.status).toBe('opens-later');
    expect(nm.hours).toEqual({ start: 1020, end: 1560 });
  });
});

describe('crops', () => {
  const parsnip = cropById.get('parsnip')!;
  const strawberry = cropById.get('strawberry')!;
  it('parsnip: 4 days; last safe outdoor planting day is Spring 24', () => {
    expect(parsnip.growDays).toBe(4);
    expect(lastSafePlantingDay(parsnip, 'spring', 1)).toBe(24);
    expect(calculateCropPlan(parsnip, { year: 1, season: 'spring', day: 25 }).valid).toBe(false);
    expect(calculateCropPlan(parsnip, { year: 1, season: 'summer', day: 1 }).valid).toBe(false);
    expect(calculateCropPlan(parsnip, { year: 1, season: 'summer', day: 1 }, { ...NO_MODIFIERS, protectedArea: true }).valid).toBe(true);
  });
  it('strawberry regrows every 4 days after 8 days', () => {
    const plan = calculateCropPlan(strawberry, { year: 1, season: 'spring', day: 1 });
    expect(plan.harvests.map((h) => h.day)).toEqual([9, 13, 17, 21, 25]);
  });
  it('speed fertiliser removes ceil(total × speed) days', () => {
    expect(effectiveGrowDays(parsnip, { ...NO_MODIFIERS, fertiliser: 'speed-gro' }).days).toBe(3);
    expect(effectiveGrowDays(parsnip, { ...NO_MODIFIERS, fertiliser: 'hyper-speed-gro', agriculturist: true }).days).toBe(2);
  });
  it('multi-season crops survive the season change', () => {
    const corn = cropById.get('corn')!;
    expect(corn.seasons).toEqual(['summer', 'fall']);
    const plan = calculateCropPlan(corn, { year: 1, season: 'summer', day: 1 });
    expect(plan.deadline).toEqual({ year: 1, season: 'fall', day: 28 });
    expect(plan.harvests.length).toBeGreaterThan(5);
  });
});

describe('calendar events and TV', () => {
  it('Queen of Sauce follows the 2-year Sunday cycle', () => {
    expect(qosSundayRecipe({ year: 1, season: 'spring', day: 7 })?.name).toBe('Stir Fry');
    expect(qosSundayRecipe({ year: 3, season: 'spring', day: 7 })?.name).toBe('Stir Fry');
    expect(qosSundayRecipe({ year: 2, season: 'spring', day: 7 })?.name).toBe('Pizza');
    expect(qosSundayRecipe({ year: 1, season: 'spring', day: 8 })).toBeUndefined();
  });
  it('lists birthdays, festivals, the cart and berry windows', () => {
    const egg = resolveCalendarEvents({ year: 1, season: 'spring', day: 13 }, P0).map((e) => e.id);
    expect(egg).toContain('festival-egg-festival');
    expect(resolveCalendarEvents({ year: 1, season: 'fall', day: 13 }, P0).map((e) => e.id)).toContain('birthday-abigail');
    expect(resolveCalendarEvents({ year: 1, season: 'winter', day: 10 }, P0).map((e) => e.id)).toContain('birthday-sebastian');
    expect(resolveCalendarEvents({ year: 1, season: 'spring', day: 10 }, P0).map((e) => e.id)).toContain('birthday-vincent');
    expect(resolveCalendarEvents({ year: 1, season: 'spring', day: 16 }, P0).map((e) => e.id)).toContain('berry-salmonberry');
    expect(resolveCalendarEvents({ year: 1, season: 'fall', day: 12 }, P0).map((e) => e.id)).not.toContain('berry-blackberry');
    const bookseller = resolveCalendarEvents({ year: 1, season: 'spring', day: 11 }, P0).find((e) => e.id === 'bookseller');
    expect(bookseller?.certainty).toBe('possible');
  });
});

describe('search', () => {
  it('handles aliases, prefixes and small typos', () => {
    expect(search('seb')[0]?.id).toBe('sebastian');
    expect(search('catfsh')[0]?.id).toBe('catfish');
    expect(search('salmonberry').some((r) => r.type === 'forage')).toBe(true);
    expect(search('cc').some((r) => r.id === 'community-center')).toBe(true);
  });
});

describe('profiles and backups', () => {
  it('round-trips a backup and rejects malformed input', () => {
    const p = newProfile('a', 'Willow Farm');
    p.collections.fishCaught.catfish = true;
    p.progress.hearts.sebastian = 6;
    const back = parseBackup(JSON.stringify(makeBackup([p])));
    expect(back[0]!.farmName).toBe('Willow Farm');
    expect(back[0]!.collections.fishCaught.catfish).toBe(true);
    expect(back[0]!.progress.hearts.sebastian).toBe(6);
    expect(() => parseBackup('nope')).toThrow(ImportError);
    expect(() => parseBackup(JSON.stringify({ app: 'x', profiles: [] }))).toThrow(ImportError);
    const evil = parseBackup(JSON.stringify({ app: 'the-valley-almanac', profiles: [{ farmName: '<img src=x>'.repeat(50), progress: { hearts: { sebastian: 999 } }, day: { date: { year: 1, season: 'monsoon', day: 99 } } }] }));
    expect(evil[0]!.farmName.length).toBeLessThanOrEqual(60);
    expect(evil[0]!.progress.hearts.sebastian).toBeUndefined();
    expect(evil[0]!.day.date).toEqual({ year: 1, season: 'spring', day: 1 });
  });
});

describe('daily opportunities', () => {
  it('surfaces rain-only fish and a watched fish on a rainy spring day', () => {
    const p = newProfile('t');
    p.watchlist.push({ id: 'w1', kind: 'fish', ref: 'eel', title: 'Eel', createdAt: { year: 1, season: 'spring', day: 1 } });
    const c = ctx({ year: 2, season: 'spring', day: 5 }, { weather: 'rain', time: 840 });
    const digest = resolveDailyOpportunities(c, p);
    expect(digest.weatherFish.map((f) => f.title)).toEqual(expect.arrayContaining(['Catfish', 'Eel', 'Shad']));
    expect(digest.personal.find((o) => o.title === 'Eel')?.label).toBe('Later today');
    expect(digest.todayEvents.map((e) => e.id)).toContain('cart');
    expect(digest.upcoming.some((u) => u.event.id === 'birthday-vincent')).toBe(true);
  });
  it('caught fish drop from the watchlist digest but stay as weather fish (de-emphasised)', () => {
    const p = newProfile('t');
    p.collections.fishCaught.eel = true;
    p.watchlist.push({ id: 'w1', kind: 'fish', ref: 'eel', title: 'Eel', createdAt: { year: 1, season: 'spring', day: 1 } });
    const digest = resolveDailyOpportunities(ctx({ season: 'spring', day: 9 }, { weather: 'rain', time: 840 }), p);
    expect(digest.personal.some((o) => o.title === 'Eel')).toBe(false);
    expect(digest.weatherFish.find((f) => f.title === 'Eel')?.weight).toBeLessThan(digest.weatherFish.find((f) => f.title === 'Catfish')!.weight);
  });
});
