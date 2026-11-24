/**
 * Daily opportunities for the Today screen: a ranked, grouped, deduplicated digest built
 * only from the shared resolvers. No streaks, no pressure — just "what's special today".
 */
import { fish as ALL_FISH, fishById, villagerById, cropById, forageById, bundles } from '../data';
import type { Fish } from '../data/types';
import { addDays, type GameDate, formatDate, toDayIndex, compareDates, SEASON_LABEL, daysBetween } from './calendar';
import type { GameContext } from './context';
import { resolveCalendarEvents, type CalendarEvent } from './events';
import { resolveFishAvailability, lastDayThisSeason, type FishResult } from './fish';
import type { Profile, WatchItem } from './profile';
import { formatWindows, formatTime } from './time';
import { isRaining } from './weather';
import { fishAreaById } from '../data';
import { lastSafePlantingDay } from './crops';
import { resolveVillagerSchedule, summariseLocation } from './schedule';

export type OppLabel = 'Available now' | 'Later today' | 'Today' | 'Coming up' | 'Conditional' | 'Unknown' | 'Last chance';

export interface Opportunity {
  id: string;
  label: OppLabel;
  icon: string;
  title: string;
  detail: string;
  href?: string;
  weight: number;
  watchId?: string;
}

export interface DailyDigest {
  summary: string;
  todayEvents: CalendarEvent[];
  weatherFish: Opportunity[];
  personal: Opportunity[];
  upcoming: { date: GameDate; inDays: number; event: CalendarEvent }[];
  deadlines: Opportunity[];
  rainIfUnknown: Fish[];
}

const fishLabel = (r: FishResult): OppLabel =>
  r.status === 'now' ? 'Available now' : r.status === 'later' ? 'Later today' : r.status === 'today' ? 'Today' : r.status === 'conditional' ? 'Conditional' : 'Unknown';

function fishWhere(r: FishResult): string {
  const rule = r.activeRules[0]?.rule;
  if (!rule) return '';
  const areas = [...new Set(r.activeRules.flatMap((a) => a.rule.areas))].map((a) => fishAreaById.get(a)?.name ?? a);
  return `${areas.slice(0, 3).join(', ')}${areas.length > 3 ? '…' : ''} · ${formatWindows(rule.windows)}`;
}

export function visibleWatch(items: WatchItem[], today: GameDate): WatchItem[] {
  return items.filter((w) => !w.done && (!w.snoozedUntil || compareDates(w.snoozedUntil, today) <= 0));
}

