import type { GameDate } from './calendar';
import type { Weather } from './weather';
import type { GameMinutes } from './time';
import type { PlayerProgress } from './progress';
import type { EvalContext } from './conditions';

/** Everything the rules engine needs to answer "what about today?". */
export interface GameContext {
  date: GameDate;
  weather: Weather;
  /** Ginger Island has independent weather (sun or rain only). */
  islandWeather: Weather;
  time: GameMinutes | null;
  progress: PlayerProgress;
}

export function toEvalContext(ctx: GameContext, weatherOverride?: Weather): EvalContext {
  return { date: ctx.date, weather: weatherOverride ?? ctx.weather, time: ctx.time, progress: ctx.progress };
}
