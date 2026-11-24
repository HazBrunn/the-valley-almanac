/**
 * Fish availability. Each FishRule is a single conjunction (areas × seasons × weather ×
 * time windows × prerequisites) — we never take a Cartesian product of a fish's separate
 * rules, so location-specific season exceptions stay correct.
 */
import type { Fish, FishRule } from '../data/types';
import { fish as ALL_FISH, fishAreaById } from '../data';
import { addDays, type GameDate, formatDate, daysBetween, SEASON_LABEL } from './calendar';
import { evaluate, triAnd, type Condition, type Tri } from './conditions';
import { type GameContext } from './context';
import { inAnyWindow, type TimeWindow, nextWindowStart, formatWindows, FULL_DAY } from './time';
import { isRaining, WEATHER_LABEL } from './weather';

export type FishStatus =
  | 'now' // catchable at the set time
  | 'later' // a window later today
  | 'today' // catchable today (no time set)
  | 'earlier' // only earlier today
  | 'conditional' // depends on unknown weather/progress
  | 'unavailable'; // not today

export const FISH_STATUS_LABEL: Record<FishStatus, string> = {
  now: 'Available now',
  later: 'Later today',
  today: 'Today',
  earlier: 'Earlier today',
  conditional: 'Conditional',
  unavailable: 'Not today',
};

export interface RuleResult {
  rule: FishRule;
  /** day-level verdict ignoring time of day */
  day: Tri;
  status: FishStatus;
  unmet: string[];
  unknowns: string[];
}

export interface FishResult {
  fish: Fish;
  status: FishStatus;
  rules: RuleResult[];
  /** rules that are possible today (true or unknown), for timelines */
  activeRules: RuleResult[];
  reasons: string[];
  unknowns: string[];
  next?: NextAvailability;
}

export interface NextAvailability {
  date: GameDate;
  inDays: number;
  needs: string[];
}

function weatherCondition(rule: FishRule): Condition | null {
  if (rule.weather === 'rain') return { kind: 'raining', value: true };
  if (rule.weather === 'dry') return { kind: 'raining', value: false };
  return null;
}

/** Conditions of a rule that are about the DATE only (season and day range). */
function dateConditions(rule: FishRule): Condition[] {
  const c: Condition[] = [{ kind: 'season', in: rule.seasons }];
  if (rule.days) c.push({ kind: 'dateRange', season: rule.seasons[0]!, from: rule.days[0], to: rule.days[1] });
  return c;
}

function progressConditions(rule: FishRule): Condition[] {
  const c: Condition[] = rule.requires.map((flag) => ({ kind: 'flag', flag, value: true }) as Condition);
  if (rule.minLevel) c.push({ kind: 'fishingLevel', min: rule.minLevel });
  return c;
}

/** Access to at least one of the rule's areas (or the given area). */
function areaAccess(rule: FishRule, area?: string): Condition | null {
  const areas = area ? [area] : rule.areas;
  const conds = areas.map((a) => {
    const req = fishAreaById.get(a)?.requires;
    return req && !rule.requires.includes(req) ? ({ kind: 'flag', flag: req, value: true } as Condition) : null;
  });
  if (conds.some((c) => c === null)) return null; // some area needs no unlock
  return conds.length === 1 ? conds[0]! : { kind: 'any', of: conds as Condition[] };
}

export function evaluateRule(rule: FishRule, ctx: GameContext, area?: string): RuleResult {
  const weather = rule.islandWeather ? ctx.islandWeather : ctx.weather;
  const evalCtx = { date: ctx.date, weather, time: ctx.time, progress: ctx.progress };
  const wc = weatherCondition(rule);
  const access = areaAccess(rule, area);
  const parts = [...dateConditions(rule), ...(wc ? [wc] : []), ...progressConditions(rule), ...(access ? [access] : [])].map((c) =>
    evaluate(c, evalCtx),
  );
  const day = triAnd(parts.map((p) => p.value));
  const unmet = parts.flatMap((p) => (p.value === false ? p.unmet : []));
  const unknowns = parts.flatMap((p) => (p.value === 'unknown' ? p.unknowns : []));
  if (rule.islandWeather && weather === 'unknown' && wc) {
    unknowns.splice(0, unknowns.length, ...unknowns.map((u) => u.replace('weather not set', 'Ginger Island weather not set')));
  }
  let status: FishStatus;
  if (day === false) status = 'unavailable';
  else {
    const t = timeStatus(rule.windows, ctx.time);
    status = day === 'unknown' && t !== 'earlier' ? 'conditional' : t;
  }
  return { rule, day, status, unmet: day === false ? unmet : [], unknowns };
}

function timeStatus(windows: TimeWindow[], time: number | null): FishStatus {
  if (time === null) return 'today';
  if (inAnyWindow(time, windows)) return 'now';
  if (nextWindowStart(time, windows) !== null) return 'later';
  return 'earlier';
}

const STATUS_RANK: FishStatus[] = ['now', 'later', 'today', 'conditional', 'earlier', 'unavailable'];

export function bestStatus(statuses: FishStatus[]): FishStatus {
  let best: FishStatus = 'unavailable';
  for (const s of statuses) if (STATUS_RANK.indexOf(s) < STATUS_RANK.indexOf(best)) best = s;
  return best;
}

