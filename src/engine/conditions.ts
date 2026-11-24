/**
 * Safe, typed, compositional condition language with three-valued logic.
 *
 * Imported datasets describe requirements as data (never executable code). Evaluation
 * returns `true`, `false` or `unknown`; a missing player input yields `unknown` rather than
 * being silently treated as satisfied or unsatisfied (docs/GAME_RULES.md §4).
 */
import { type GameDate, type Season, type Weekday, weekdayOf, toDayIndex } from './calendar';
import { isRaining, type Weather } from './weather';
import type { PlayerProgress, ProgressFlag } from './progress';
import { resolveFlag, FLAG_LABEL } from './progress';
import { inWindow, type GameMinutes, formatWindow } from './time';

export type Tri = true | false | 'unknown';

export type Condition =
  | { kind: 'all'; of: Condition[] }
  | { kind: 'any'; of: Condition[] }
  | { kind: 'not'; of: Condition }
  | { kind: 'season'; in: Season[] }
  | { kind: 'weekday'; in: Weekday[] }
  | { kind: 'dayOfMonth'; in: number[] }
  | { kind: 'date'; season: Season; day: number }
  | { kind: 'dateRange'; season: Season; from: number; to: number }
  | { kind: 'year'; min?: number; max?: number; parity?: 'odd' | 'even' }
  | { kind: 'raining'; value: boolean }
  | { kind: 'weather'; in: Weather[] }
  | { kind: 'time'; start: GameMinutes; end: GameMinutes }
  | { kind: 'flag'; flag: ProgressFlag; value: boolean }
  | { kind: 'hearts'; npc: string; min?: number; max?: number; anyPlayer?: boolean }
  | { kind: 'married'; npc?: string; value: boolean }
  | { kind: 'fishingLevel'; min: number }
  | { kind: 'random'; note: string }
  | { kind: 'unknown'; note: string };

export interface EvalContext {
  date: GameDate;
  weather: Weather;
  /** null when the user has not set a time of day */
  time: GameMinutes | null;
  progress: PlayerProgress;
}

export interface EvalResult {
  value: Tri;
  /** Human readable reasons a requirement is not met */
  unmet: string[];
  /** Human readable inputs that are missing or inherently random */
  unknowns: string[];
}

const T: EvalResult = { value: true, unmet: [], unknowns: [] };

function res(value: Tri, unmet: string[] = [], unknowns: string[] = []): EvalResult {
  return { value, unmet, unknowns };
}

export function triAnd(values: Tri[]): Tri {
  if (values.includes(false)) return false;
  if (values.includes('unknown')) return 'unknown';
  return true;
}

export function triOr(values: Tri[]): Tri {
  if (values.includes(true)) return true;
  if (values.includes('unknown')) return 'unknown';
  return false;
}

