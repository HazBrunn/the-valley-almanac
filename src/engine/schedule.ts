/**
 * Villager schedule resolver.
 *
 * Precedence (docs/GAME_RULES.md §5):
 *  1. Fixed-location villagers (Dwarf, Krobus, Wizard) — no daily schedule.
 *  2. Villagers not yet present (e.g. Kent before Year 2).
 *  3. Main festival days — normal schedules are suspended; villagers attend the festival.
 *  4. Marriage — the spouse follows the marriage routine.
 *  5. The wiki-ordered schedule list for the season (highest priority first). The first block
 *     whose condition is definitely true wins. Blocks whose condition is UNKNOWN (missing
 *     inputs, random choices) before it are reported as alternative branches, never guessed.
 *     Blocks in the same variant group (e.g. Rain option 1/2) are random alternatives.
 *  6. Possible random Ginger Island resort visit, shown as a note when the resort is open.
 */
import type { Festival, ScheduleBlock, ScheduleStep, Villager } from '../data/types';
import { scheduleById, villagerById, festivals, checkups, placeName } from '../data';
import { evaluate, type EvalResult } from './conditions';
import type { GameContext } from './context';
import type { GameDate } from './calendar';
import { formatTime, type GameMinutes } from './time';
import { resolveFlag, FLAG_LABEL } from './progress';

export type Certainty = 'definite' | 'random' | 'possible';

export interface ScheduleBranch {
  block: ScheduleBlock;
  certainty: Certainty;
  /** why this block applies / might apply */
  why: string[];
  unknowns: string[];
}

export type ScheduleResolution =
  | { kind: 'stationary'; villager: Villager; note: string }
  | { kind: 'absent'; villager: Villager; note: string; certain: boolean }
  | { kind: 'festival'; villager: Villager; festival: Festival; note: string }
  | {
      kind: 'schedule';
      villager: Villager;
      branches: ScheduleBranch[];
      /** blocks considered and rejected, for the "why" panel */
      skipped: { block: ScheduleBlock; reasons: string[] }[];
      notes: string[];
      married: boolean;
    };

export function festivalOn(date: GameDate, kind?: 'main' | 'mini'): Festival | undefined {
  return festivals.find(
    (f) => f.season === date.season && date.day >= f.startDay && date.day <= f.endDay && (!kind || f.kind === kind),
  );
}

function evalBlock(block: ScheduleBlock, ctx: GameContext): EvalResult {
  return evaluate(block.condition, { date: ctx.date, weather: ctx.weather, time: null, progress: ctx.progress });
}

export function resolveVillagerSchedule(villagerId: string, ctx: GameContext): ScheduleResolution | null {
  const villager = villagerById.get(villagerId);
  if (!villager) return null;

  if (villager.stationary) return { kind: 'stationary', villager, note: villager.stationary };

  if (villager.availability?.requires) {
    const present = resolveFlag(villager.availability.requires, ctx.progress, ctx.date);
    if (present === false) return { kind: 'absent', villager, note: villager.availability.note, certain: true };
  }

  const mainFestival = festivalOn(ctx.date, 'main');
  if (mainFestival) {
    return {
      kind: 'festival',
      villager,
      festival: mainFestival,
      note: `Normal schedules pause for the ${mainFestival.name}. Villagers gather at ${placeName(mainFestival.place)} from ${formatTime(mainFestival.start)} to ${formatTime(mainFestival.end)}; before it starts they are usually at home.`,
    };
  }

  const sched = scheduleById.get(villagerId);
  const notes: string[] = [];
  if (villager.availability && !villager.availability.requires) notes.push(villager.availability.note);
  if (villager.availability?.requires && resolveFlag(villager.availability.requires, ctx.progress, ctx.date) === undefined)
    notes.push(`${villager.availability.note} (${FLAG_LABEL[villager.availability.requires]} not set.)`);

  const married = ctx.progress.spouse === villagerId;
  const pool = married && sched?.marriage.length ? sched.marriage : (sched?.blocks ?? []);
  if (married && !sched?.marriage.length) notes.push('Marriage routine not available for this villager; showing their single schedule.');
  if (!married && ctx.progress.spouse === undefined && villager.marriageable)
    notes.push('If you are married to them, they follow a spouse routine instead (set marriage in Progress).');

  const candidates = pool.filter((b) => b.season === 'any' || b.season === ctx.date.season);
  const branches: ScheduleBranch[] = [];
  const skipped: { block: ScheduleBlock; reasons: string[] }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const block = candidates[i]!;
    const res = evalBlock(block, ctx);
    if (res.value === false) {
      skipped.push({ block, reasons: res.unmet });
      continue;
    }
    // Gather a random variant group (consecutive blocks sharing variantGroup)
    if (block.variantGroup) {
      const group = [block];
      while (candidates[i + 1]?.variantGroup === block.variantGroup) group.push(candidates[++i]!);
      const allRandomOnly = res.unknowns.every((u) => /random/i.test(u));
      for (const g of group)
        branches.push({
          block: g,
          certainty: allRandomOnly ? 'random' : 'possible',
          why: [`Matches “${g.label}”`],
          unknowns: res.unknowns,
        });
      if (allRandomOnly) break; // the group as a whole is certain to apply
      continue;
    }
    if (res.value === true) {
      branches.push({ block, certainty: 'definite', why: [`Matches “${block.label}”`], unknowns: [] });
      break;
    }
    branches.push({ block, certainty: 'possible', why: [`Would apply if: ${res.unknowns.join('; ')}`], unknowns: res.unknowns });
  }

  // checkup today?
  const checkup = checkups.find((c) => c.villagerId === villagerId && c.season === ctx.date.season && c.day === ctx.date.day);
  if (checkup) notes.push(`Clinic check-up today (${formatTime(checkup.window.start)} – ${formatTime(checkup.window.end)}).`);

  const mini = festivalOn(ctx.date, 'mini');
  if (mini) notes.push(`${mini.name} today — some villagers visit it as part of their schedule.`);

  if (villager.resortVisitor && !checkup) {
    const resort = resolveFlag('resortOpen', ctx.progress, ctx.date);
    if (resort === true)
      notes.push('The Ginger Island resort is open, so they may randomly spend the day there instead (back home after 6 PM).');
  }

  if (!branches.length) notes.push('No listed schedule applies to this day in the data.');
  return { kind: 'schedule', villager, branches, skipped, notes, married };
}

