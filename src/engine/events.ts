/**
 * Calendar events for a date: deterministic facts (birthdays, festivals, fixed weather,
 * Queen of Sauce Sunday recipe, cart days, check-ups, berry windows) and honestly labelled
 * possibilities (Bookseller candidate days, green rain candidate days, TV reruns).
 */
import { villagers, festivals, checkups, calendarExtras, recipes, crops, villagerById } from '../data';
import { weekdayOf, type GameDate, type Season, SEASON_LABEL, formatDate } from './calendar';
import { resolveFlag } from './progress';
import type { PlayerProgress } from './progress';
import { formatTime } from './time';
import { fixedWeatherFor, WEATHER_LABEL } from './weather';
import { lastSafePlantingDay } from './crops';

export const EVENT_LAYERS = ['birthdays', 'festivals', 'merchants', 'forage', 'crops', 'tv', 'clinic', 'weather', 'world', 'personal'] as const;
export type EventLayer = (typeof EVENT_LAYERS)[number];

export const LAYER_LABEL: Record<EventLayer, string> = {
  birthdays: 'Birthdays',
  festivals: 'Festivals',
  merchants: 'Merchants',
  forage: 'Foraging',
  crops: 'Planting deadlines',
  tv: 'Television',
  clinic: 'Clinic check-ups',
  weather: 'Fixed weather',
  world: 'World events',
  personal: 'My reminders',
};

export type Certainty = 'certain' | 'possible' | 'conditional';

export interface CalendarEvent {
  id: string;
  layer: EventLayer;
  icon: string;
  title: string;
  detail: string;
  certainty: Certainty;
  /** in-app link */
  href?: string;
  /** relevance weight for Today ranking */
  weight: number;
  /** spans several days */
  range?: { from: number; to: number };
  spoiler?: boolean;
}

export function qosSundayRecipe(date: GameDate) {
  if (weekdayOf(date) !== 'sunday') return undefined;
  if (date.year === 1 && date.season === 'spring' && date.day < 7) return undefined;
  const cycleYear = date.year % 2 === 1 ? 1 : 2;
  return recipes.find((r) => r.tv && r.tv.cycleYear === cycleYear && r.tv.season === date.season && r.tv.day === date.day);
}

