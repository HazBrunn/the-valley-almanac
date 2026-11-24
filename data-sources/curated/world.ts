/**
 * Curated world data: map regions & places (original schematic coordinates), villager
 * homes, festivals, shops and other dated systems for Stardew Valley 1.6.15.
 *
 * Evidence: Stardew Valley Wiki raw snapshot (data-sources/wiki/raw, 2026-11-24) — festival
 * pages, shop infoboxes (openhours/closed), Traveling Cart, Bookseller, Weather pages.
 * Map coordinates are an ORIGINAL schematic layout (0–1000 × 0–700), not game tiles.
 */

export type RegionId =
  | 'farm'
  | 'bus-stop'
  | 'town'
  | 'forest'
  | 'beach'
  | 'mountain'
  | 'railroad'
  | 'backwoods'
  | 'quarry'
  | 'secret-woods'
  | 'sewers'
  | 'desert'
  | 'island'
  | 'witchs-swamp'
  | 'mines';

export interface CuratedRegion {
  id: RegionId;
  name: string;
  /** schematic polygon centre + label anchor */
  x: number;
  y: number;
  offMap?: boolean;
  description: string;
  requires?: string;
}

export const REGIONS: CuratedRegion[] = [
  { id: 'farm', name: 'Your Farm', x: 170, y: 250, description: 'Home sweet home. Layout depends on the farm map you chose.' },
  { id: 'bus-stop', name: 'Bus Stop', x: 360, y: 245, description: 'Connects the farm to town. The bus to the Desert leaves here once repaired.' },
  { id: 'town', name: 'Pelican Town', x: 585, y: 345, description: 'Shops, homes, the Saloon, the clinic and the town square.' },
  { id: 'forest', name: 'Cindersap Forest', x: 255, y: 500, description: "Marnie's Ranch, Leah's cottage, the Wizard's Tower, a river and a pond." },
  { id: 'beach', name: 'The Beach', x: 610, y: 635, description: "Willy's Fish Shop, Elliott's cabin, the piers and tide pools." },
  { id: 'mountain', name: 'The Mountain', x: 700, y: 140, description: "Robin's Carpenter's Shop, the mountain lake, the Mines and the Adventurer's Guild." },
  { id: 'railroad', name: 'Railroad', x: 560, y: 40, description: 'Opens after the earthquake on Summer 3, Year 1. The Spa is here.', requires: 'railroadOpen' },
  { id: 'backwoods', name: 'Backwoods', x: 300, y: 110, description: 'The path from the farm up to the mountain.' },
  { id: 'quarry', name: 'Quarry', x: 925, y: 140, description: 'East of the mountain, across the bridge (repaired via the Community Center or Joja).' },
  { id: 'secret-woods', name: 'Secret Woods', x: 85, y: 440, description: 'Hidden behind a large log in Cindersap Forest (needs a Steel Axe).', requires: 'secretWoods' },
  { id: 'sewers', name: 'The Sewers', x: 690, y: 500, description: "Krobus' shop. Entered through the grate south of town with the Rusty Key.", requires: 'sewersAccess' },
  { id: 'mines', name: 'The Mines', x: 790, y: 95, description: 'Entrance on the mountain, east of the lake.' },
  { id: 'desert', name: 'Calico Desert', x: 45, y: 215, offMap: true, description: 'Reached by bus once repaired. The Oasis, Casino and Skull Cavern.', requires: 'busRepaired' },
  { id: 'witchs-swamp', name: "Witch's Swamp", x: 470, y: 30, offMap: true, description: "Reached through the Witch's Hut, beyond the Railroad.", requires: 'witchsSwamp' },
  { id: 'island', name: 'Ginger Island', x: 950, y: 655, offMap: true, description: "Reached by Willy's boat once it is repaired.", requires: 'islandAccess' },
];

export interface CuratedPlace {
  id: string;
  name: string;
  region: RegionId;
  x: number;
  y: number;
  kind: 'shop' | 'home' | 'building' | 'outdoor' | 'water' | 'service';
  /** wiki link targets and keywords that refer to this place (lower-case) */
  aliases: string[];
}