export function resolveFishAvailability(fish: Fish, ctx: GameContext, opts: { area?: string } = {}): FishResult {
  const rules = fish.rules
    .filter((r) => !opts.area || r.areas.includes(opts.area))
    .map((r) => evaluateRule(r, ctx, opts.area));
  const status = rules.length ? bestStatus(rules.map((r) => r.status)) : 'unavailable';
  const activeRules = rules.filter((r) => r.day !== false);
  const reasons =
    status === 'unavailable'
      ? [...new Set(rules.flatMap((r) => r.unmet))]
      : status === 'earlier'
        ? ['Its time window has passed for today']
        : [];
  const unknowns = [...new Set(activeRules.flatMap((r) => r.unknowns))];
  const result: FishResult = { fish, status, rules, activeRules, reasons, unknowns };
  if (status === 'unavailable' || status === 'earlier') {
    const next = nextAvailability(fish, ctx, opts.area);
    if (next) result.next = next;
  }
  return result;
}

/**
 * The next date (after today) whose DATE-based conditions match some rule. Weather on
 * future days is unknown, so weather and other requirements are returned as `needs`.
 */
export function nextAvailability(fish: Fish, ctx: GameContext, area?: string, horizon = 112): NextAvailability | undefined {
  const rules = fish.rules.filter((r) => !area || r.areas.includes(area));
  for (let i = 1; i <= horizon; i++) {
    const date = addDays(ctx.date, i);
    for (const rule of rules) {
      const ok = dateConditions(rule).every((c) => evaluate(c, { date, weather: 'unknown', time: null, progress: ctx.progress }).value === true);
      if (!ok) continue;
      const prog = progressConditions(rule).map((c) => evaluate(c, { date, weather: 'unknown', time: null, progress: ctx.progress }));
      if (prog.some((p) => p.value === false)) continue;
      const needs: string[] = [];
      if (rule.weather === 'rain') needs.push(rule.islandWeather ? 'rain on Ginger Island' : 'rain');
      if (rule.weather === 'dry') needs.push('no rain');
      needs.push(...prog.flatMap((p) => p.unknowns));
      return { date, inDays: daysBetween(ctx.date, date), needs };
    }
  }
  return undefined;
}

export function describeRule(rule: FishRule): string {
  const where = rule.areas.map((a) => fishAreaById.get(a)?.name ?? a).join(', ');
  const seasons = rule.seasons.length === 4 ? 'all seasons' : rule.seasons.map((s) => SEASON_LABEL[s]).join(', ');
  const days = rule.days ? ` ${rule.days[0]}–${rule.days[1]}` : '';
  const weather = rule.weather === 'rain' ? ', rain only' : rule.weather === 'dry' ? ', sun/wind/snow only' : '';
  return `${where} · ${seasons}${days} · ${formatWindows(rule.windows)}${weather}`;
}

export function describeNext(next: NextAvailability): string {
  const when = next.inDays === 1 ? 'tomorrow' : `${formatDate(next.date, { year: false })} (in ${next.inDays} days)`;
  return `Next possible ${when}${next.needs.length ? ` — needs ${next.needs.join(', ')}` : ''}`;
}

export function resolveAllFish(ctx: GameContext, opts: { area?: string } = {}): FishResult[] {
  return ALL_FISH.map((f) => resolveFishAvailability(f, ctx, opts));
}

/** Fish that can be caught in an area today (or conditionally), with their windows. */
export function resolveAreaFish(area: string, ctx: GameContext): FishResult[] {
  return ALL_FISH.filter((f) => f.rules.some((r) => r.areas.includes(area))).map((f) => resolveFishAvailability(f, ctx, { area }));
}

export function weatherNeedLabel(rule: FishRule): string | null {
  if (rule.weather === 'rain') return 'Rain only';
  if (rule.weather === 'dry') return 'Not in rain';
  return null;
}

/** True if this fish has any rule that is weather dependent. */
export function isWeatherDependent(f: Fish): boolean {
  return f.rules.some((r) => r.weather !== 'any');
}

/** Is the current weather one the rule rejects? Used for "wrong weather" styling. */
export function wrongWeather(rule: FishRule, ctx: GameContext): boolean {
  const w = rule.islandWeather ? ctx.islandWeather : ctx.weather;
  const r = isRaining(w);
  if (r === null) return false;
  return (rule.weather === 'rain' && !r) || (rule.weather === 'dry' && r);
}

export function weatherText(ctx: GameContext): string {
  return WEATHER_LABEL[ctx.weather];
}

/** Days left in the current season on which a date-based rule still holds (for "last chance"). */
export function lastDayThisSeason(fish: Fish, ctx: GameContext): GameDate | null {
  let last: GameDate | null = null;
  for (let d = ctx.date.day; d <= 28; d++) {
    const date = { ...ctx.date, day: d };
    const ok = fish.rules.some((rule) =>
      dateConditions(rule).every((c) => evaluate(c, { date, weather: 'unknown', time: null, progress: ctx.progress }).value === true),
    );
    if (ok) last = date;
  }
  // available next season too? then it isn't really a "last chance"
  const nextSeasonStart = addDays({ ...ctx.date, day: 28 }, 1);
  const continues = fish.rules.some((rule) =>
    dateConditions(rule).every((c) => evaluate(c, { date: nextSeasonStart, weather: 'unknown', time: null, progress: ctx.progress }).value === true),
  );
  return continues ? null : last;
}

export const ALL_DAY = FULL_DAY;

/** Areas where the fish is possible today: definite ones if any, otherwise conditional ones. */
export function activeAreas(r: FishResult): string[] {
  const sure = r.activeRules.filter((a) => a.day === true);
  return [...new Set((sure.length ? sure : r.activeRules).flatMap((a) => a.rule.areas))];
}
