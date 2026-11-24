/**
 * Villager schedule extraction from wiki "Schedule" sections.
 *
 * The wiki lists each villager's schedules per season "prioritized highest to lowest"
 * (or all-year when no season headers exist). We keep that order as precedence and
 * translate each schedule label into a typed Condition. Labels or qualifiers we cannot
 * translate become `unknown` conditions carrying the original text, so the resolver
 * shows them as an alternative branch with an explanation instead of guessing.
 */
import { cleanWikitext } from './wikitext';
import type { Condition } from '../../src/engine/conditions';
import { parseClock } from '../../src/engine/time';
import type { ScheduleBlock, ScheduleStep } from '../../src/data/types';
import { PLACES, VILLAGER_HOME } from '../../data-sources/curated/world';

type Season = 'spring' | 'summer' | 'fall' | 'winter';
const SEASON_NAMES: Season[] = ['spring', 'summer', 'fall', 'winter'];
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

export interface RawBlock {
  labels: string[];
  season: Season | 'any' | 'marriage';
  rows: { time: string; text: string; links: string[] }[];
}

/** Tokenise a schedule section into labelled tables. */
export function extractRawBlocks(sectionText: string): RawBlock[] {
  const lines = sectionText.split('\n');
  let season: RawBlock['season'] = 'any';
  const blocks: RawBlock[] = [];
  let pendingLabels: string[] = [];
  type Table = { label: string | null; rows: RawBlock['rows']; cur: string[] | null };
  const stack: Table[] = [];

  const flushRow = (t: Table) => {
    if (!t.cur || t.cur.length === 0) return;
    const joined = t.cur.join('\n');
    t.cur = null;
    // cells separated by || on one line or by newlines beginning with |
    const cells = joined
      .split(/\|\||\n\|/)
      .map((c) => c.replace(/^\|/, '').replace(/^\s*style="[^"]*"\s*\|/, '').trim())
      .filter((c) => c.length > 0);
    if (cells.length < 2) return;
    const time = cells[0]!.trim();
    if (!/^(\d{1,2}(:\d{2})?\s*[ap]\.?m\.?|all day)/i.test(time)) return;
    const { text, links } = cleanWikitext(cells.slice(1).join(' '));
    t.rows.push({ time, text, links });
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const header = /\{\{ScheduleHeader\|([^}|]+)/.exec(line);
    if (header) {
      const h = header[1]!.trim().toLowerCase();
      season = (SEASON_NAMES as string[]).includes(h) ? (h as Season) : h === 'marriage' ? 'marriage' : 'any';
      pendingLabels = [];
      continue;
    }
    if (/^===?\s*[^=]+===?\s*$/.test(line)) {
      const h = line.replace(/=/g, '').trim().toLowerCase();
      if ((SEASON_NAMES as string[]).includes(h)) season = h as Season;
      else if (h.includes('marriage')) season = 'marriage';
      continue;
    }
    if (line.startsWith('{|')) {
      stack.push({ label: null, rows: [], cur: null });
      continue;
    }
    const top = stack[stack.length - 1];
    if (line.startsWith('|}')) {
      if (top) {
        flushRow(top);
        stack.pop();
        if (top.rows.length > 0) {
          const labels = top.label ? [top.label] : pendingLabels;
          blocks.push({ labels: labels.length ? labels : ['Regular Schedule'], season, rows: top.rows });
          pendingLabels = [];
        }
      }
      continue;
    }
    const bold = /^(?:<br\s*\/?>)?\s*'''(.+?)'''\s*$/.exec(line.trim());
    if (bold && (!top || top.rows.length === 0)) {
      pendingLabels.push(cleanWikitext(bold[1]!).text);
      continue;
    }
    if (!top) continue;
    const colHeader = /^!\s*colspan="?2"?\s*\|\s*(.+)$/.exec(line);
    if (colHeader) {
      top.label = cleanWikitext(colHeader[1]!).text;
      continue;
    }
    if (line.startsWith('!')) continue;
    if (line.startsWith('|-')) {
      flushRow(top);
      top.cur = [];
      continue;
    }
    if (line.startsWith('|')) {
      if (!top.cur) top.cur = [];
      top.cur.push(line);
      continue;
    }
    if (top.cur && top.cur.length) top.cur[top.cur.length - 1] += ` ${line}`;
  }
  return blocks;
}

// ---------- label → condition ----------

const NPC_NAMES = Object.keys(VILLAGER_HOME);

function seasonDates(text: string, season: Season | null): Condition | null {
  // "Spring 15, 16 and 17" / "11 and 25" / "Spring 11"
  const m = /^(spring|summer|fall|winter)?\s*(\d{1,2}(?:\s*(?:,|and|&)\s*\d{1,2})*)(?:st|nd|rd|th)?$/i.exec(text.trim());
  if (!m) return null;
  const s = (m[1]?.toLowerCase() as Season | undefined) ?? season;
  const days = m[2]!.split(/,|and|&/).map((d) => Number(d.trim())).filter((d) => d >= 1 && d <= 28);
  if (!days.length) return null;
  const dayCond: Condition = { kind: 'dayOfMonth', in: days };
  return s ? { kind: 'all', of: [{ kind: 'season', in: [s] }, dayCond] } : dayCond;
}

function weekdayList(text: string): Condition | null {
  const parts = text.toLowerCase().split(/,|\band\b|&|\//).map((p) => p.trim().replace(/s$/, '')).filter(Boolean);
  if (!parts.length) return null;
  if (!parts.every((p) => (WEEKDAYS as readonly string[]).includes(p))) return null;
  return { kind: 'weekday', in: parts as (typeof WEEKDAYS)[number][] };
}

function heartsQualifier(q: string, villagerId: string): Condition | null {
  const lower = q.toLowerCase();
  const n = /(\d+)\s*\+?\s*hearts?/.exec(lower);
  if (!n) return null;
  const hearts = Number(n[1]);
  const named = NPC_NAMES.find((name) => new RegExp(`\\b${name}\\b`).test(lower)) ?? villagerId;
  if (/\b(no player|less than|under|fewer than|below|not)\b/.test(lower)) return { kind: 'hearts', npc: named, max: hearts - 1 };
  return { kind: 'hearts', npc: named, min: hearts };
}

export interface ParsedLabel {
  condition: Condition;
  variantGroup?: string;
  unparsed: string[];
}

const FESTIVAL_DATES: Record<string, Condition> = {
  'desert festival': { kind: 'dateRange', season: 'spring', from: 15, to: 17 },
  'night market': { kind: 'dateRange', season: 'winter', from: 15, to: 17 },
  'trout derby': { kind: 'dateRange', season: 'summer', from: 20, to: 21 },
  squidfest: { kind: 'dateRange', season: 'winter', from: 12, to: 13 },
};

/** Translate a single wiki schedule label in a season section into a condition. */
export function parseLabel(label: string, sectionSeason: Season | 'any', villagerId: string): ParsedLabel {
  const unparsed: string[] = [];
  const conds: Condition[] = [];
  let variantGroup: string | undefined;
  const quals = [...label.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim());
  let main = label.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  main = main.replace(/[:.]$/, '').trim();
  const lower = main.toLowerCase();
  const season = sectionSeason === 'any' ? null : sectionSeason;

  // ----- main part -----
  if (/^(regular|default|normal|standard)( schedule)?$/.test(lower) || lower === 'regular schedule' || lower === '') {
    // no condition
  } else if (/^(rain|rainy|rainy days?|rain schedule)$/.test(lower)) {
    conds.push({ kind: 'raining', value: true });
  } else if (/^green rain$/.test(lower)) {
    conds.push({ kind: 'weather', in: ['green-rain'] });
  } else if (/^(sunny|non-rainy|not raining)( days?)?$/.test(lower)) {
    conds.push({ kind: 'raining', value: false });
  } else if (FESTIVAL_DATES[lower]) {
    conds.push(FESTIVAL_DATES[lower]!);
  } else if ((SEASON_NAMES as string[]).includes(lower)) {
    conds.push({ kind: 'season', in: [lower as Season] });
  } else if (/^(spring|summer|fall|winter)\s+(rain|rainy days?)$/.test(lower)) {
    conds.push({ kind: 'season', in: [lower.split(' ')[0] as Season] }, { kind: 'raining', value: true });
  } else if (/^(spring|summer|fall|winter)\s+(.+)$/.test(lower) && weekdayList(lower.replace(/^\S+\s+/, ''))) {
    conds.push({ kind: 'season', in: [lower.split(' ')[0] as Season] }, weekdayList(lower.replace(/^\S+\s+/, ''))!);
  } else if (/^community cent(er|re) (restored|complete)$/.test(lower)) {
    conds.push({ kind: 'flag', flag: 'communityCenterComplete', value: true });
  } else if (/^(\w+day)\s*-\s*(\w+day)$/.test(lower)) {
    const [a, b] = lower.split(/\s*-\s*/) as [string, string];
    const ia = WEEKDAYS.indexOf(a as (typeof WEEKDAYS)[number]);
    const ib = WEEKDAYS.indexOf(b as (typeof WEEKDAYS)[number]);
    if (ia >= 0 && ib >= ia) conds.push({ kind: 'weekday', in: WEEKDAYS.slice(ia, ib + 1) });
    else unparsed.push(main);
  } else if (/\brain\b/.test(lower) && weekdayList(lower.replace(/\brain\b/, '').replace(/(,|\band\b|&)\s*$/, '').replace(/^\s*(,|\band\b|&)/, ''))) {
    // "Friday, Saturday and Rain" / "Rain and Thursday" → either applies
    const wd = weekdayList(lower.replace(/\brain\b/, '').replace(/(,|\band\b|&)\s*$/, '').replace(/^\s*(,|\band\b|&)/, ''))!;
    conds.push({ kind: 'any', of: [wd, { kind: 'raining', value: true }] });
  } else if (/^((monday|tuesday|wednesday|thursday|friday|saturday|sunday)s? the \d{1,2}(st|nd|rd|th)?(\s*(,|and|&)\s*)?)+$/.test(lower)) {
    // "Tuesday the 9th and Tuesday the 23rd" — the weekday is implied by the date
    const days = [...lower.matchAll(/the (\d{1,2})/g)].map((m) => Number(m[1]));
    conds.push({ kind: 'dayOfMonth', in: days });
  } else {
    const dates = seasonDates(main, season);
    const wd = weekdayList(main);
    if (dates) conds.push(dates);
    else if (wd) conds.push(wd);
    else {
      // e.g. "Marriage", "Married", other prose
      unparsed.push(main);
    }
  }

  // ----- qualifiers -----
  for (const q of quals) {
    const ql = q.toLowerCase();
    const opt = /^option\s*(\d+)$/.exec(ql);
    if (opt) {
      variantGroup = `${sectionSeason}:${lower}`;
      continue;
    }
    if (/bus service restored|bus (is )?repaired|bus restored/.test(ql)) conds.push({ kind: 'flag', flag: 'busRepaired', value: true });
    else if (/railroad (accessible|open)|after the railroad/.test(ql)) conds.push({ kind: 'flag', flag: 'railroadOpen', value: true });
    else if (/^year\s*1$/.test(ql) || /first year/.test(ql)) conds.push({ kind: 'year', max: 1 });
    else if (/year\s*2\s*(\+|and (later|after|beyond)|onward)|after year 1|year 2 or later/.test(ql)) conds.push({ kind: 'year', min: 2 });
    else if (/as vendor/.test(ql)) conds.push({ kind: 'random', note: 'Only if chosen as a Desert Festival vendor (random each day)' });
    else if (/community cent(er|re) (not|isn't|is not|un)\s*restored|before .*community cent/.test(ql)) conds.push({ kind: 'flag', flag: 'communityCenterComplete', value: false });
    else if (/^all seasons$/.test(ql)) {
      /* informational */
    } else if (/no bus service|bus (not|isn't) (repaired|restored)/.test(ql)) conds.push({ kind: 'flag', flag: 'busRepaired', value: false });
    else if (/beach bridge (repaired|fixed)/.test(ql)) conds.push({ kind: 'flag', flag: 'beachBridge', value: true });
    else if (/community cent(er|re) (restored|complete|repaired)|after .*community cent/.test(ql)) conds.push({ kind: 'flag', flag: 'communityCenterComplete', value: true });
    else if (/joja/.test(ql)) conds.push({ kind: 'flag', flag: 'jojaRoute', value: true });
    else if (/movie theat/.test(ql)) conds.push({ kind: 'flag', flag: 'movieTheater', value: true });
    else if (/kent/.test(ql) && /(before|not)/.test(ql)) conds.push({ kind: 'flag', flag: 'kentHome', value: false });
    else if (/kent/.test(ql)) conds.push({ kind: 'flag', flag: 'kentHome', value: true });
    else if (/heart/.test(ql) && heartsQualifier(q, villagerId)) conds.push(heartsQualifier(q, villagerId)!);
    else if (/^rain(y)?$/.test(ql)) conds.push({ kind: 'raining', value: true });
    else if (/^(not raining|sunny|no rain)$/.test(ql)) conds.push({ kind: 'raining', value: false });
    else if (/checkup|appointment/.test(ql)) {
      /* informational */
    } else unparsed.push(q);
  }

  if (variantGroup) conds.push({ kind: 'random', note: 'The game picks one of these routines at random each morning' });
  for (const u of unparsed) conds.push({ kind: 'unknown', note: `Condition not modelled: “${u}”` });
  if (season && !conds.some((c) => c.kind === 'season' || (c.kind === 'all' && c.of.some((x) => x.kind === 'season')) || c.kind === 'dateRange'))
    conds.unshift({ kind: 'season', in: [season] });
  const condition: Condition = conds.length === 0 ? { kind: 'all', of: [] } : conds.length === 1 ? conds[0]! : { kind: 'all', of: conds };
  return { condition, variantGroup, unparsed };
}

// ---------- step → place ----------

const aliasIndex = PLACES.flatMap((p) => p.aliases.map((a) => ({ alias: a, id: p.id }))).sort((a, b) => b.alias.length - a.alias.length);
aliasIndex.push({ alias: 'night market', id: 'pier' });

const HOME_WORDS = /\b(his|her|their) (own )?(room|bed|bedroom|house|home|computer|desk|kitchen|living room|couch|trailer|cabin|shop|counter|garden|writing desk|bonsai tree)\b|\bhome\b|\bin bed\b|\bbedroom\b|\bkitchen\b|\bliving room\b|\bcomputer\b|\bto bed\b|\bgoes to sleep\b|\b(leaves|leaving) (the )?(room|house)\b|\bthe counter\b|\bthe aisles\b|\bwatch tv\b/i;
const TRAVEL = /^(leaves|leaving|heads|heading|walks|walking|goes|going|boards|board|travels|returns|returning|takes|exits|gets out of bed and (leaves|walks|heads|goes)|leave|walk|head)\b/i;

function findPlaces(text: string, villagerId: string): { pos: number; id: string }[] {
  const lower = text.toLowerCase();
  const hits: { pos: number; id: string }[] = [];
  const taken: [number, number][] = [];
  for (const { alias, id } of aliasIndex) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower))) {
      const start = m.index;
      const end = start + alias.length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      hits.push({ pos: start, id });
    }
  }
  // "<Name>'s room/house"
  for (const m of lower.replace(/’/g, "'").matchAll(/\b([a-z]+)'s (room|house|home|bedroom|trailer)\b/g)) {
    const home = VILLAGER_HOME[m[1]!];
    if (home && !taken.some(([a, b]) => m.index! < b && m.index! + m[0].length > a)) hits.push({ pos: m.index!, id: home });
  }
  // "Follows Sam to his room" — the room belongs to the person followed
  for (const m of lower.matchAll(/\b(?:follows|with|joins|visits?) ([a-z]+) (?:to|in|into) (?:his|her|their) (room|house|home|bedroom)\b/g)) {
    const home = VILLAGER_HOME[m[1]!];
    if (home) {
      hits.push({ pos: m.index!, id: home });
      taken.push([m.index!, m.index! + m[0].length]);
    }
  }
  const homeMatch = HOME_WORDS.exec(text);
  if (homeMatch && VILLAGER_HOME[villagerId]) {
    const pos = homeMatch.index;
    if (!taken.some(([a, b]) => pos < b && pos + homeMatch[0].length > a)) hits.push({ pos, id: VILLAGER_HOME[villagerId]! });
  }
  return hits.sort((a, b) => a.pos - b.pos);
}

export function interpretSteps(rows: RawBlock['rows'], villagerId: string): ScheduleStep[] {
  const steps: ScheduleStep[] = [];
  let prev: string | null = VILLAGER_HOME[villagerId] ?? null;
  for (const row of rows) {
    const time = /all day/i.test(row.time) ? 360 : parseClock(row.time.replace(/\s+/g, ' ').match(/\d{1,2}(:\d{2})?\s*[ap]\.?m\.?/i)?.[0] ?? '');
    if (time === null) continue;
    const text = row.text;
    const travel = TRAVEL.test(text.trim());
    let place: string | null = null;
    let inferred = false;
    if (travel) {
      const idx = text.search(/\b(to|for|towards|toward)\b/i);
      const segment = idx >= 0 ? text.slice(idx) : text;
      const hits = findPlaces(segment, villagerId);
      place = hits[0]?.id ?? findPlaces(text, villagerId).slice(-1)[0]?.id ?? null;
    } else {
      const hits = findPlaces(text, villagerId);
      place = hits[0]?.id ?? null;
      if (!place) {
        place = prev;
        inferred = place !== null;
      }
    }
    steps.push({ time, text, place, kind: travel ? 'travel' : 'at', ...(inferred ? { inferred } : {}) });
    if (place) prev = place;
  }
  return steps.sort((a, b) => a.time - b.time);
}

export function buildBlocks(raw: RawBlock[], villagerId: string): { blocks: ScheduleBlock[]; marriage: ScheduleBlock[]; warnings: string[] } {
  const blocks: ScheduleBlock[] = [];
  const marriage: ScheduleBlock[] = [];
  const warnings: string[] = [];
  let n = 0;
  for (const rb of raw) {
    const steps = interpretSteps(rb.rows, villagerId);
    if (!steps.length) continue;
    const season = rb.season === 'marriage' ? 'any' : rb.season;
    const parsed = rb.labels.map((l) => parseLabel(l, season, villagerId));
    const condition: Condition =
      parsed.length === 1 ? parsed[0]!.condition : { kind: 'any', of: parsed.map((p) => p.condition) };
    const unparsed = parsed.flatMap((p) => p.unparsed);
    const block: ScheduleBlock = {
      id: `${villagerId}-${++n}`,
      label: rb.labels.join(' / '),
      season,
      condition,
      ...(parsed[0]?.variantGroup ? { variantGroup: parsed[0].variantGroup } : {}),
      ...(unparsed.length ? { unparsed } : {}),
      steps,
    };
    if (rb.season === 'marriage') marriage.push(block);
    else blocks.push(block);
    for (const u of unparsed) warnings.push(`${villagerId}: label not modelled “${u}” in “${block.label}”`);
    for (const s of steps) if (s.place === null) warnings.push(`${villagerId}: no place for step “${s.text}”`);
  }
  return { blocks, marriage, warnings };
}