export function resolveDailyOpportunities(ctx: GameContext, profile: Profile): DailyDigest {
  const dayIdx = toDayIndex(ctx.date);
  const dismissed = new Set(profile.prefs.dismissed.filter((d) => d.startsWith(`${dayIdx}:`)).map((d) => d.split(':').slice(1).join(':')));
  const caught = profile.collections.fishCaught;
  const spoilers = profile.prefs.spoilers === 'show';

  const todayEvents = resolveCalendarEvents(ctx.date, ctx.progress).filter((e) => !dismissed.has(e.id) && (spoilers || !e.spoiler));

  // Weather-dependent fish: the reason rainy days feel special.
  const raining = isRaining(ctx.weather);
  const weatherFish: Opportunity[] = [];
  const rainIfUnknown: Fish[] = [];
  for (const f of ALL_FISH) {
    if (f.legendary === 'legendary-2' || f.method !== 'rod' || f.category === 'other') continue;
    const weatherRules = f.rules.filter((r) => r.weather === 'rain' && !r.islandWeather);
    if (!weatherRules.length) continue;
    const r = resolveFishAvailability(f, ctx);
    if (raining === true && ['now', 'later', 'today'].includes(r.status) && r.activeRules.some((a) => a.rule.weather === 'rain')) {
      weatherFish.push({
        id: `fish-${f.id}`,
        label: fishLabel(r),
        icon: '🐟',
        title: f.name,
        detail: `${fishWhere(r)} (rain only)`,
        href: `/fish/${f.id}`,
        weight: (caught[f.id] ? 20 : 60) + (r.status === 'now' ? 10 : 0),
      });
    }
    if (raining === null && r.status === 'conditional') rainIfUnknown.push(f);
  }

  // Personal: watchlist first, then uncaught fish if collection focus.
  const personal: Opportunity[] = [];
  for (const w of visibleWatch(profile.watchlist, ctx.date)) {
    if (dismissed.has(`watch-${w.id}`)) continue;
    const opp = watchOpportunity(w, ctx, profile);
    if (opp) personal.push(opp);
  }
  if (profile.prefs.collectionFocus) {
    for (const f of ALL_FISH) {
      if (caught[f.id] || f.legendary === 'legendary-2' || personal.some((p) => p.id === `watch-fish-${f.id}`)) continue;
      const r = resolveFishAvailability(f, ctx);
      if (r.status === 'now' || r.status === 'later' || r.status === 'today') {
        const last = lastDayThisSeason(f, ctx);
        personal.push({
          id: `missing-${f.id}`,
          label: last && daysBetween(ctx.date, last) <= 3 ? 'Last chance' : fishLabel(r),
          icon: '🎣',
          title: `${f.name} (not caught yet)`,
          detail: `${fishWhere(r)}${last ? ` · last day this season: ${formatDate(last, { year: false })}` : ''}`,
          href: `/fish/${f.id}`,
          weight: 40 + (last ? 20 : 0) + (r.status === 'now' ? 5 : 0),
        });
      }
    }
  }
  personal.sort((a, b) => b.weight - a.weight);

  // Upcoming 7 days (deterministic events only, weighted)
  const upcoming: DailyDigest['upcoming'] = [];
  for (let i = 1; i <= 7; i++) {
    const d = addDays(ctx.date, i);
    for (const e of resolveCalendarEvents(d, ctx.progress)) {
      if (e.certainty !== 'certain' || e.weight < 45 || (!spoilers && e.spoiler)) continue;
      if (e.range && d.day !== e.range.from && i !== 1) continue; // dedupe multi-day
      upcoming.push({ date: d, inDays: i, event: e });
    }
  }

  // Seasonal deadlines: end of season for watched/uncaught seasonal fish, berries ending, planting
  const deadlines: Opportunity[] = [];
  const daysLeft = 28 - ctx.date.day;
  if (daysLeft <= 7) {
    deadlines.push({
      id: 'season-end',
      label: 'Coming up',
      icon: '🍂',
      title: `${daysLeft === 0 ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`} of ${SEASON_LABEL[ctx.date.season]}`,
      detail: 'Crops that cannot grow next season will wither overnight after day 28.',
      href: '/crops',
      weight: 50,
    });
  }
  const watchedCrops = profile.watchlist.filter((w) => w.kind === 'crop' && w.ref && !w.done);
  for (const w of watchedCrops) {
    const c = cropById.get(w.ref!);
    if (!c) continue;
    const last = lastSafePlantingDay(c, ctx.date.season, ctx.date.year);
    if (last !== null && last >= ctx.date.day && last - ctx.date.day <= 5)
      deadlines.push({
        id: `plant-${c.id}`,
        label: last === ctx.date.day ? 'Last chance' : 'Coming up',
        icon: '🌱',
        title: `Plant ${c.name} by ${SEASON_LABEL[ctx.date.season]} ${last}`,
        detail: `${c.growDays} days to grow; planting later won't mature before the season ends.`,
        href: `/crops?crop=${c.id}`,
        weight: 70,
      });
  }
  deadlines.sort((a, b) => b.weight - a.weight);

  return {
    summary: buildSummary(ctx, todayEvents, weatherFish, rainIfUnknown),
    todayEvents,
    weatherFish: weatherFish.sort((a, b) => b.weight - a.weight),
    personal,
    upcoming,
    deadlines,
    rainIfUnknown,
  };
}

