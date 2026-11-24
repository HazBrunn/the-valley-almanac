/**
 * Curated fish acquisition rules for Stardew Valley 1.6.15 (vanilla).
 *
 * Each entry in `rules` is ONE conjunction of conditions: every listed area × every listed
 * season × the weather × the time windows. Location-dependent exceptions are separate rules,
 * so e.g. Catfish in the Secret Woods during Summer never leaks into the town river.
 *
 * Evidence: Stardew Valley Wiki fish infoboxes + article intros (raw wikitext snapshot in
 * data-sources/wiki/raw/<Fish>.wiki, retrieved 2026-11-24, CC BY-NC-SA 3.0). Base stats
 * (price, difficulty, description) come from stardew-valley-data (MIT).
 *
 * Time strings use the wiki's convention ("6am-7pm", "any"); end times are exclusive.
 * weather: 'rain' (rain/storm/green rain), 'dry' (sun/wind/snow), 'any'.
 */

export type FishArea =
  | 'ocean'
  | 'river-town'
  | 'river-forest'
  | 'mountain-lake'
  | 'forest-pond'
  | 'forest-waterfalls'
  | 'secret-woods'
  | 'sewers'
  | 'mutant-bug-lair'
  | 'witchs-swamp'
  | 'desert'
  | 'mines-20'
  | 'mines-60'
  | 'mines-100'
  | 'volcano'
  | 'submarine'
  | 'island-ocean'
  | 'island-freshwater'
  | 'pirate-cove';

export type SeasonName = 'spring' | 'summer' | 'fall' | 'winter';
const ALL: SeasonName[] = ['spring', 'summer', 'fall', 'winter'];
const RIVERS: FishArea[] = ['river-town', 'river-forest'];

export interface CuratedRule {
  areas: FishArea[];
  seasons: SeasonName[];
  weather: 'rain' | 'dry' | 'any';
  /** e.g. ['6am-7pm'] or ['any'] */
  time: string[];
  /** Day-of-season range restriction (festivals) */
  days?: [number, number];
  minLevel?: number;
  /** Weather is judged by Ginger Island's own weather. */
  islandWeather?: boolean;
  /** Required progress flag (see src/engine/progress.ts) */
  requires?: string[];
  spot?: string;
  note?: string;
  /** e.g. 'Trout Derby' — marks festival-only rules */
  event?: string;
}

export interface CuratedFish {
  name: string;
  method: 'rod' | 'crab-pot';
  legendary?: 'legendary' | 'legendary-2';
  rules: CuratedRule[];
  notes?: string[];
}

const islandOcean = (time: string[], weather: CuratedRule['weather'] = 'any'): CuratedRule => ({
  areas: ['island-ocean', 'pirate-cove'],
  seasons: ALL,
  weather,
  time,
  islandWeather: true,
  requires: ['islandAccess'],
  note: 'Ginger Island waters ignore the season; time and weather rules still apply (island weather).',
});

const islandFresh = (time: string[], weather: CuratedRule['weather'] = 'any'): CuratedRule => ({
  areas: ['island-freshwater'],
  seasons: ALL,
  weather,
  time,
  islandWeather: true,
  requires: ['islandAccess'],
  note: 'Ginger Island North and West (freshwater) ignore the season.',
});

const submarine = (note: string): CuratedRule => ({
  areas: ['submarine'],
  seasons: ['winter'],
  days: [15, 17],
  weather: 'any',
  time: ['5pm-2am'],
  event: 'Night Market',
  note,
});

const crab = (name: string, water: 'ocean' | 'freshwater'): CuratedFish => ({
  name,
  method: 'crab-pot',
  rules: [
    {
      areas:
        water === 'ocean'
          ? ['ocean', 'island-ocean']
          : ['river-town', 'river-forest', 'mountain-lake', 'forest-pond', 'secret-woods', 'island-freshwater'],
      seasons: ALL,
      weather: 'any',
      time: ['any'],
      note: `Crab pot in ${water === 'ocean' ? 'ocean' : 'fresh'} water (checked overnight; needs Bait unless you are a Mariner).`,
    },
  ],
});