export const PLACES: CuratedPlace[] = [
  // Town
  { id: 'pierres', name: "Pierre's General Store", region: 'town', x: 545, y: 295, kind: 'shop', aliases: ["pierre's general store", "pierre's", 'general store', 'seed shop'] },
  { id: 'clinic', name: "Harvey's Clinic", region: 'town', x: 490, y: 295, kind: 'service', aliases: ["harvey's clinic", 'clinic', 'medical clinic', 'exam room', 'examination room', 'waiting room', 'waiting area', 'sales counter'] },
  { id: 'saloon', name: 'The Stardrop Saloon', region: 'town', x: 590, y: 350, kind: 'shop', aliases: ['the stardrop saloon', 'stardrop saloon', 'saloon', 'arcade', 'the bar', 'tend the bar'] },
  { id: 'community-center', name: 'Community Center', region: 'town', x: 575, y: 225, kind: 'building', aliases: ['community center', 'community centre'] },
  { id: 'jojamart', name: 'JojaMart', region: 'town', x: 760, y: 300, kind: 'shop', aliases: ['jojamart', 'joja mart', 'movie theater', 'movie theatre', 'joja warehouse'] },
  { id: 'museum', name: 'Museum & Library', region: 'town', x: 745, y: 430, kind: 'service', aliases: ['museum', 'library', 'archaeology office'] },
  { id: 'blacksmith', name: 'Blacksmith', region: 'town', x: 710, y: 395, kind: 'shop', aliases: ['blacksmith', "clint's"] },
  { id: 'manor', name: "Mayor's Manor", region: 'town', x: 505, y: 430, kind: 'home', aliases: ["mayor's manor", "lewis' house", "lewis's house", 'manor'] },
  { id: 'willow-1', name: '1 Willow Lane', region: 'town', x: 455, y: 375, kind: 'home', aliases: ['1 willow lane', "sam's house", "jodi's house"] },
  { id: 'willow-2', name: '2 Willow Lane', region: 'town', x: 455, y: 335, kind: 'home', aliases: ['2 willow lane', "haley and emily's house", "emily's house", "haley's house"] },
  { id: 'river-road', name: '1 River Road', region: 'town', x: 520, y: 365, kind: 'home', aliases: ['1 river road', "george's house", "alex's house", "evelyn's house", 'dog kennel', "grandparent's house", "grandparents' house"] },
  { id: 'trailer', name: 'Trailer', region: 'town', x: 625, y: 395, kind: 'home', aliases: ['trailer', "pam's trailer", "penny's trailer"] },
  { id: 'town-square', name: 'Town Square', region: 'town', x: 575, y: 315, kind: 'outdoor', aliases: ['town square', 'square', 'fountain', 'pelican town', 'in town', 'around town'] },
  { id: 'graveyard', name: 'Graveyard', region: 'town', x: 655, y: 345, kind: 'outdoor', aliases: ['graveyard', 'cemetery', 'grave'] },
  { id: 'playground', name: 'Playground', region: 'town', x: 455, y: 470, kind: 'outdoor', aliases: ['playground', 'swing'] },
  { id: 'ice-cream', name: 'Ice Cream Stand', region: 'town', x: 790, y: 430, kind: 'shop', aliases: ['ice cream stand', 'ice cream'] },
  { id: 'bookseller', name: 'Bookseller', region: 'town', x: 760, y: 265, kind: 'shop', aliases: ['bookseller'] },
  { id: 'town-river', name: 'Town river', region: 'town', x: 760, y: 360, kind: 'water', aliases: ['river', 'bridge'] },
  // Mountain
  { id: 'carpenter', name: "Carpenter's Shop (24 Mountain Road)", region: 'mountain', x: 600, y: 150, kind: 'shop', aliases: ["carpenter's shop", '24 mountain road', "robin's", 'science house', 'laboratory', 'lab', 'visit robin'] },
  { id: 'mountain-lake', name: 'Mountain lake', region: 'mountain', x: 705, y: 175, kind: 'water', aliases: ['lake', 'mountain lake', 'the mountain', 'treehouse'] },
  { id: 'guild', name: "Adventurer's Guild", region: 'mountain', x: 845, y: 120, kind: 'shop', aliases: ["adventurer's guild", 'guild'] },
  { id: 'tent', name: "Linus' Tent", region: 'mountain', x: 660, y: 95, kind: 'home', aliases: ['tent', "linus' tent", "linus's tent"] },
  { id: 'mines-entrance', name: 'Mines entrance', region: 'mines', x: 790, y: 95, kind: 'outdoor', aliases: ['the mines', 'mines'] },
  // Railroad
  { id: 'spa', name: 'Spa (Bath House)', region: 'railroad', x: 610, y: 45, kind: 'building', aliases: ['spa', 'bath house', 'bathhouse', 'locker room'] },
  { id: 'train-station', name: 'Train platform', region: 'railroad', x: 520, y: 55, kind: 'outdoor', aliases: ['railroad', 'train station', 'train platform', 'tunnel', 'railroad tracks'] },
  // Forest
  { id: 'ranch', name: "Marnie's Ranch", region: 'forest', x: 320, y: 420, kind: 'shop', aliases: ["marnie's ranch", 'ranch', "marnie's"] },
  { id: 'leah-cottage', name: "Leah's Cottage", region: 'forest', x: 390, y: 470, kind: 'home', aliases: ["leah's cottage", 'cottage'] },
  { id: 'wizard-tower', name: "Wizard's Tower", region: 'forest', x: 165, y: 540, kind: 'shop', aliases: ["wizard's tower", 'tower'] },
  { id: 'forest-pond', name: 'Forest pond', region: 'forest', x: 235, y: 455, kind: 'water', aliases: ['pond'] },
  { id: 'forest-river', name: 'Forest river', region: 'forest', x: 300, y: 590, kind: 'water', aliases: ['forest river'] },
  { id: 'traveling-cart', name: 'Traveling Cart spot', region: 'forest', x: 230, y: 395, kind: 'shop', aliases: ['traveling cart'] },
  { id: 'hat-mouse', name: 'Abandoned House (Hat Mouse)', region: 'forest', x: 160, y: 620, kind: 'shop', aliases: ['abandoned house', 'hat mouse'] },
  // Beach
  { id: 'fish-shop', name: "Willy's Fish Shop", region: 'beach', x: 660, y: 600, kind: 'shop', aliases: ['fish shop', "willy's fish shop", "willy's shop"] },
  { id: 'elliott-cabin', name: "Elliott's Cabin", region: 'beach', x: 520, y: 605, kind: 'home', aliases: ["elliott's cabin", "elliott's house", 'cabin'] },
  { id: 'pier', name: 'Beach piers', region: 'beach', x: 760, y: 655, kind: 'outdoor', aliases: ['pier', 'dock', 'docks', 'the beach', 'beach', 'tide pools', 'ocean'] },
  // Other
  { id: 'sewers-place', name: "Krobus' Shop", region: 'sewers', x: 690, y: 500, kind: 'shop', aliases: ['sewers', 'the sewers', "krobus' shop"] },
  { id: 'bus', name: 'Bus Stop', region: 'bus-stop', x: 360, y: 245, kind: 'outdoor', aliases: ['bus stop', 'bus'] },
  { id: 'desert-place', name: 'Calico Desert', region: 'desert', x: 45, y: 215, kind: 'outdoor', aliases: ['the desert', 'calico desert', 'desert', 'oasis', 'desert festival', 'skull cavern', 'casino', 'outfit services', 'sand dragon'] },
  { id: 'island-resort', name: 'Ginger Island Resort', region: 'island', x: 950, y: 655, kind: 'outdoor', aliases: ['ginger island', 'beach resort', 'resort', 'island', 'gem bird shrine', 'jungle', 'hut'] },
  { id: 'farm-place', name: 'Your Farm', region: 'farm', x: 170, y: 250, kind: 'outdoor', aliases: ['the farm', 'farm', "player's farm", 'farmhouse'] },
  { id: 'secret-woods-place', name: 'Secret Woods', region: 'secret-woods', x: 85, y: 440, kind: 'outdoor', aliases: ['secret woods'] },
  { id: 'backwoods-place', name: 'Backwoods', region: 'backwoods', x: 300, y: 110, kind: 'outdoor', aliases: ['backwoods'] },
];

