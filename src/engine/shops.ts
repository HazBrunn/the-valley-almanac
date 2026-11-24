/**
 * Shop & merchant opening status. Building access and owner/service availability are
 * reported separately. Inventory is never invented.
 */
import type { Shop } from '../data/types';
import { checkups, festivals, villagerById } from '../data';
import { weekdayOf, WEEKDAY_LABEL, type GameDate } from './calendar';
import type { GameContext } from './context';
import { resolveFlag, FLAG_LABEL } from './progress';
import { formatTime, type TimeWindow } from './time';
import { isRaining } from './weather';
import { festivalOn } from './schedule';

export type ShopStatus = 'open' | 'opens-later' | 'closed-now' | 'closed-today' | 'conditional' | 'unavailable';

export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  open: 'Open now',
  'opens-later': 'Opens later',
  'closed-now': 'Closed now',
  'closed-today': 'Closed today',
  conditional: 'Depends',
  unavailable: 'Not unlocked',
};

export interface ShopResult {
  shop: Shop;
  status: ShopStatus;
  /** service window today, if open today */
  hours: TimeWindow | null;
  reasons: string[];
  notes: string[];
}

function specialCartOpening(date: GameDate): { window: TimeWindow; note: string; requires?: 'busRepaired' } | null {
  const nm = festivals.find((f) => f.id === 'night-market');
  if (nm && date.season === nm.season && date.day >= nm.startDay && date.day <= nm.endDay)
    return { window: { start: 17 * 60, end: 26 * 60 }, note: 'At the Night Market on the beach docks today.' };
  const df = festivals.find((f) => f.id === 'desert-festival');
  if (df && date.season === df.season && date.day >= df.startDay && date.day <= df.endDay)
    return { window: { start: 12 * 60, end: 26 * 60 }, note: 'At the Desert Festival today (needs the bus).', requires: 'busRepaired' };
  return null;
}

export function resolveShopAvailability(shop: Shop, ctx: GameContext): ShopResult {
  const { date } = ctx;
  const reasons: string[] = [];
  const notes = [...shop.notes];
  let conditional = false;
  let hours: TimeWindow | null = { start: shop.open, end: shop.close };
  const wd = weekdayOf(date);

  const finish = (status: ShopStatus): ShopResult => ({ shop, status, hours: status === 'closed-today' || status === 'unavailable' ? null : hours, reasons, notes });

  if (shop.requires) {
    const v = resolveFlag(shop.requires, ctx.progress, date);
    if (v === false) {
      reasons.push(`Requires: ${FLAG_LABEL[shop.requires]}`);
      return finish('unavailable');
    }
    if (v === undefined) {
      conditional = true;
      notes.push(`Only if unlocked: ${FLAG_LABEL[shop.requires]}`);
    }
  }

  if (shop.id === 'traveling-cart') {
    const special = specialCartOpening(date);
    if (special) {
      hours = special.window;
      notes.unshift(special.note);
      if (special.requires) {
        const bus = resolveFlag(special.requires, ctx.progress, date);
        if (bus === false) {
          reasons.push('The Desert Festival needs the bus to be repaired');
          return finish('closed-today');
        }
        if (bus === undefined) conditional = true;
      }
      return timeFinish();
    }
  }

  if (shop.seasons && !shop.seasons.includes(date.season)) {
    reasons.push(`Only open in ${shop.seasons.join(', ')}`);
    return finish('closed-today');
  }

  const main = festivalOn(date, 'main');
  if (main && shop.closedOnMainFestivals) {
    reasons.push(`Closed for the ${main.name}`);
    return finish('closed-today');
  }

  if (shop.closedWeekdays.includes(wd)) {
    reasons.push(`Closed on ${WEEKDAY_LABEL[wd]}s`);
    return finish('closed-today');
  }

  for (const ex of shop.exceptions) {
    switch (ex.kind) {
      case 'closedWeekdayUnlessFlag':
        if (wd === ex.weekday) {
          const v = resolveFlag(ex.flag, ctx.progress, date);
          if (v === false) {
            reasons.push(ex.note);
            return finish('closed-today');
          }
          if (v === undefined) {
            conditional = true;
            notes.push(ex.note);
          }
        }
        break;
      case 'closedWeekdayIfFlag':
        if (wd === ex.weekday) {
          const v = resolveFlag(ex.flag, ctx.progress, date);
          if (v === true) {
            reasons.push(ex.note);
            return finish('closed-today');
          }
          if (v === undefined) {
            conditional = true;
            notes.push(ex.note);
          }
        }
        break;
      case 'closedIfFlag': {
        const v = resolveFlag(ex.flag, ctx.progress, date);
        if (v === true) {
          reasons.push(ex.note);
          return finish('unavailable');
        }
        if (v === undefined) notes.push(ex.note);
        break;
      }
      case 'closedWeekdayUnlessRain':
        if (wd === ex.weekday) {
          const r = isRaining(ctx.weather);
          if (r === false) {
            reasons.push(ex.note);
            return finish('closed-today');
          }
          if (r === null) {
            conditional = true;
            notes.push(ex.note);
          }
        }
        break;
      case 'closedWhenRaining': {
        const r = isRaining(ctx.weather);
        if (r === true) {
          reasons.push(ex.note);
          return finish('closed-today');
        }
        if (r === null) {
          conditional = true;
          notes.push(ex.note);
        }
        break;
      }
      case 'earlyCloseWeekday':
        if (wd === ex.weekday && hours) {
          hours = { ...hours, end: ex.close };
          notes.push(ex.note);
        }
        break;
      case 'closedDates':
        if (date.season === ex.season && ex.days.includes(date.day)) {
          if (ex.from && hours) {
            hours = { ...hours, end: Math.min(hours.end, ex.from) };
            notes.push(ex.note);
          } else {
            reasons.push(ex.note);
            return finish('closed-today');
          }
        }
        break;
    }
  }

  // Owner away at a clinic check-up: the counter may be unattended.
  if (shop.owner) {
    const c = checkups.find((x) => x.villagerId === shop.owner && x.season === date.season && x.day === date.day);
    if (c && shop.id !== 'clinic') {
      const name = villagerById.get(shop.owner)?.name ?? shop.owner;
      notes.push(`${name} has a clinic check-up today (${formatTime(c.window.start)}–${formatTime(c.window.end)}); the counter may be unattended then.`);
    }
  }
  if (shop.buildingOpen !== undefined && shop.buildingClose !== undefined)
    notes.push(`Building open ${formatTime(shop.buildingOpen)}–${formatTime(shop.buildingClose)}.`);

  return timeFinish();

  function timeFinish(): ShopResult {
    if (conditional) return finish('conditional');
    if (ctx.time === null || !hours) return finish('open');
    if (ctx.time < hours.start) return finish('opens-later');
    if (ctx.time >= hours.end) {
      reasons.push(`Closed at ${formatTime(hours.end)}`);
      return finish('closed-now');
    }
    return finish('open');
  }
}

/** Is the shop open (status) at all today — used by calendar layers. */
export function shopOpenToday(shop: Shop, ctx: GameContext): boolean | 'unknown' {
  const r = resolveShopAvailability(shop, { ...ctx, time: null });
  if (r.status === 'conditional') return 'unknown';
  return r.status === 'open';
}
