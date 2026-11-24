import { describe, expect, it } from 'vitest';
import { parseSaveXml } from './saveImport';
import { loadAll, saveProfile, deleteProfile, saveActive } from '../state/db';
import { newProfile } from './profile';
import { parseLabel } from '../../scripts/lib/schedules';
import fixture from '../test/fixtures/synthetic-save.xml?raw';
import { evaluate } from './conditions';


describe('save import (synthetic fixture)', () => {
  it('extracts date, weather, progress and collections without guessing', () => {
    const s = parseSaveXml(fixture);
    expect(s.date).toEqual({ year: 3, season: 'fall', day: 13 });
    expect(s.weather).toBe('rain');
    expect(s.farmType).toBe('riverland');
    expect(s.fishingLevel).toBe(6);
    expect(s.spouse).toBe('sebastian');
    expect(s.hearts).toEqual({ sebastian: 10, abigail: 4 });
    expect(s.fishCaught.sort()).toEqual(['catfish', 'eel']);
    expect(s.unknownFish).toBe(1);
    expect(s.recipesKnown.sort()).toEqual(['fried-egg', 'sashimi']);
    expect(s.recipesCooked).toEqual(['fried-egg']);
    expect(s.museumDonated.sort()).toEqual(['artifact-dwarf-scroll-i', 'mineral-quartz']);
    expect(s.flags).toMatchObject({ busRepaired: true, islandAccess: true, resortOpen: true, communityCenterComplete: false, sewersAccess: true, skullKey: false });
  });
  it('rejects non-save files clearly', () => {
    expect(() => parseSaveXml('not xml at all <')).toThrow(/not valid XML/);
    expect(() => parseSaveXml('<Farmer><name>x</name></Farmer>')).toThrow(/SaveGameInfo/);
    expect(() => parseSaveXml('<html></html>')).toThrow(/doesn’t look like/);
  });
});

describe('IndexedDB persistence', () => {
  it('stores profiles independently and survives reload', async () => {
    const a = newProfile('farm-a', 'Farm A');
    const b = newProfile('farm-b', 'Farm B');
    a.collections.fishCaught.eel = true;
    b.day.date = { year: 4, season: 'winter', day: 9 };
    await saveProfile(a);
    await saveProfile(b);
    await saveActive('farm-b');
    const loaded = await loadAll();
    expect(loaded.persistent).toBe(true);
    expect(loaded.active).toBe('farm-b');
    const la = loaded.profiles.find((p) => p.id === 'farm-a')!;
    const lb = loaded.profiles.find((p) => p.id === 'farm-b')!;
    expect(la.collections.fishCaught.eel).toBe(true);
    expect(lb.collections.fishCaught.eel).toBeUndefined();
    expect(lb.day.date).toEqual({ year: 4, season: 'winter', day: 9 });
    await deleteProfile('farm-a');
    expect((await loadAll()).profiles.map((p) => p.id)).toEqual(['farm-b']);
  });
});

describe('schedule label parser', () => {
  const ctx = (day: number, weather: 'sun' | 'rain' | 'unknown' = 'sun', year = 2) => ({
    date: { year, season: 'spring' as const, day },
    weather,
    time: null,
    progress: { flags: {}, hearts: {} },
  });
  it('translates common wiki labels into typed conditions', () => {
    expect(evaluate(parseLabel('Friday', 'spring', 'sebastian').condition, ctx(5)).value).toBe(true);
    expect(evaluate(parseLabel('Friday', 'spring', 'sebastian').condition, ctx(6)).value).toBe(false);
    const rain = parseLabel('Rain (Option 2)', 'spring', 'sebastian');
    expect(rain.variantGroup).toBeTruthy();
    expect(evaluate(rain.condition, ctx(5, 'rain')).value).toBe('unknown'); // random pick
    expect(evaluate(rain.condition, ctx(5, 'sun')).value).toBe(false);
    expect(evaluate(parseLabel('Spring 11 and 25 (Any player has at least 6 hearts with Sebastian)', 'spring', 'sebastian').condition, ctx(25)).value).toBe('unknown');
    expect(evaluate(parseLabel('Tuesday the 9th and Tuesday the 23rd', 'any', 'jas').condition, ctx(23)).value).toBe(true);
    expect(evaluate(parseLabel('Monday - Friday', 'spring', 'shane').condition, ctx(6)).value).toBe(false);
    expect(evaluate(parseLabel('Friday, Saturday and Rain', 'any', 'leah').condition, ctx(2, 'rain')).value).toBe(true);
    expect(evaluate(parseLabel('Green Rain (Year 1)', 'summer', 'caroline').condition, { ...ctx(5), date: { year: 2, season: 'summer', day: 5 }, weather: 'green-rain' as const }).value).toBe(false);
    expect(parseLabel('Something unexpected', 'spring', 'sam').unparsed).toEqual(['Something unexpected']);
  });
});
