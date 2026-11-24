import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fishAreas, placeById } from '../data';
import { useStore } from '../state/store';
import { ContextBar } from '../ui/DayControls';
import { Empty, FishBadge, SubNav } from '../ui/common';
import { FishGlyph } from '../ui/icons';
import { glyphShape } from '../ui/fishShape';
import { FishTimeline, timelineRows } from '../ui/FishTimeline';
import { ValleyMap, type MapMarker } from '../ui/ValleyMap';
import { resolveAllFish, resolveAreaFish, describeNext, type FishResult, bestStatus, activeAreas } from '../engine/fish';
import { formatWindows } from '../engine/time';
import { bundleNeeds } from '../engine/collections';
import { norm } from '../engine/search';
import { resolveFlag } from '../engine/progress';
import { WEATHER_LABEL } from '../engine/weather';
import { SEASON_LABEL } from '../engine/calendar';

/** Map anchor for each fishing area (schematic coordinates). */
export const AREA_ANCHOR: Record<string, { x: number; y: number }> = {
  ocean: { x: 690, y: 655 },
  'river-town': placeById.get('town-river') ?? { x: 760, y: 360 },
  'river-forest': placeById.get('forest-river') ?? { x: 300, y: 590 },
  'mountain-lake': placeById.get('mountain-lake') ?? { x: 705, y: 175 },
  'forest-pond': placeById.get('forest-pond') ?? { x: 235, y: 455 },
  'forest-waterfalls': { x: 205, y: 655 },
  'secret-woods': { x: 85, y: 440 },
  sewers: { x: 700, y: 548 },
  'mutant-bug-lair': { x: 730, y: 560 },
  'witchs-swamp': { x: 360, y: 28 },
  desert: { x: 45, y: 215 },
  'mines-20': { x: 790, y: 95 },
  'mines-60': { x: 815, y: 80 },
  'mines-100': { x: 840, y: 65 },
  volcano: { x: 930, y: 640 },
  submarine: { x: 760, y: 690 },
  'island-ocean': { x: 950, y: 655 },
  'island-freshwater': { x: 965, y: 620 },
  'pirate-cove': { x: 985, y: 680 },
};

type Filter = 'catchable' | 'all' | 'season' | 'missing' | 'watched' | 'bundles' | 'rain' | 'crab' | 'legendary';

function FishRow({ r, caught, bundles }: { r: FishResult; caught: boolean; bundles?: string[] }) {
  const rule = (r.activeRules.find((a) => a.day === true) ?? r.activeRules[0])?.rule ?? r.fish.rules[0];
  return (
    <li>
      <Link className="item" to={`/fish/${r.fish.id}`} style={{ opacity: caught && r.status === 'unavailable' ? 0.75 : 1 }}>
        <FishGlyph color={r.fish.color} shape={glyphShape(r.fish.id)} />
        <span className="grow">
          <span className="item-title">{r.fish.name}</span> <FishBadge status={r.status} /> {caught && <span className="badge">✓ Caught</span>}
          {bundles && bundles.length > 0 && <span className="badge later">🧺 {bundles[0]}</span>}
          <span className="item-sub" style={{ display: 'block' }}>
            {r.status === 'unavailable' || r.status === 'earlier'
              ? `${r.reasons[0] ?? ''}${r.next ? ` · ${describeNext(r.next)}` : ''}`
              : r.status === 'conditional'
                ? `If ${r.unknowns.slice(0, 2).join('; ').toLowerCase()}`
                : rule
                  ? `${activeAreas(r).map((a) => fishAreas.find((x) => x.id === a)?.name ?? a).slice(0, 3).join(', ')} · ${formatWindows(rule.windows)}`
                  : ''}
          </span>
        </span>
      </Link>
    </li>
  );
}