export type LocationStatus = 'not-out-yet' | 'at' | 'travelling' | 'finished';

export interface Location {
  status: LocationStatus;
  step: ScheduleStep | null;
  next: ScheduleStep | null;
  place: string | null;
  from: string | null;
  sentence: string;
}

/** Where a schedule branch puts the villager at a time of day. */
export function locateAt(block: ScheduleBlock, time: GameMinutes, homePlace: string): Location {
  const steps = block.steps;
  let idx = -1;
  for (let i = 0; i < steps.length; i++) if (steps[i]!.time <= time) idx = i;
  if (idx === -1) {
    const first = steps[0] ?? null;
    return {
      status: 'not-out-yet',
      step: null,
      next: first,
      place: first?.kind === 'at' ? first.place : homePlace,
      from: null,
      sentence: first
        ? `Not out yet — schedule starts at ${formatTime(first.time)}. Usually at ${placeName(first.kind === 'at' ? first.place : homePlace)}.`
        : `At ${placeName(homePlace)}.`,
    };
  }
  const step = steps[idx]!;
  const next = steps[idx + 1] ?? null;
  if (step.kind === 'travel') {
    const prevPlace = steps
      .slice(0, idx)
      .reverse()
      .find((s) => s.place)?.place ?? homePlace;
    const dest = step.place;
    return {
      status: 'travelling',
      step,
      next,
      place: dest,
      from: prevPlace,
      sentence: `On the way${dest ? ` to ${placeName(dest)}` : ''} (left ${placeName(prevPlace)} at ${formatTime(step.time)}${
        next ? `; next listed at ${formatTime(next.time)}` : ''
      }). Exact walking route and arrival time are not known.`,
    };
  }
  return {
    status: 'at',
    step,
    next,
    place: step.place,
    from: null,
    sentence: `At ${placeName(step.place)}${next ? ` until about ${formatTime(next.time)}` : ''}.`,
  };
}

/** One-line answer for directory cards. */
export function summariseLocation(res: ScheduleResolution, time: GameMinutes | null): string {
  switch (res.kind) {
    case 'stationary':
      return res.note;
    case 'absent':
      return res.note;
    case 'festival':
      return `At the ${res.festival.name}`;
    case 'schedule': {
      if (!res.branches.length) return 'Schedule unknown for today';
      const home = res.villager.home;
      if (time === null) {
        const certain = res.branches.length === 1 && res.branches[0]!.certainty === 'definite';
        return certain ? `Schedule: ${res.branches[0]!.block.label}` : `${res.branches.length} possible routines today`;
      }
      const places = [...new Set(res.branches.map((b) => locateAt(b.block, time, home)).map((l) => (l.status === 'travelling' ? `→ ${placeName(l.place)}` : placeName(l.place))))];
      if (places.length === 1) return places[0]!;
      return `Either ${places.slice(0, -1).join(', ')} or ${places[places.length - 1]}`;
    }
  }
}
