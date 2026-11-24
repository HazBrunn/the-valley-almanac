import type { GameDate, Season } from './calendar';

/**
 * Weather states (docs/GAME_RULES.md §3). `unknown` is a first-class value: the app
 * never assumes yesterday's weather carries over.
 *
 * For fishing and villager schedules the game only distinguishes "raining" from
 * "not raining": storms and green rain count as rain; snow and wind count as not raining.
 */
export const WEATHERS = ['sun', 'rain', 'storm', 'wind', 'snow', 'green-rain', 'unknown'] as const;
export type Weather = (typeof WEATHERS)[number];
export type KnownWeather = Exclude<Weather, 'unknown'>;

export const WEATHER_LABEL: Record<Weather, string> = {
  sun: 'Sunny',
  rain: 'Rain',
  storm: 'Storm',
  wind: 'Windy',
  snow: 'Snow',
  'green-rain': 'Green rain',
  unknown: 'Weather not set',
};

export const WEATHER_ICON: Record<Weather, string> = {
  sun: '☀️',
  rain: '🌧️',
  storm: '⛈️',
  wind: '🍃',
  snow: '❄️',
  'green-rain': '🌿',
  unknown: '❔',
};

export function isWeather(v: unknown): v is Weather {
  return typeof v === 'string' && (WEATHERS as readonly string[]).includes(v);
}

/** true / false / null(unknown) — whether the game treats the day as raining. */
export function isRaining(w: Weather): boolean | null {
  if (w === 'unknown') return null;
  return w === 'rain' || w === 'storm' || w === 'green-rain';
}

/**
 * Weather options that can occur naturally in a season (plus rain via Rain Totem in winter).
 * Wind occurs in spring and fall; snow only in winter; storms spring–fall; green rain only in summer.
 */
export function weatherOptionsFor(season: Season): KnownWeather[] {
  switch (season) {
    case 'spring':
      return ['sun', 'rain', 'storm', 'wind'];
    case 'summer':
      return ['sun', 'rain', 'storm', 'green-rain'];
    case 'fall':
      return ['sun', 'rain', 'storm', 'wind'];
    case 'winter':
      return ['sun', 'snow', 'rain'];
  }
}

export interface FixedWeather {
  weather: KnownWeather;
  reason: string;
}

/** Possible green rain days in summer (one of these, chosen randomly each year). */
export const GREEN_RAIN_DAYS = [5, 6, 7, 14, 15, 16, 18, 23];

/**
 * Weather that the game fixes for a date regardless of randomness. Used to pre-fill
 * weather when advancing days. `festivalDay` is supplied by the caller (calendar data).
 */
export function fixedWeatherFor(date: GameDate, festivalDay: boolean): FixedWeather | null {
  if (festivalDay) return { weather: 'sun', reason: 'It is always clear and sunny on festival days.' };
  if (date.year === 1 && date.season === 'spring') {
    if ([1, 2, 4, 5].includes(date.day)) return { weather: 'sun', reason: 'Spring 1, 2, 4 and 5 of Year 1 are always sunny.' };
    if (date.day === 3) return { weather: 'rain', reason: 'It always rains on Spring 3 of Year 1.' };
  }
  if (date.day === 1) return { weather: 'sun', reason: 'The first day of every season is sunny.' };
  if (date.season === 'summer' && (date.day === 13 || date.day === 26))
    return { weather: 'storm', reason: 'Summer 13 and 26 are always stormy (the TV can mis-forecast the 26th).' };
  return null;
}