export default function FishPages({ view }: { view: 'list' | 'timeline' | 'locations' }) {
  const { ctx, profile } = useStore();
  const [params, setParams] = useSearchParams();
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };
  const q = params.get('q') ?? '';
  const filter = (params.get('filter') as Filter) ?? (view === 'list' ? 'catchable' : 'all');
  const area = params.get('area') ?? '';
  const sort = params.get('sort') ?? 'status';
  const [cursor, setCursor] = useState<number>(ctx.time ?? 12 * 60);
  const [wrongWeather, setWrongWeather] = useState(true);

  const caught = profile.collections.fishCaught;
  const needs = useMemo(() => bundleNeeds(profile), [profile]);
  const watched = useMemo(() => new Set(profile.watchlist.filter((w) => w.kind === 'fish' && !w.done).map((w) => w.ref)), [profile.watchlist]);
  const spoilers = profile.prefs.spoilers === 'show';

  const results = useMemo(() => resolveAllFish(ctx, area ? { area } : {}).filter((r) => (area ? r.fish.rules.some((x) => x.areas.includes(area)) : true)), [ctx, area]);
  const filtered = useMemo(() => {
    let rs = results.filter((r) => spoilers || r.fish.legendary !== 'legendary-2' || resolveFlag('qiExtendedFamily', ctx.progress, ctx.date));
    if (q) rs = rs.filter((r) => norm(r.fish.name).includes(norm(q)));
    switch (filter) {
      case 'catchable':
        rs = rs.filter((r) => ['now', 'later', 'today', 'conditional'].includes(r.status));
        break;
      case 'season':
        rs = rs.filter((r) => r.fish.rules.some((x) => x.seasons.includes(ctx.date.season) && !x.days));
        break;
      case 'missing':
        rs = rs.filter((r) => !caught[r.fish.id]);
        break;
      case 'watched':
        rs = rs.filter((r) => watched.has(r.fish.id));
        break;
      case 'bundles':
        rs = rs.filter((r) => needs.has(`fish:${r.fish.id}`));
        break;
      case 'rain':
        rs = rs.filter((r) => r.fish.rules.some((x) => x.weather === 'rain'));
        break;
      case 'crab':
        rs = rs.filter((r) => r.fish.method === 'crab-pot');
        break;
      case 'legendary':
        rs = rs.filter((r) => r.fish.legendary);
        break;
    }
    const rank = ['now', 'later', 'today', 'conditional', 'earlier', 'unavailable'];
    if (sort === 'price') rs = [...rs].sort((a, b) => b.fish.sellPrice - a.fish.sellPrice);
    else if (sort === 'difficulty') rs = [...rs].sort((a, b) => (b.fish.difficulty ?? 0) - (a.fish.difficulty ?? 0));
    else if (sort === 'name') rs = [...rs].sort((a, b) => a.fish.name.localeCompare(b.fish.name));
    else rs = [...rs].sort((a, b) => rank.indexOf(a.status) - rank.indexOf(b.status) || Number(!!caught[a.fish.id]) - Number(!!caught[b.fish.id]) || a.fish.name.localeCompare(b.fish.name));
    return rs;
  }, [results, q, filter, sort, caught, watched, needs, ctx, spoilers]);

  const nav = (
    <SubNav
      items={[
        { to: '/fish', label: 'Fish list', current: view === 'list' },
        { to: `/fish/timeline${area ? `?area=${area}` : ''}`, label: 'Today’s timeline', current: view === 'timeline' },
        { to: `/fish/locations${area ? `?area=${area}` : ''}`, label: 'By location', current: view === 'locations' },
      ]}
    />
  );

  const areaSelect = (
    <label className="field" style={{ maxWidth: 320 }}>
      Location
      <select className="input" value={area} onChange={(e) => set('area', e.target.value)}>
        <option value="">All locations</option>
        {fishAreas.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </label>
  );

  if (view === 'timeline') {
    const rows = timelineRows(ctx, {
      area: area || undefined,
      includeWrongWeather: wrongWeather,
      filter: (id) => (filter === 'missing' ? !caught[id] : filter === 'watched' ? watched.has(id) : filter === 'bundles' ? needs.has(`fish:${id}`) : true),
    });
    return (
      <div className="stack">
        {nav}
        <ContextBar />
        <h2>
          Fish availability — {SEASON_LABEL[ctx.date.season]} ({WEATHER_LABEL[ctx.weather]})
        </h2>
        <div className="row-wrap">
          {areaSelect}
          <div className="chips" role="group" aria-label="Collection filter">
            {(['all', 'missing', 'watched', 'bundles'] as Filter[]).map((f) => (
              <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => set('filter', f === 'all' ? '' : f)}>
                {f === 'all' ? 'All' : f === 'missing' ? 'Not caught' : f === 'watched' ? '★ Watched' : '🧺 Bundle needs'}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={wrongWeather} onClick={() => setWrongWeather((w) => !w)}>
              Show wrong-weather fish
            </button>
          </div>
        </div>
        <p className="small muted">A time window means the fish can bite then — it’s never a guarantee of catching one. Crab-pot catches aren’t time-based and are listed on the Fish list.</p>
        {rows.length ? <FishTimeline rows={rows} cursor={cursor} onCursor={setCursor} /> : <Empty emoji="🎣" title="No fish match these filters today" />}
      </div>
    );
  }

  if (view === 'locations') {
    const areaRes = area ? resolveAreaFish(area, ctx) : [];
    const markers: MapMarker[] = fishAreas
      .filter((a) => AREA_ANCHOR[a.id])
      .map((a) => {
        const st = bestStatus(resolveAreaFish(a.id, ctx).map((r) => r.status));
        return {
          id: a.id,
          ...AREA_ANCHOR[a.id]!,
          label: `${a.name}: ${st === 'now' ? 'fish biting now' : st === 'unavailable' ? 'nothing today' : 'fish today'}`,
          kind: 'fish' as const,
          emphasis: a.id === area,
          icon: '🎣',
          onSelect: () => set('area', a.id),
        };
      });
    const info = fishAreas.find((a) => a.id === area);
    return (
      <div className="stack">
        {nav}
        <ContextBar />
        <ValleyMap label="Fishing spots" markers={markers} />
        <div className="grid-2">
          <div className="card">
            <h3>Fishing spots</h3>
            <ul className="list">
              {fishAreas.map((a) => {
                const rs = resolveAreaFish(a.id, ctx);
                const now = rs.filter((r) => r.status === 'now' || r.status === 'today').length;
                const later = rs.filter((r) => r.status === 'later').length;
                const cond = rs.filter((r) => r.status === 'conditional').length;
                const missing = rs.filter((r) => !caught[r.fish.id] && r.status !== 'unavailable').length;
                const locked = a.requires && resolveFlag(a.requires, ctx.progress, ctx.date) === false;
                return (
                  <li key={a.id}>
                    <button type="button" className="item" aria-pressed={area === a.id} onClick={() => set('area', a.id)} style={area === a.id ? { background: 'var(--accent-soft)' } : undefined}>
                      <span aria-hidden="true">🎣</span>
                      <span className="grow">
                        <span className="item-title">{a.name}</span>
                        <span className="item-sub" style={{ display: 'block' }}>
                          {locked ? '🔒 Not unlocked' : `${now} now/today · ${later} later · ${cond} conditional${missing ? ` · ${missing} not caught` : ''}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card">
            {info ? (
              <div className="stack-sm">
                <h3>{info.name}</h3>
                <p className="small muted">{info.description}</p>
                {info.requires && resolveFlag(info.requires, ctx.progress, ctx.date) !== true && <p className="notice small">Needs access: {info.requires === 'busRepaired' ? 'the bus to the Desert' : info.requires}.</p>}
                <ul className="list">
                  {areaRes
                    .sort((a, b) => ['now', 'later', 'today', 'conditional', 'earlier', 'unavailable'].indexOf(a.status) - ['now', 'later', 'today', 'conditional', 'earlier', 'unavailable'].indexOf(b.status))
                    .map((r) => (
                      <FishRow key={r.fish.id} r={r} caught={!!caught[r.fish.id]} bundles={needs.get(`fish:${r.fish.id}`)?.map((n) => n.bundle.name)} />
                    ))}
                </ul>
                <Link className="btn small" to={`/fish/timeline?area=${info.id}`}>
                  Timeline for this spot
                </Link>
                <p className="tiny muted">Plan ahead: use the date chip’s “Preview” to see this spot in another season or weather.</p>
              </div>
            ) : (
              <Empty emoji="🗺️" title="Pick a fishing spot">
                <p className="small">Choose a spot on the map or in the list to see what bites there today.</p>
              </Empty>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {nav}
      <ContextBar />
      <label className="field">
        <span className="sr-only">Search fish</span>
        <input className="input" type="search" placeholder="Search fish…" value={q} onChange={(e) => set('q', e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Fish filters">
        {(
          [
            ['catchable', 'Catchable today'],
            ['all', 'All fish'],
            ['season', `${SEASON_LABEL[ctx.date.season]} fish`],
            ['rain', '🌧️ Rain fish'],
            ['missing', 'Not caught'],
            ['watched', '★ Watched'],
            ['bundles', '🧺 Bundle needs'],
            ['crab', '🦀 Crab pot'],
            ['legendary', '👑 Legendary'],
          ] as [Filter, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => set('filter', k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="row-wrap">
        {areaSelect}
        <label className="field" style={{ maxWidth: 220 }}>
          Sort
          <select className="input" value={sort} onChange={(e) => set('sort', e.target.value)}>
            <option value="status">Availability</option>
            <option value="name">Name</option>
            <option value="price">Base price</option>
            <option value="difficulty">Difficulty</option>
          </select>
        </label>
        {(q || area || params.get('filter') || params.get('sort')) && (
          <button type="button" className="btn small ghost" onClick={() => setParams({}, { replace: true })}>
            Reset filters
          </button>
        )}
      </div>
      {ctx.weather === 'unknown' && <p className="notice small">Weather isn’t set: weather-dependent fish are marked “Conditional”.</p>}
      <div className="card">
        {filtered.length ? (
          <ul className="list" aria-label="Fish">
            {filtered.map((r) => (
              <FishRow key={r.fish.id} r={r} caught={!!caught[r.fish.id]} bundles={needs.get(`fish:${r.fish.id}`)?.map((n) => n.bundle.name)} />
            ))}
          </ul>
        ) : (
          <Empty emoji="🎣" title="No fish match">
            <button type="button" className="btn small" onClick={() => setParams({ filter: 'all' }, { replace: true })}>
              Show all fish
            </button>
          </Empty>
        )}
      </div>
      <p className="small muted">
        {filtered.length} shown · {Object.keys(caught).length} caught in total · <Link to="/journal/collections">Fish collection</Link>
      </p>
    </div>
  );
}
