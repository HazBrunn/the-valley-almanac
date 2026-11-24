/**
 * Game clock.
 *
 * The game day runs from 6:00 AM to 2:00 AM (when the farmer passes out). The game
 * itself stores time as an integer "hhmm" that keeps counting past midnight
 * (e.g. 2400 = 12:00 AM, 2550 = 1:50 AM, 2600 = 2:00 AM). We store time as
 * MINUTES SINCE 0:00 OF THE GAME DAY, so 12:30 AM after midnight is 24*60+30 = 1470,
 * which keeps after-midnight times on the same game day (docs/GAME_RULES.md §2).
 *
 * The clock advances in 10-minute steps.
 *
 * Intervals are half-open [start, end): a fish with "6am – 7pm" is catchable
 * from 6:00 AM up to 6:50 PM, matching the game's `timeOfDay >= start && timeOfDay < end`.
 */

export type GameMinutes = number;

export const DAY_START: GameMinutes = 6 * 60; // 6:00 AM
export const DAY_END: GameMinutes = 26 * 60; // 2:00 AM (pass out)
export const TIME_STEP = 10;

export interface TimeWindow {
  /** inclusive */
  start: GameMinutes;
  /** exclusive */
  end: GameMinutes;
}

export const FULL_DAY: TimeWindow = { start: DAY_START, end: DAY_END };

export function isValidGameTime(t: number): boolean {
  return Number.isInteger(t) && t >= DAY_START && t <= DAY_END && t % TIME_STEP === 0;
}

export function clampTime(t: number): GameMinutes {
  const snapped = Math.round(t / TIME_STEP) * TIME_STEP;
  return Math.min(DAY_END, Math.max(DAY_START, snapped));
}

/** Convert the game's hhmm integer (600–2600) to minutes. */
export function fromHhmm(hhmm: number): GameMinutes {
  return Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}

export function toHhmm(t: GameMinutes): number {
  return Math.floor(t / 60) * 100 + (t % 60);
}

/** "2:00 PM", "12:00 AM" (midnight), "1:30 AM" (after midnight). */
export function formatTime(t: GameMinutes): string {
  const h24 = Math.floor(t / 60) % 24;
  const m = t % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

/** Compact label for chart axes: "6a", "12p", "2a". */
export function formatTimeShort(t: GameMinutes): string {
  const h24 = Math.floor(t / 60) % 24;
  const m = t % 60;
  const suffix = h24 < 12 ? 'a' : 'p';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${m.toString().padStart(2, '0')}${suffix}`;
}

/**
 * Parse a 12-hour clock string as written on schedules ("9:00 AM", "12am", "1:40 AM").
 * Times from 12:00 AM up to 5:59 AM are treated as after midnight of the same game day
 * (i.e. 24:00–29:59), because the game day starts at 6 AM.
 */
export function parseClock(text: string): GameMinutes | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\s*$/i.exec(text);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h < 1 || h > 12 || min > 59) return null;
  const pm = m[3]!.toLowerCase() === 'p';
  if (h === 12) h = pm ? 12 : 24;
  else if (pm) h += 12;
  else if (h < 6) h += 24;
  return h * 60 + min;
}

export function inWindow(t: GameMinutes, w: TimeWindow): boolean {
  return t >= w.start && t < w.end;
}

export function inAnyWindow(t: GameMinutes, windows: readonly TimeWindow[]): boolean {
  return windows.some((w) => inWindow(t, w));
}

export function formatWindow(w: TimeWindow): string {
  if (w.start === DAY_START && w.end === DAY_END) return 'All day';
  return `${formatTime(w.start)} – ${formatTime(w.end)}`;
}

export function formatWindows(ws: readonly TimeWindow[]): string {
  return ws.map(formatWindow).join(', ');
}

/** Merge overlapping/adjacent windows and sort them. */
export function mergeWindows(ws: readonly TimeWindow[]): TimeWindow[] {
  const sorted = [...ws].sort((a, b) => a.start - b.start);
  const out: TimeWindow[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else out.push({ ...w });
  }
  return out;
}

/** The next window start strictly after t, if any. */
export function nextWindowStart(t: GameMinutes, ws: readonly TimeWindow[]): GameMinutes | null {
  const starts = ws.map((w) => w.start).filter((s) => s > t).sort((a, b) => a - b);
  return starts[0] ?? null;
}

export function timeSteps(from: GameMinutes = DAY_START, to: GameMinutes = DAY_END, step = TIME_STEP): GameMinutes[] {
  const out: GameMinutes[] = [];
  for (let t = from; t <= to; t += step) out.push(t);
  return out;
}