export function triNot(v: Tri): Tri {
  return v === 'unknown' ? 'unknown' : !v;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function evaluate(cond: Condition, ctx: EvalContext): EvalResult {
  switch (cond.kind) {
    case 'all': {
      const parts = cond.of.map((c) => evaluate(c, ctx));
      const value = triAnd(parts.map((p) => p.value));
      return res(
        value,
        parts.flatMap((p) => (p.value === false ? p.unmet : [])),
        value === false ? [] : parts.flatMap((p) => p.unknowns),
      );
    }
    case 'any': {
      if (cond.of.length === 0) return res(false, ['No option applies']);
      const parts = cond.of.map((c) => evaluate(c, ctx));
      const value = triOr(parts.map((p) => p.value));
      return res(
        value,
        value === false ? parts.flatMap((p) => p.unmet) : [],
        value === 'unknown' ? parts.flatMap((p) => p.unknowns) : [],
      );
    }
    case 'not': {
      const inner = evaluate(cond.of, ctx);
      const value = triNot(inner.value);
      return res(value, value === false ? [`Not: ${describe(cond.of)}`] : [], inner.unknowns);
    }
    case 'season':
      return cond.in.includes(ctx.date.season) ? T : res(false, [`Only in ${cond.in.map(cap).join(', ')}`]);
    case 'weekday':
      return cond.in.includes(weekdayOf(ctx.date)) ? T : res(false, [`Only on ${cond.in.map(cap).join(', ')}`]);
    case 'dayOfMonth':
      return cond.in.includes(ctx.date.day) ? T : res(false, [`Only on day ${cond.in.join(', ')}`]);
    case 'date':
      return ctx.date.season === cond.season && ctx.date.day === cond.day
        ? T
        : res(false, [`Only on ${cap(cond.season)} ${cond.day}`]);
    case 'dateRange':
      return ctx.date.season === cond.season && ctx.date.day >= cond.from && ctx.date.day <= cond.to
        ? T
        : res(false, [`Only ${cap(cond.season)} ${cond.from}–${cond.to}`]);
    case 'year': {
      const y = ctx.date.year;
      if (cond.min !== undefined && y < cond.min) return res(false, [`From Year ${cond.min}`]);
      if (cond.max !== undefined && y > cond.max) return res(false, [`Until Year ${cond.max}`]);
      if (cond.parity === 'odd' && y % 2 === 0) return res(false, ['Odd years only']);
      if (cond.parity === 'even' && y % 2 === 1) return res(false, ['Even years only']);
      return T;
    }
    case 'raining': {
      const r = isRaining(ctx.weather);
      if (r === null) return res('unknown', [], [cond.value ? 'Needs rain — weather not set' : 'Needs dry weather — weather not set']);
      return r === cond.value ? T : res(false, [cond.value ? 'Only when raining' : 'Only when not raining']);
    }
    case 'weather': {
      if (ctx.weather === 'unknown') return res('unknown', [], ['Weather not set']);
      return cond.in.includes(ctx.weather) ? T : res(false, [`Only in ${cond.in.join('/')} weather`]);
    }
    case 'time': {
      if (ctx.time === null) return res('unknown', [], ['Time of day not set']);
      return inWindow(ctx.time, cond)
        ? T
        : res(false, [`Only ${formatWindow(cond)}`]);
    }
    case 'flag': {
      const v = resolveFlag(cond.flag, ctx.progress, ctx.date);
      const label = FLAG_LABEL[cond.flag];
      if (v === undefined) return res('unknown', [], [`Unknown: ${label}`]);
      return v === cond.value ? T : res(false, [cond.value ? `Requires: ${label}` : `Not when: ${label}`]);
    }
    case 'hearts': {
      const h = ctx.progress.hearts[cond.npc];
      const name = cap(cond.npc);
      const need =
        cond.min !== undefined && cond.max !== undefined
          ? `${cond.min}–${cond.max} hearts with ${name}`
          : cond.min !== undefined
            ? `${cond.min}+ hearts with ${name}`
            : `under ${(cond.max ?? 0) + 1} hearts with ${name}`;
      if (h === undefined) return res('unknown', [], [`Friendship with ${name} not entered (${need})`]);
      if (cond.min !== undefined && h < cond.min) return res(false, [`Needs ${need}`]);
      if (cond.max !== undefined && h > cond.max) return res(false, [`Only with ${need}`]);
      return T;
    }
    case 'married': {
      const spouse = ctx.progress.spouse;
      if (spouse === undefined) return res('unknown', [], ['Marriage status not entered']);
      const isMarried = cond.npc ? spouse === cond.npc : spouse !== null;
      return isMarried === cond.value ? T : res(false, [cond.value ? `Requires marriage${cond.npc ? ` to ${cap(cond.npc)}` : ''}` : 'Not when married']);
    }
    case 'fishingLevel': {
      const lvl = ctx.progress.fishingLevel;
      if (lvl === undefined) return res('unknown', [], [`Needs Fishing level ${cond.min} — level not entered`]);
      return lvl >= cond.min ? T : res(false, [`Needs Fishing level ${cond.min}`]);
    }
    case 'random':
      return res('unknown', [], [cond.note]);
    case 'unknown':
      return res('unknown', [], [cond.note]);
  }
}

export function describe(cond: Condition): string {
  switch (cond.kind) {
    case 'all':
      return cond.of.map(describe).join(' and ');
    case 'any':
      return cond.of.map(describe).join(' or ');
    case 'not':
      return `not (${describe(cond.of)})`;
    case 'season':
      return cond.in.map(cap).join('/');
    case 'weekday':
      return cond.in.map(cap).join('/');
    case 'dayOfMonth':
      return `day ${cond.in.join(', ')}`;
    case 'date':
      return `${cap(cond.season)} ${cond.day}`;
    case 'dateRange':
      return `${cap(cond.season)} ${cond.from}–${cond.to}`;
    case 'year':
      return [cond.min && `Year ≥ ${cond.min}`, cond.max && `Year ≤ ${cond.max}`, cond.parity && `${cond.parity} years`]
        .filter(Boolean)
        .join(', ');
    case 'raining':
      return cond.value ? 'raining' : 'not raining';
    case 'weather':
      return cond.in.join('/');
    case 'time':
      return formatWindow(cond);
    case 'flag':
      return cond.value ? FLAG_LABEL[cond.flag] : `not ${FLAG_LABEL[cond.flag]}`;
    case 'hearts':
      return `${cond.min ?? 0}${cond.max !== undefined ? `–${cond.max}` : '+'} hearts with ${cap(cond.npc)}`;
    case 'married':
      return cond.value ? `married${cond.npc ? ` to ${cap(cond.npc)}` : ''}` : 'not married';
    case 'fishingLevel':
      return `Fishing level ${cond.min}+`;
    case 'random':
    case 'unknown':
      return cond.note;
  }
}

/** Stable key for a date for memoisation. */
export function dateKey(d: GameDate): number {
  return toDayIndex(d);
}