/** Villager id → home place id, plus the region their pronoun-rooms belong to. */
export const VILLAGER_HOME: Record<string, string> = {
  abigail: 'pierres',
  alex: 'river-road',
  caroline: 'pierres',
  clint: 'blacksmith',
  demetrius: 'carpenter',
  dwarf: 'mines-entrance',
  elliott: 'elliott-cabin',
  emily: 'willow-2',
  evelyn: 'river-road',
  george: 'river-road',
  gus: 'saloon',
  haley: 'willow-2',
  harvey: 'clinic',
  jas: 'ranch',
  jodi: 'willow-1',
  kent: 'willow-1',
  krobus: 'sewers-place',
  leah: 'leah-cottage',
  leo: 'island-resort',
  lewis: 'manor',
  linus: 'tent',
  marnie: 'ranch',
  maru: 'carpenter',
  pam: 'trailer',
  penny: 'trailer',
  pierre: 'pierres',
  robin: 'carpenter',
  sam: 'willow-1',
  sandy: 'desert-place',
  sebastian: 'carpenter',
  shane: 'ranch',
  vincent: 'willow-1',
  willy: 'fish-shop',
  wizard: 'wizard-tower',
};

/** Villagers who only appear from a given point (spoiler/unlock-aware directory). */
export const VILLAGER_AVAILABILITY: Record<string, { requires?: string; note: string; spoiler?: boolean }> = {
  kent: { requires: 'kentHome', note: 'Kent returns home on Spring 1, Year 2.' },
  krobus: { requires: 'sewersAccess', note: 'Met in the Sewers after obtaining the Rusty Key.' },
  dwarf: { note: 'Behind boulders in the Mines entrance until you have a Copper Pickaxe… or similar access.' },
  leo: { requires: 'islandAccess', note: 'Lives on Ginger Island.', spoiler: true },
  sandy: { requires: 'busRepaired', note: 'Lives at the Oasis in the Calico Desert.' },
};