function watchOpportunity(w: WatchItem, ctx: GameContext, profile: Profile): Opportunity | null {
  const base = { id: `watch-${w.kind}-${w.ref ?? w.id}`, watchId: w.id };
  if (w.due) {
    const d = daysBetween(ctx.date, w.due);
    if (d < 0)
      return { ...base, label: 'Unknown', icon: '📝', title: w.title, detail: `Was due ${formatDate(w.due, { year: false })}`, href: '/journal', weight: 75 };
    if (d <= 3)
      return { ...base, label: d === 0 ? 'Today' : 'Coming up', icon: '📝', title: w.title, detail: d === 0 ? 'Due today' : `Due in ${d} day${d === 1 ? '' : 's'}`, href: '/journal', weight: 85 - d * 5 };
  }
  switch (w.kind) {
    case 'fish': {
      const f = w.ref ? fishById.get(w.ref) : undefined;
      if (!f) return null;
      if (profile.collections.fishCaught[f.id] && !w.recurring) return null;
      const r = resolveFishAvailability(f, ctx);
      if (r.status === 'unavailable' || r.status === 'earlier') return null;
      const last = lastDayThisSeason(f, ctx);
      return {
        ...base,
        label: last && daysBetween(ctx.date, last) <= 3 ? 'Last chance' : fishLabel(r),
        icon: '⭐',
        title: f.name,
        detail: r.status === 'conditional' ? `If ${r.unknowns.join('; ').toLowerCase()}: ${fishWhere(r)}` : fishWhere(r),
        href: `/fish/${f.id}`,
        weight: r.status === 'conditional' ? 55 : 80,
      };
    }
    case 'villager': {
      const v = w.ref ? villagerById.get(w.ref) : undefined;
      if (!v) return null;
      const bday = { year: ctx.date.year, season: v.birthday.season, day: v.birthday.day };
      let days = daysBetween(ctx.date, bday);
      if (days < 0) days += 112;
      if (days <= 7)
        return {
          ...base,
          label: days === 0 ? 'Today' : 'Coming up',
          icon: '🎂',
          title: days === 0 ? `${v.name}'s birthday is today` : `${v.name}'s birthday in ${days} day${days === 1 ? '' : 's'}`,
          detail: `Loves: ${v.gifts.loves.slice(0, 3).join(', ')}`,
          href: `/people/${v.id}?tab=gifts`,
          weight: days === 0 ? 95 : 70 - days,
        };
      const res = resolveVillagerSchedule(v.id, ctx);
      return res
        ? { ...base, label: 'Today', icon: '⭐', title: v.name, detail: summariseLocation(res, ctx.time), href: `/people/${v.id}`, weight: 35 }
        : null;
    }
    case 'crop': {
      const c = w.ref ? cropById.get(w.ref) : undefined;
      if (!c) return null;
      if (!c.seasons.includes(ctx.date.season)) return null;
      const last = lastSafePlantingDay(c, ctx.date.season, ctx.date.year);
      if (last === null || last < ctx.date.day) return null;
      return { ...base, label: 'Today', icon: '🌱', title: `${c.name} can be planted`, detail: `Last safe day: ${SEASON_LABEL[ctx.date.season]} ${last}`, href: `/crops?crop=${c.id}`, weight: 40 };
    }
    case 'forage': {
      const f = w.ref ? forageById.get(w.ref) : undefined;
      if (!f) return null;
      if (f.window) {
        if (f.window.season !== ctx.date.season) return null;
        if (ctx.date.day > f.window.to) return null;
        const inWin = ctx.date.day >= f.window.from;
        return {
          ...base,
          label: inWin ? (ctx.date.day === f.window.to ? 'Last chance' : 'Today') : 'Coming up',
          icon: '🍓',
          title: f.name,
          detail: inWin ? `In season until day ${f.window.to}` : `Starts ${SEASON_LABEL[f.window.season]} ${f.window.from}`,
          href: `/forage#${f.id}`,
          weight: 60,
        };
      }
      if (!f.seasons.includes(ctx.date.season)) return null;
      return { ...base, label: 'Today', icon: '🍄', title: f.name, detail: `Possible forage: ${f.locations}`, href: `/forage#${f.id}`, weight: 30 };
    }
    case 'bundle': {
      const b = bundles.find((x) => x.id === w.ref);
      if (!b) return null;
      const done = Object.keys(profile.collections.bundleItems[b.id] ?? {}).length;
      if (done >= b.itemsRequired) return null;
      return { ...base, label: 'Today', icon: '🧺', title: b.name, detail: `${done}/${b.itemsRequired} items submitted`, href: `/journal/bundles#${b.id}`, weight: 30 };
    }
    case 'custom':
    case 'event':
    case 'recipe':
    case 'museum':
      return w.pinned ? { ...base, label: 'Today', icon: '📌', title: w.title, detail: w.note ?? '', href: '/journal', weight: 50 } : null;
  }
}

function buildSummary(ctx: GameContext, events: CalendarEvent[], weatherFish: Opportunity[], rainIfUnknown: Fish[]): string {
  const parts: string[] = [];
  const fest = events.find((e) => e.layer === 'festivals' && e.certainty === 'certain');
  const bday = events.filter((e) => e.layer === 'birthdays' && e.certainty === 'certain');
  if (fest) parts.push(`It's the ${fest.title} today.`);
  if (bday.length) parts.push(`${bday.map((b) => b.title.replace("'s birthday", '')).join(' and ')} ${bday.length > 1 ? 'have birthdays' : 'has a birthday'} today.`);
  const raining = isRaining(ctx.weather);
  if (raining === true && weatherFish.length)
    parts.push(`Rain brings ${weatherFish.length === 1 ? 'a rain-only fish' : `${weatherFish.length} rain-only fish`} out — ${weatherFish.slice(0, 3).map((f) => f.title).join(', ')}.`);
  else if (raining === null && rainIfUnknown.length) parts.push('Set the weather to see rain-only fish; it might matter today.');
  if (events.some((e) => e.id === 'cart' && e.certainty === 'certain')) parts.push('The Traveling Cart is in town.');
  if (!parts.length) parts.push(`A quiet ${ctx.time !== null ? `${formatTime(ctx.time).toLowerCase()} ` : ''}in the Valley — a good day to fish, forage or visit friends.`);
  return parts.join(' ');
}
