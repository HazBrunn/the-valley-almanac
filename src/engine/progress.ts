/**
 * Player progress inputs. Every field is optional: `undefined` means "not entered" and
 * produces `unknown` in the rules engine rather than an assumed answer.
 */
import { type GameDate, compareDates } from './calendar';

export const PROGRESS_FLAGS = [
  'railroadOpen',
  'busRepaired',
  'communityCenterComplete',
  'jojaRoute',
  'secretWoods',
  'sewersAccess',
  'witchsSwamp',
  'mutantBugLair',
  'islandAccess',
  'resortOpen',
  'movieTheater',
  'kentHome',
  'qiExtendedFamily',
  'skullKey',
  'beachBridge',
] as const;
export type ProgressFlag = (typeof PROGRESS_FLAGS)[number];

export const FLAG_LABEL: Record<ProgressFlag, string> = {
  railroadOpen: 'Railroad open (after the Summer 3, Year 1 earthquake)',
  busRepaired: 'Bus to the Desert repaired',
  communityCenterComplete: 'Community Center restored',
  jojaRoute: 'Joja membership route',
  secretWoods: 'Secret Woods reachable (Steel Axe)',
  sewersAccess: 'Sewers unlocked (Rusty Key)',
  witchsSwamp: "Witch's Swamp reachable",
  mutantBugLair: 'Mutant Bug Lair reachable',
  islandAccess: "Ginger Island reachable (Willy's boat repaired)",
  resortOpen: 'Ginger Island Beach Resort open',
  movieTheater: 'Movie Theater open',
  kentHome: 'Kent has returned home (Year 2+)',
  qiExtendedFamily: "Mr. Qi's Extended Family quest active",
  skullKey: 'Skull Key found',
  beachBridge: 'Beach bridge to the tide pools repaired',
};

/** Short help shown next to each toggle in settings. */
export const FLAG_HELP: Partial<Record<ProgressFlag, string>> = {
  railroadOpen: 'Set automatically from the date: the earthquake opens the railroad on Summer 3, Year 1.',
  kentHome: 'Set automatically: Kent returns on Spring 1, Year 2.',
  qiExtendedFamily: 'Needed for the second-generation legendary fish.',
};

export type FarmType =
  | 'standard'
  | 'riverland'
  | 'forest'
  | 'hilltop'
  | 'wilderness'
  | 'four-corners'
  | 'beach'
  | 'meadowlands';

export const FARM_LABEL: Record<FarmType, string> = {
  standard: 'Standard',
  riverland: 'Riverland',
  forest: 'Forest',
  hilltop: 'Hill-top',
  wilderness: 'Wilderness',
  'four-corners': 'Four Corners',
  beach: 'Beach',
  meadowlands: 'Meadowlands',
};

export interface PlayerProgress {
  flags: Partial<Record<ProgressFlag, boolean>>;
  /** Heart level per villager id (0–14). Missing = not entered. */
  hearts: Record<string, number>;
  /** villager id, null = definitely unmarried, undefined = not entered */
  spouse?: string | null;
  fishingLevel?: number;
  farmType?: FarmType;
  bundleMode?: 'standard' | 'remixed';
}

export const EMPTY_PROGRESS: PlayerProgress = { flags: {}, hearts: {} };

/**
 * Resolve a flag, deriving it from the date where the game makes it deterministic.
 * Returns undefined when unknown.
 */
export function resolveFlag(flag: ProgressFlag, progress: PlayerProgress, date: GameDate): boolean | undefined {
  switch (flag) {
    case 'railroadOpen':
      return compareDates(date, { year: 1, season: 'summer', day: 3 }) >= 0;
    case 'kentHome':
      return date.year >= 2;
    case 'communityCenterComplete':
    case 'jojaRoute': {
      const v = progress.flags[flag];
      return v;
    }
    case 'resortOpen': {
      const v = progress.flags.resortOpen;
      if (v === undefined && progress.flags.islandAccess === false) return false;
      return v;
    }
    case 'witchsSwamp':
    case 'mutantBugLair': {
      const v = progress.flags[flag];
      if (v === undefined && progress.flags.sewersAccess === false && flag === 'mutantBugLair') return false;
      return v;
    }
    default:
      return progress.flags[flag];
  }
}