export interface CuratedFestival {
  id: string;
  name: string;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  startDay: number;
  endDay: number;
  /** clock strings */
  start: string;
  end: string;
  place: string;
  region: RegionId;
  /** Main festivals pause the normal day: villagers attend, town shops close. */
  kind: 'main' | 'mini';
  requires?: string;
  description: string;
}

export const FESTIVALS: CuratedFestival[] = [
  { id: 'egg-festival', name: 'Egg Festival', season: 'spring', startDay: 13, endDay: 13, start: '9am', end: '2pm', place: 'town-square', region: 'town', kind: 'main', description: 'Egg hunt in the town square; Pierre sells Strawberry Seeds.' },
  { id: 'desert-festival', name: 'Desert Festival', season: 'spring', startDay: 15, endDay: 17, start: '10am', end: '2am', place: 'desert-place', region: 'desert', kind: 'mini', requires: 'busRepaired', description: 'Three-day festival in the Calico Desert with villager shops and Calico Eggs. Requires the bus.' },
  { id: 'flower-dance', name: 'Flower Dance', season: 'spring', startDay: 24, endDay: 24, start: '9am', end: '2pm', place: 'forest-river', region: 'forest', kind: 'main', description: 'Dance in the forest clearing; you need 4 hearts to ask a partner.' },
  { id: 'luau', name: 'Luau', season: 'summer', startDay: 11, endDay: 11, start: '9am', end: '2pm', place: 'pier', region: 'beach', kind: 'main', description: 'Add an item to the communal soup at the beach.' },
  { id: 'trout-derby', name: 'Trout Derby', season: 'summer', startDay: 20, endDay: 21, start: '6:10am', end: '2am', place: 'forest-river', region: 'forest', kind: 'mini', description: 'Fishing mini-festival by the forest river: Rainbow Trout can be caught all day in any weather.' },
  { id: 'moonlight-jellies', name: 'Dance of the Moonlight Jellies', season: 'summer', startDay: 28, endDay: 28, start: '10pm', end: '12am', place: 'pier', region: 'beach', kind: 'main', description: 'Watch the jellies from the docks at night.' },
  { id: 'fair', name: 'Stardew Valley Fair', season: 'fall', startDay: 16, endDay: 16, start: '9am', end: '3pm', place: 'town-square', region: 'town', kind: 'main', description: 'Grange display, games and Star Tokens in town.' },
  { id: 'spirits-eve', name: "Spirit's Eve", season: 'fall', startDay: 27, endDay: 27, start: '10pm', end: '11:50pm', place: 'town-square', region: 'town', kind: 'main', description: 'A spooky night maze in town; the Golden Pumpkin is at the end.' },
  { id: 'festival-of-ice', name: 'Festival of Ice', season: 'winter', startDay: 8, endDay: 8, start: '9am', end: '2pm', place: 'forest-river', region: 'forest', kind: 'main', description: 'Ice fishing contest in Cindersap Forest.' },
  { id: 'squidfest', name: 'SquidFest', season: 'winter', startDay: 12, endDay: 13, start: '6:10am', end: '2am', place: 'pier', region: 'beach', kind: 'mini', description: 'Squid can be caught all day at the beach; prize tiers each day.' },
  { id: 'night-market', name: 'Night Market', season: 'winter', startDay: 15, endDay: 17, start: '5pm', end: '2am', place: 'pier', region: 'beach', kind: 'mini', description: 'Boats at the beach docks, the deep-sea submarine ride and the Traveling Cart.' },
  { id: 'winter-star', name: 'Feast of the Winter Star', season: 'winter', startDay: 25, endDay: 25, start: '9am', end: '2pm', place: 'town-square', region: 'town', kind: 'main', description: 'Secret gift exchange in town. Your recipient is revealed on Winter 18.' },
];