export function resolveCalendarEvents(date: GameDate, progress: PlayerProgress): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const { season, day } = date;
  const wd = weekdayOf(date);

  // Birthdays
  for (const v of villagers) {
    if (v.birthday.season === season && v.birthday.day === day) {
      const req = v.availability?.requires ? resolveFlag(v.availability.requires, progress, date) : true;
      out.push({
        id: `birthday-${v.id}`,
        layer: 'birthdays',
        icon: '🎂',
        title: `${v.name}'s birthday`,
        detail: req === false ? `${v.availability?.note ?? ''}` : 'Gifts count for 8× friendship today.',
        certainty: req === true ? 'certain' : req === false ? 'conditional' : 'conditional',
        href: `/people/${v.id}`,
        weight: 90,
        spoiler: v.availability?.spoiler,
      });
    }
  }

  // Festivals
  for (const f of festivals) {
    if (f.season === season && day >= f.startDay && day <= f.endDay) {
      const req = f.requires ? resolveFlag(f.requires, progress, date) : true;
      out.push({
        id: `festival-${f.id}`,
        layer: 'festivals',
        icon: f.kind === 'main' ? '🎪' : '🎣',
        title: f.name,
        detail: `${formatTime(f.start)} – ${formatTime(f.end)}. ${f.description}${req === undefined ? ' (Needs the bus.)' : ''}`,
        certainty: req === false ? 'conditional' : req === undefined ? 'conditional' : 'certain',
        href: `/calendar?season=${season}&day=${day}`,
        weight: f.kind === 'main' ? 100 : 80,
        ...(f.endDay > f.startDay ? { range: { from: f.startDay, to: f.endDay } } : {}),
      });
    }
  }

  // Traveling Cart
  const nightMarket = season === 'winter' && day >= 15 && day <= 17;
  const desertFest = season === 'spring' && day >= 15 && day <= 17;
  if (wd === 'friday' || wd === 'sunday' || nightMarket || desertFest) {
    const bus = resolveFlag('busRepaired', progress, date);
    const where = nightMarket
      ? 'At the Night Market, 5 PM – 2 AM'
      : desertFest && wd !== 'friday' && wd !== 'sunday'
        ? 'At the Desert Festival, 12 PM – 2 AM (needs the bus)'
        : 'Cindersap Forest, 6 AM – 8 PM';
    out.push({
      id: 'cart',
      layer: 'merchants',
      icon: '🛒',
      title: 'Traveling Cart',
      detail: `${where}. Random stock each visit.`,
      certainty: desertFest && wd !== 'friday' && wd !== 'sunday' && bus !== true ? 'conditional' : 'certain',
      href: '/shops#traveling-cart',
      weight: 60,
    });
  }

  // Bookseller
  if (calendarExtras.bookseller[season]?.includes(day)) {
    out.push({
      id: 'bookseller',
      layer: 'merchants',
      icon: '📚',
      title: 'Bookseller (possible)',
      detail: `Visits on 2 of these days each ${SEASON_LABEL[season]}: ${calendarExtras.bookseller[season].join(', ')}. Which two depends on your save — check the in-game calendar.`,
      certainty: 'possible',
      href: '/shops#bookseller',
      weight: 25,
    });
  }

  // Berry windows
  for (const b of calendarExtras.berries) {
    if (b.season === season && day >= b.from && day <= b.to) {
      out.push({
        id: `berry-${b.id}`,
        layer: 'forage',
        icon: b.id === 'salmonberry' ? '🍓' : '🫐',
        title: b.name,
        detail: `${SEASON_LABEL[season]} ${b.from}–${b.to}. ${b.note}`,
        certainty: 'certain',
        href: `/forage#${b.item.toLowerCase()}`,
        weight: day === b.to ? 85 : 65,
        range: { from: b.from, to: b.to },
      });
    }
  }

  // Clinic check-ups
  for (const c of checkups.filter((x) => x.season === season && x.day === day)) {
    const v = villagerById.get(c.villagerId);
    if (!v) continue;
    out.push({
      id: `checkup-${c.villagerId}`,
      layer: 'clinic',
      icon: '🩺',
      title: `${v.name}: clinic check-up`,
      detail: `${formatTime(c.window.start)} – ${formatTime(c.window.end)} at Harvey's Clinic${c.note ? ` (${c.note})` : ''}.`,
      certainty: 'certain',
      href: `/people/${v.id}`,
      weight: 20,
    });
  }

  // TV
  const qos = qosSundayRecipe(date);
  if (qos)
    out.push({
      id: 'qos',
      layer: 'tv',
      icon: '📺',
      title: `Queen of Sauce: ${qos.name}`,
      detail: 'New Sunday recipe — watch TV to learn it.',
      certainty: 'certain',
      href: `/recipes#${qos.id}`,
      weight: 55,
    });
  if (wd === 'wednesday' && !(date.year === 1 && season === 'spring' && day < 7))
    out.push({
      id: 'qos-rerun',
      layer: 'tv',
      icon: '📺',
      title: 'Queen of Sauce rerun',
      detail: 'A random earlier recipe (ones you don’t know are preferred). Cannot be predicted.',
      certainty: 'possible',
      href: '/recipes',
      weight: 15,
    });
  if (wd === 'monday' || wd === 'thursday')
    out.push({ id: 'land', layer: 'tv', icon: '📺', title: "Livin' Off The Land", detail: 'Farming and foraging tips on TV.', certainty: 'certain', weight: 5 });

  // Fixed weather / world
  const festivalToday = festivals.some((f) => f.kind === 'main' && f.season === season && day >= f.startDay && day <= f.endDay);
  const fixed = fixedWeatherFor(date, festivalToday);
  if (fixed && fixed.weather === 'storm')
    out.push({ id: 'storm', layer: 'weather', icon: '⛈️', title: 'Storm day', detail: fixed.reason, certainty: 'certain', weight: 40 });
  if (season === 'summer' && calendarExtras.greenRainDays.includes(day))
    out.push({
      id: 'green-rain',
      layer: 'weather',
      icon: '🌿',
      title: 'Green rain (possible)',
      detail: `Green rain falls on one random day each Summer, chosen from days ${calendarExtras.greenRainDays.join(', ')}.`,
      certainty: 'possible',
      weight: 10,
    });
  if (date.year === 1 && season === 'summer' && day === 3)
    out.push({ id: 'earthquake', layer: 'world', icon: '🚂', title: 'Earthquake — the Railroad opens', detail: 'The railroad area becomes accessible from today.', certainty: 'certain', weight: 70 });
  if (date.year === 2 && season === 'spring' && day === 1)
    out.push({ id: 'kent', layer: 'world', icon: '🏡', title: 'Kent returns home', detail: 'Kent joins his family at 1 Willow Lane from Year 2.', certainty: 'certain', href: '/people/kent', weight: 50 });
  if (season === 'winter' && day === 18)
    out.push({ id: 'winter-star-letter', layer: 'world', icon: '✉️', title: 'Secret gift letter', detail: 'Mayor Lewis tells you who to give a gift to at the Feast of the Winter Star (Winter 25).', certainty: 'certain', weight: 45 });

  // Planting deadlines (last safe outdoor planting day without speed fertiliser)
  const lasts = crops.filter((c) => c.seasons.includes(season) && lastSafePlantingDay(c, season, date.year) === day);
  if (lasts.length)
    out.push({
      id: 'plant-deadline',
      layer: 'crops',
      icon: '🌱',
      title: `Last day to plant: ${lasts.map((c) => c.name).join(', ')}`,
      detail: 'Planted outdoors today without speed fertiliser, these still mature before the season ends.',
      certainty: 'certain',
      href: '/crops',
      weight: 50,
    });

  return out.sort((a, b) => b.weight - a.weight);
}

export function birthdaysInSeason(season: Season) {
  return villagers.filter((v) => v.birthday.season === season).sort((a, b) => a.birthday.day - b.birthday.day);
}

export function describeEventDate(date: GameDate): string {
  return formatDate(date, { weekday: true });
}

export { WEATHER_LABEL };