export const CURATED_FISH: CuratedFish[] = [
  {
    name: 'Pufferfish',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ['summer'], weather: 'dry', time: ['12pm-4pm'] }, islandOcean(['12pm-4pm'], 'dry')],
  },
  { name: 'Anchovy', method: 'rod', rules: [{ areas: ['ocean'], seasons: ['spring', 'fall'], weather: 'any', time: ['any'] }] },
  {
    name: 'Tuna',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ['summer', 'winter'], weather: 'any', time: ['6am-7pm'] }, islandOcean(['6am-7pm'])],
  },
  { name: 'Sardine', method: 'rod', rules: [{ areas: ['ocean'], seasons: ['spring', 'fall', 'winter'], weather: 'any', time: ['6am-7pm'] }] },
  { name: 'Bream', method: 'rod', rules: [{ areas: RIVERS, seasons: ALL, weather: 'any', time: ['6pm-2am'] }] },
  { name: 'Largemouth Bass', method: 'rod', rules: [{ areas: ['mountain-lake'], seasons: ALL, weather: 'any', time: ['6am-7pm'] }] },
  {
    name: 'Smallmouth Bass',
    method: 'rod',
    rules: [{ areas: ['river-town', 'forest-pond'], seasons: ['spring', 'fall'], weather: 'any', time: ['any'] }],
  },
  {
    name: 'Rainbow Trout',
    method: 'rod',
    rules: [
      { areas: [...RIVERS, 'mountain-lake'], seasons: ['summer'], weather: 'dry', time: ['6am-7pm'] },
      {
        areas: ['river-forest', 'forest-pond'],
        seasons: ['summer'],
        days: [20, 21],
        weather: 'any',
        time: ['any'],
        event: 'Trout Derby',
        note: 'During the Trout Derby (Summer 20–21) it can be caught all day in Cindersap Forest in any weather.',
      },
    ],
  },
  {
    name: 'Salmon',
    method: 'rod',
    rules: [
      { areas: RIVERS, seasons: ['fall'], weather: 'any', time: ['6am-7pm'] },
      { areas: ['forest-waterfalls'], seasons: ['fall'], weather: 'any', time: ['any'], note: 'Any time at the southern Cindersap Forest waterfalls.' },
    ],
  },
  {
    name: 'Walleye',
    method: 'rod',
    rules: [
      { areas: [...RIVERS, 'mountain-lake', 'forest-pond'], seasons: ['fall'], weather: 'rain', time: ['12pm-2am'] },
      {
        areas: [...RIVERS, 'mountain-lake', 'forest-pond'],
        seasons: ['winter'],
        weather: 'rain',
        time: ['12pm-2am'],
        note: 'Winter only with a Rain Totem — it never rains naturally in winter.',
      },
    ],
  },
  { name: 'Perch', method: 'rod', rules: [{ areas: [...RIVERS, 'mountain-lake', 'forest-pond'], seasons: ['winter'], weather: 'any', time: ['any'] }] },
  {
    name: 'Carp',
    method: 'rod',
    rules: [
      { areas: ['mountain-lake'], seasons: ['spring', 'summer', 'fall'], weather: 'any', time: ['any'] },
      { areas: ['secret-woods', 'sewers', 'mutant-bug-lair'], seasons: ALL, weather: 'any', time: ['any'] },
    ],
  },
  {
    name: 'Catfish',
    method: 'rod',
    rules: [
      { areas: RIVERS, seasons: ['spring', 'fall'], weather: 'rain', time: ['6am-12am'] },
      { areas: ['secret-woods', 'witchs-swamp'], seasons: ['spring', 'summer', 'fall'], weather: 'rain', time: ['6am-12am'] },
      {
        areas: [...RIVERS, 'secret-woods', 'witchs-swamp'],
        seasons: ['winter'],
        weather: 'rain',
        time: ['6am-12am'],
        note: 'Winter only with a Rain Totem — it never rains naturally in winter.',
      },
    ],
  },
  { name: 'Pike', method: 'rod', rules: [{ areas: [...RIVERS, 'forest-pond'], seasons: ['summer', 'winter'], weather: 'any', time: ['any'] }] },
  { name: 'Sunfish', method: 'rod', rules: [{ areas: RIVERS, seasons: ['spring', 'summer'], weather: 'dry', time: ['6am-7pm'] }] },
  { name: 'Red Mullet', method: 'rod', rules: [{ areas: ['ocean'], seasons: ['summer', 'winter'], weather: 'any', time: ['6am-7pm'] }] },
  { name: 'Herring', method: 'rod', rules: [{ areas: ['ocean'], seasons: ['spring', 'winter'], weather: 'any', time: ['any'] }] },
  { name: 'Eel', method: 'rod', rules: [{ areas: ['ocean'], seasons: ['spring', 'fall'], weather: 'rain', time: ['4pm-2am'] }] },
  {
    name: 'Octopus',
    method: 'rod',
    rules: [
      { areas: ['ocean'], seasons: ['summer'], weather: 'any', time: ['6am-1pm'] },
      { ...islandOcean(['6am-1pm']), areas: ['island-ocean'], note: 'Ginger Island West (ocean) in any season.' },
      submarine('About a 2% chance per catch during the Night Market submarine ride.'),
    ],
  },
  {
    name: 'Red Snapper',
    method: 'rod',
    rules: [
      { areas: ['ocean'], seasons: ['summer', 'fall'], weather: 'rain', time: ['6am-7pm'] },
      { areas: ['ocean'], seasons: ['winter'], weather: 'rain', time: ['6am-7pm'], note: 'Winter only with a Rain Totem.' },
    ],
  },
  {
    name: 'Squid',
    method: 'rod',
    rules: [
      { areas: ['ocean'], seasons: ['winter'], weather: 'any', time: ['6pm-2am'] },
      { areas: ['ocean'], seasons: ['winter'], days: [12, 13], weather: 'any', time: ['any'], event: 'SquidFest', note: 'Any time during SquidFest (Winter 12–13).' },
    ],
  },
  {
    name: 'Seaweed',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ALL, weather: 'any', time: ['any'], note: 'Also found as beach forage.' }],
  },
  {
    name: 'Green Algae',
    method: 'rod',
    rules: [
      {
        areas: [...RIVERS, 'mountain-lake', 'forest-pond', 'secret-woods', 'island-freshwater'],
        seasons: ALL,
        weather: 'any',
        time: ['any'],
        note: 'Fresh water almost everywhere (not the ocean).',
      },
    ],
  },
  {
    name: 'Sea Cucumber',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ['fall', 'winter'], weather: 'any', time: ['6am-7pm'] }, submarine('Also during the Night Market submarine ride.')],
  },
  {
    name: 'Super Cucumber',
    method: 'rod',
    rules: [
      { areas: ['ocean'], seasons: ['summer', 'fall'], weather: 'any', time: ['6pm-2am'] },
      islandOcean(['6pm-2am']),
      submarine('About a 4% chance per catch during the Night Market submarine ride.'),
    ],
  },
  { name: 'Ghostfish', method: 'rod', rules: [{ areas: ['mines-20', 'mines-60'], seasons: ALL, weather: 'any', time: ['any'] }] },
  {
    name: 'White Algae',
    method: 'rod',
    rules: [{ areas: ['mines-20', 'mines-60', 'sewers', 'mutant-bug-lair', 'witchs-swamp'], seasons: ALL, weather: 'any', time: ['any'] }],
  },
  { name: 'Stonefish', method: 'rod', rules: [{ areas: ['mines-20'], seasons: ALL, weather: 'any', time: ['any'] }] },
  {
    name: 'Crimsonfish',
    method: 'rod',
    legendary: 'legendary',
    rules: [{ areas: ['ocean'], seasons: ['summer'], weather: 'any', time: ['any'], minLevel: 5, spot: 'End of the eastern pier at the Beach' }],
    notes: ['Legendary: can only be caught once per save file.'],
  },
  {
    name: 'Angler',
    method: 'rod',
    legendary: 'legendary',
    rules: [{ areas: ['river-town'], seasons: ['fall'], weather: 'any', time: ['any'], minLevel: 3, spot: 'Wooden plank bridge north of JojaMart' }],
    notes: ['Legendary: can only be caught once per save file.'],
  },
  { name: 'Ice Pip', method: 'rod', rules: [{ areas: ['mines-60'], seasons: ALL, weather: 'any', time: ['any'] }] },
  { name: 'Lava Eel', method: 'rod', rules: [{ areas: ['mines-100', 'volcano'], seasons: ALL, weather: 'any', time: ['any'] }] },
  {
    name: 'Legend',
    method: 'rod',
    legendary: 'legendary',
    rules: [{ areas: ['mountain-lake'], seasons: ['spring'], weather: 'rain', time: ['any'], minLevel: 10, spot: 'Near the log on the far side of the mountain lake' }],
    notes: ['Legendary: can only be caught once per save file.'],
  },
  {
    name: 'Sandfish',
    method: 'rod',
    rules: [{ areas: ['desert'], seasons: ALL, weather: 'any', time: ['6am-8pm'], requires: ['busRepaired'] }],
  },
  {
    name: 'Scorpion Carp',
    method: 'rod',
    rules: [{ areas: ['desert'], seasons: ALL, weather: 'any', time: ['6am-8pm'], requires: ['busRepaired'] }],
  },
  {
    name: 'Flounder',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ['spring', 'summer'], weather: 'any', time: ['6am-8pm'] }, islandOcean(['6am-8pm'])],
  },
  {
    name: 'Midnight Carp',
    method: 'rod',
    rules: [{ areas: ['mountain-lake', 'forest-pond'], seasons: ['fall', 'winter'], weather: 'any', time: ['10pm-2am'] }, islandFresh(['10pm-2am'])],
  },
  crab('Clam', 'ocean'),
  {
    name: 'Mutant Carp',
    method: 'rod',
    legendary: 'legendary',
    rules: [{ areas: ['sewers'], seasons: ALL, weather: 'any', time: ['any'], requires: ['sewersAccess'] }],
    notes: ['Legendary: can only be caught once per save file. No level requirement; ~10% chance per cast in the Sewers.'],
  },
  { name: 'Sturgeon', method: 'rod', rules: [{ areas: ['mountain-lake'], seasons: ['summer', 'winter'], weather: 'any', time: ['6am-7pm'] }] },
  { name: 'Tiger Trout', method: 'rod', rules: [{ areas: RIVERS, seasons: ['fall', 'winter'], weather: 'any', time: ['6am-7pm'] }] },
  { name: 'Bullhead', method: 'rod', rules: [{ areas: ['mountain-lake'], seasons: ALL, weather: 'any', time: ['any'] }] },
  {
    name: 'Tilapia',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ['summer', 'fall'], weather: 'any', time: ['6am-2pm'] }, islandFresh(['6am-2pm'])],
  },
  { name: 'Chub', method: 'rod', rules: [{ areas: ['mountain-lake', 'river-forest'], seasons: ALL, weather: 'any', time: ['any'] }] },
  { name: 'Dorado', method: 'rod', rules: [{ areas: ['river-forest'], seasons: ['summer'], weather: 'any', time: ['6am-7pm'] }] },
  { name: 'Albacore', method: 'rod', rules: [{ areas: ['ocean'], seasons: ['fall', 'winter'], weather: 'any', time: ['6am-11am', '6pm-2am'] }] },
  { name: 'Shad', method: 'rod', rules: [{ areas: RIVERS, seasons: ['spring', 'summer', 'fall'], weather: 'rain', time: ['9am-2am'] }] },
  { name: 'Lingcod', method: 'rod', rules: [{ areas: [...RIVERS, 'mountain-lake'], seasons: ['winter'], weather: 'any', time: ['any'] }] },
  {
    name: 'Halibut',
    method: 'rod',
    rules: [{ areas: ['ocean'], seasons: ['spring', 'summer', 'winter'], weather: 'any', time: ['6am-11am', '7pm-2am'] }],
  },
  crab('Lobster', 'ocean'),
  crab('Crayfish', 'freshwater'),
  crab('Crab', 'ocean'),
  crab('Cockle', 'ocean'),
  crab('Mussel', 'ocean'),
  crab('Shrimp', 'ocean'),
  crab('Snail', 'freshwater'),
  crab('Periwinkle', 'freshwater'),
  crab('Oyster', 'ocean'),
  {
    name: 'Woodskip',
    method: 'rod',
    rules: [{ areas: ['secret-woods'], seasons: ALL, weather: 'any', time: ['any'], requires: ['secretWoods'] }],
    notes: ['Also caught in the ponds on the Forest Farm.'],
  },
  {
    name: 'Glacierfish',
    method: 'rod',
    legendary: 'legendary',
    rules: [{ areas: ['river-forest'], seasons: ['winter'], weather: 'any', time: ['any'], minLevel: 6, spot: 'Southern tip of Arrowhead Island, Cindersap Forest river' }],
    notes: ['Legendary: can only be caught once per save file.'],
  },
  {
    name: 'Void Salmon',
    method: 'rod',
    rules: [{ areas: ['witchs-swamp'], seasons: ALL, weather: 'any', time: ['any'], requires: ['witchsSwamp'] }],
  },
  {
    name: 'Slimejack',
    method: 'rod',
    rules: [{ areas: ['mutant-bug-lair'], seasons: ALL, weather: 'any', time: ['any'], requires: ['mutantBugLair'] }],
  },
  { name: 'Midnight Squid', method: 'rod', rules: [submarine('Night Market submarine ride only.')] },
  { name: 'Spook Fish', method: 'rod', rules: [submarine('Night Market submarine ride only.')] },
  { name: 'Blobfish', method: 'rod', rules: [submarine('Night Market submarine ride only.')] },
  {
    name: 'Stingray',
    method: 'rod',
    rules: [{ areas: ['pirate-cove'], seasons: ALL, weather: 'any', time: ['any'], requires: ['islandAccess'] }],
  },
  {
    name: 'Lionfish',
    method: 'rod',
    rules: [{ areas: ['island-ocean'], seasons: ALL, weather: 'any', time: ['any'], requires: ['islandAccess'] }],
  },
  {
    name: 'Blue Discus',
    method: 'rod',
    rules: [{ areas: ['island-freshwater'], seasons: ALL, weather: 'any', time: ['any'], requires: ['islandAccess'] }],
  },
  {
    name: 'Son of Crimsonfish',
    method: 'rod',
    legendary: 'legendary-2',
    rules: [{ areas: ['ocean'], seasons: ALL, weather: 'any', time: ['any'], minLevel: 5, requires: ['qiExtendedFamily'], spot: 'End of the eastern pier at the Beach' }],
    notes: ["Only while Mr. Qi's Extended Family quest is active."],
  },
  {
    name: 'Ms. Angler',
    method: 'rod',
    legendary: 'legendary-2',
    rules: [{ areas: ['river-town'], seasons: ALL, weather: 'any', time: ['any'], minLevel: 3, requires: ['qiExtendedFamily'], spot: 'Wooden plank bridge north of JojaMart' }],
    notes: ["Only while Mr. Qi's Extended Family quest is active."],
  },
  {
    name: 'Legend II',
    method: 'rod',
    legendary: 'legendary-2',
    rules: [{ areas: ['mountain-lake'], seasons: ALL, weather: 'any', time: ['any'], minLevel: 10, requires: ['qiExtendedFamily'] }],
    notes: ["Only while Mr. Qi's Extended Family quest is active."],
  },
  {
    name: 'Radioactive Carp',
    method: 'rod',
    legendary: 'legendary-2',
    rules: [{ areas: ['sewers'], seasons: ALL, weather: 'any', time: ['any'], requires: ['qiExtendedFamily', 'sewersAccess'] }],
    notes: ["Only while Mr. Qi's Extended Family quest is active."],
  },
  {
    name: 'Glacierfish Jr.',
    method: 'rod',
    legendary: 'legendary-2',
    rules: [{ areas: ['river-forest'], seasons: ALL, weather: 'any', time: ['any'], minLevel: 6, requires: ['qiExtendedFamily'], spot: 'Southern tip of Arrowhead Island' }],
    notes: ["Only while Mr. Qi's Extended Family quest is active."],
  },
  {
    name: 'Goby',
    method: 'rod',
    rules: [{ areas: ['forest-waterfalls'], seasons: ALL, weather: 'any', time: ['any'], note: 'Waterfalls just east of the Abandoned House.' }],
  },
  {
    name: 'Sea Jelly',
    method: 'rod',
    rules: [
      { areas: ['ocean', 'island-ocean', 'pirate-cove'], seasons: ALL, weather: 'any', time: ['any'], note: 'Rare; Luck buffs raise the chance.' },
      submarine('Also during the Night Market submarine ride.'),
    ],
  },
  {
    name: 'River Jelly',
    method: 'rod',
    rules: [
      {
        areas: [...RIVERS, 'mountain-lake', 'forest-pond', 'desert', 'secret-woods', 'island-freshwater'],
        seasons: ALL,
        weather: 'any',
        time: ['any'],
        note: 'Rare; Luck buffs raise the chance.',
      },
    ],
  },
  {
    name: 'Cave Jelly',
    method: 'rod',
    rules: [{ areas: ['mines-20', 'mines-60', 'mines-100'], seasons: ALL, weather: 'any', time: ['any'], note: 'Rare; Luck buffs raise the chance.' }],
  },
];