export interface CuratedShop {
  id: string;
  name: string;
  place: string;
  owner?: string;
  /** service hours */
  open: string;
  close: string;
  /** building hours if different from service */
  buildingOpen?: string;
  buildingClose?: string;
  closedWeekdays?: string[];
  /** extra structured closure rules */
  exceptions?: ShopException[];
  seasons?: string[];
  requires?: string;
  closedOnMainFestivals?: boolean;
  sells: string;
  notes?: string[];
}

export type ShopException =
  | { kind: 'closedWeekdayUnlessFlag'; weekday: string; flag: string; note: string }
  | { kind: 'closedWeekdayIfFlag'; weekday: string; flag: string; note: string }
  | { kind: 'closedIfFlag'; flag: string; note: string }
  | { kind: 'closedWeekdayUnlessRain'; weekday: string; note: string }
  | { kind: 'closedWhenRaining'; note: string }
  | { kind: 'earlyCloseWeekday'; weekday: string; close: string; note: string }
  | { kind: 'closedDates'; season: string; days: number[]; from?: string; note: string };

export const SHOPS: CuratedShop[] = [
  {
    id: 'pierres', name: "Pierre's General Store", place: 'pierres', owner: 'pierre', open: '9am', close: '5pm', buildingOpen: '9am', buildingClose: '9pm',
    exceptions: [{ kind: 'closedWeekdayUnlessFlag', weekday: 'wednesday', flag: 'communityCenterComplete', note: 'Closed Wednesdays until the Community Center is restored.' }],
    closedOnMainFestivals: true, sells: 'Seeds, saplings, fertiliser, cooking ingredients and backpack upgrades.',
  },
  {
    id: 'blacksmith', name: 'Blacksmith', place: 'blacksmith', owner: 'clint', open: '9am', close: '4pm',
    exceptions: [
      { kind: 'closedWeekdayIfFlag', weekday: 'friday', flag: 'communityCenterComplete', note: 'Closed Fridays after the Community Center is restored.' },
      { kind: 'closedDates', season: 'winter', days: [16], from: '10:30am', note: 'Closes at 10:30 AM on Winter 16 (Clint goes to the Night Market).' },
    ],
    closedOnMainFestivals: true, sells: 'Ore, coal, geode processing and tool upgrades.',
  },
  {
    id: 'carpenter', name: "Carpenter's Shop", place: 'carpenter', owner: 'robin', open: '9am', close: '5pm', closedWeekdays: ['tuesday'],
    exceptions: [{ kind: 'earlyCloseWeekday', weekday: 'friday', close: '4pm', note: 'Closes at 4 PM on Fridays.' }],
    closedOnMainFestivals: true, sells: 'Wood, stone, farm buildings and house upgrades.',
  },
  {
    id: 'ranch', name: "Marnie's Ranch", place: 'ranch', owner: 'marnie', open: '9am', close: '4pm', buildingOpen: '9am', buildingClose: '6pm', closedWeekdays: ['monday', 'tuesday'],
    closedOnMainFestivals: true, sells: 'Animals, hay, animal supplies.', notes: ['On Monday and Tuesday the building stays open but Marnie is not at the counter.'],
  },
  {
    id: 'fish-shop', name: "Willy's Fish Shop", place: 'fish-shop', owner: 'willy', open: '9am', close: '5pm',
    exceptions: [{ kind: 'closedWeekdayUnlessRain', weekday: 'saturday', note: 'No sales on non-rainy Saturdays (the building stays open).' }],
    closedOnMainFestivals: true, sells: 'Rods, bait, tackle and crab pots.',
  },
  { id: 'saloon', name: 'The Stardrop Saloon', place: 'saloon', owner: 'gus', open: '12pm', close: '12am', closedOnMainFestivals: true, sells: 'Food, drink and recipes.' },
  {
    id: 'jojamart', name: 'JojaMart', place: 'jojamart', owner: 'morris', open: '9am', close: '11pm',
    exceptions: [{ kind: 'closedIfFlag', flag: 'communityCenterComplete', note: 'Closes permanently once the Community Center is restored.' }],
    closedOnMainFestivals: true, sells: 'Seeds and Joja Cola at a markup; Joja membership.',
  },
  { id: 'museum', name: 'Museum & Library', place: 'museum', owner: 'gunther', open: '8am', close: '6pm', closedOnMainFestivals: true, sells: 'Donations, artifact rewards and geode cracking.' },
  { id: 'clinic', name: "Harvey's Clinic", place: 'clinic', owner: 'harvey', open: '9am', close: '3pm', closedOnMainFestivals: true, sells: 'Energy Tonic and Muscle Remedy.' },
  { id: 'wizard', name: "Wizard's Tower", place: 'wizard-tower', owner: 'wizard', open: '6am', close: '11pm', sells: 'Magical buildings (after the right quests).' },
  { id: 'guild', name: "Adventurer's Guild", place: 'guild', owner: 'marlon', open: '2pm', close: '2am', sells: 'Weapons, boots, rings and item recovery.' },
  { id: 'ice-cream', name: 'Ice Cream Stand', place: 'ice-cream', owner: 'alex', open: '1pm', close: '5pm', seasons: ['summer'], closedWeekdays: ['wednesday'], exceptions: [{ kind: 'closedWhenRaining', note: 'Closed on rainy days.' }], sells: 'Ice cream (Summer only).' },
  { id: 'krobus', name: "Krobus' Shop", place: 'sewers-place', owner: 'krobus', open: '6am', close: '2am', requires: 'sewersAccess', sells: 'Rare items, Void Eggs and more.' },
  { id: 'oasis', name: 'Oasis', place: 'desert-place', owner: 'sandy', open: '9am', close: '11:50pm', requires: 'busRepaired',
    exceptions: [
      { kind: 'closedDates', season: 'spring', days: [15, 16, 17], note: 'Closed during the Desert Festival.' },
      { kind: 'closedDates', season: 'fall', days: [15], from: '1pm', note: "Closed after 1 PM on Fall 15 (Sandy's birthday)." },
    ],
    sells: 'Desert seeds and clothing.',
  },
  { id: 'casino', name: 'Casino', place: 'desert-place', owner: 'mr-qi', open: '9am', close: '11:50pm', requires: 'busRepaired', notes: ['Requires the Club Card.'], sells: 'Qi Coin games and prizes.' },
  { id: 'desert-trader', name: 'Desert Trader', place: 'desert-place', open: '6am', close: '2am', requires: 'busRepaired', exceptions: [{ kind: 'closedDates', season: 'winter', days: [15, 16, 17], note: 'At the Night Market on Winter 15–17.' }], sells: 'Barters that rotate by weekday.' },
  {
    id: 'traveling-cart', name: 'Traveling Cart', place: 'traveling-cart', open: '6am', close: '8pm',
    closedWeekdays: ['monday', 'tuesday', 'wednesday', 'thursday', 'saturday'],
    sells: 'Ten random items plus furniture; stock changes every visit.',
    notes: ['Also at the Night Market (Winter 15–17, 5 PM–2 AM) and the Desert Festival (Spring 15–17, 12 PM–2 AM).'],
  },
];

export const BERRY_WINDOWS = [
  { id: 'salmonberry', name: 'Salmonberry season', item: 'Salmonberry', season: 'spring' as const, from: 15, to: 18, region: 'forest' as RegionId, note: 'Salmonberry bushes across the Valley can be shaken for berries.' },
  { id: 'blackberry', name: 'Blackberry season', item: 'Blackberry', season: 'fall' as const, from: 8, to: 11, region: 'forest' as RegionId, note: 'Blackberry bushes across the Valley can be shaken for berries.' },
];

/** Weekly TV schedule (Television wiki page). */
export const TV_CHANNELS = [
  { id: 'weather', name: 'Weather Report', days: 'daily', note: "Shows tomorrow's weather. Enter it as tomorrow's forecast here." },
  { id: 'fortune', name: 'Fortune Teller', days: 'daily', note: "Today's luck — random, so the Almanac cannot predict it." },
  { id: 'land', name: "Livin' Off The Land", days: ['monday', 'thursday'], note: 'Farming and foraging tips.' },
  { id: 'qos', name: 'The Queen of Sauce', days: ['sunday', 'wednesday'], note: 'Sunday: new recipe on a fixed 2-year rotation. Wednesday: a random rerun.' },
];
