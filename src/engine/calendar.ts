/**
 * Canonical in-game calendar. Pure functions only — never consult the real-world clock.
 *
 * Verified rules (docs/GAME_RULES.md §1):
 *  - 4 seasons (Spring, Summer, Fall, Winter), 28 days each, 112 days per year.
 *  - Day 1 of every season is a Monday; weekdays repeat every 7 days, so the
 *    weekday of a date depends only on its day-of-month.
 *  - After Winter 28 comes Spring 1 of the next year.
 */

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DAYS_PER_SEASON = 28;
export const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS.length;

export interface GameDate {
  year: number;
  season: Season;
  day: number;
}

export const SEASON_LABEL: Record<Season, string> = {
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
  winter: 'Winter',
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as readonly string[]).includes(value);
}

export function seasonIndex(season: Season): number {
  return SEASONS.indexOf(season);
}

export function isValidDate(date: GameDate): boolean {
  return (
    Number.isInteger(date.year) &&
    date.year >= 1 &&
    date.year <= 9999 &&
    isSeason(date.season) &&
    Number.isInteger(date.day) &&
    date.day >= 1 &&
    date.day <= DAYS_PER_SEASON
  );
}

/** Zero-based absolute day number: Spring 1, Year 1 → 0. */
export function toDayIndex(date: GameDate): number {
  return (date.year - 1) * DAYS_PER_YEAR + seasonIndex(date.season) * DAYS_PER_SEASON + (date.day - 1);
}

export function fromDayIndex(index: number): GameDate {
  const clamped = Math.max(0, Math.floor(index));
  const year = Math.floor(clamped / DAYS_PER_YEAR) + 1;
  const inYear = clamped % DAYS_PER_YEAR;
  const season = SEASONS[Math.floor(inYear / DAYS_PER_SEASON)] as Season;
  return { year, season, day: (inYear % DAYS_PER_SEASON) + 1 };
}

export function addDays(date: GameDate, days: number): GameDate {
  return fromDayIndex(toDayIndex(date) + days);
}

export function compareDates(a: GameDate, b: GameDate): number {
  return toDayIndex(a) - toDayIndex(b);
}

export function sameDate(a: GameDate, b: GameDate): boolean {
  return a.year === b.year && a.season === b.season && a.day === b.day;
}

export function daysBetween(from: GameDate, to: GameDate): number {
  return toDayIndex(to) - toDayIndex(from);
}

export function weekdayOf(date: Pick<GameDate, 'day'>): Weekday {
  return WEEKDAYS[(date.day - 1) % 7] as Weekday;
}

export function nextSeason(season: Season): Season {
  return SEASONS[(seasonIndex(season) + 1) % 4] as Season;
}

export function previousSeason(season: Season): Season {
  return SEASONS[(seasonIndex(season) + 3) % 4] as Season;
}

/** First day of the given season in the given year. */
export function seasonStart(year: number, season: Season): GameDate {
  return { year, season, day: 1 };
}

export function formatDate(date: GameDate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const { weekday = false, year = true } = opts;
  const base = `${SEASON_LABEL[date.season]} ${date.day}`;
  const withYear = year ? `${base}, Year ${date.year}` : base;
  return weekday ? `${WEEKDAY_LABEL[weekdayOf(date)]}, ${withYear}` : withYear;
}

/** "today", "tomorrow", "in 5 days", "3 days ago". */
export function relativeDays(from: GameDate, to: GameDate): string {
  const diff = daysBetween(from, to);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

/** All dates of a season, in order. */
export function datesOfSeason(year: number, season: Season): GameDate[] {
  return Array.from({ length: DAYS_PER_SEASON }, (_, i) => ({ year, season, day: i + 1 }));
}
