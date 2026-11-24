import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { villagers, places, placeById, regions, shops, fishAreas, regionById, festivals, villagerById } from '../data';
import { useStore } from '../state/store';
import { ContextBar, TimeControl } from '../ui/DayControls';
import { Badge, Empty, FishBadge } from '../ui/common';
import { ValleyMap, type MapMarker, type MapLine } from '../ui/ValleyMap';
import { AREA_ANCHOR } from './Fish';
import { resolveVillagerSchedule, locateAt } from '../engine/schedule';
import { resolveAreaFish, bestStatus } from '../engine/fish';
import { resolveShopAvailability, SHOP_STATUS_LABEL } from '../engine/shops';
import { formatTime } from '../engine/time';
import { resolveFlag } from '../engine/progress';

type Mode = 'villagers' | 'fishing' | 'explore';

interface VLoc {
  id: string;
  name: string;
  place: string | null;
  travelling: boolean;
  from: string | null;
  alt: boolean;
  note?: string;
}

export default function MapPage() {
  const { ctx, profile } = useStore();
  const [params, setParams] = useSearchParams();
  const mode = (params.get('mode') as Mode) ?? (params.get('villager') ? 'villagers' : params.get('place') ? 'explore' : 'villagers');
  const villagerId = params.get('villager') ?? '';
  const [selected, setSelected] = useState<string | null>(params.get('place'));
  const [time, setTime] = useState<number | null>(ctx.time ?? 12 * 60);
  const [layers, setLayers] = useState({ shops: true, homes: true, outdoor: true });
  const t = time ?? 12 * 60;
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const vlocs = useMemo(() => {
    const out: VLoc[] = [];
    const pool = villagerId ? villagers.filter((v) => v.id === villagerId) : villagers.filter((v) => profile.prefs.spoilers === 'show' || !v.availability?.spoiler);
    for (const v of pool) {
      const res = resolveVillagerSchedule(v.id, ctx);
      if (!res) continue;
      if (res.kind === 'schedule') {
        res.branches.forEach((b, i) => {
          const l = locateAt(b.block, t, v.home);
          out.push({ id: `${v.id}-${i}`, name: v.name, place: l.place, travelling: l.status === 'travelling', from: l.from, alt: res.branches.length > 1, note: b.block.label });
        });
      } else if (res.kind === 'festival') {
        const inFest = t >= res.festival.start && t < res.festival.end;
        out.push({ id: v.id, name: v.name, place: inFest ? res.festival.place : v.home, travelling: false, from: null, alt: false, note: inFest ? res.festival.name : 'Festival day (before/after the festival)' });
      } else if (res.kind === 'stationary') out.push({ id: v.id, name: v.name, place: v.home, travelling: false, from: null, alt: false, note: 'Stays here' });
    }
    return out;
  }, [ctx, t, villagerId, profile.prefs.spoilers]);

  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  if (mode === 'villagers') {
    const byPlace = new Map<string, VLoc[]>();
    for (const l of vlocs) if (l.place) byPlace.set(l.place, [...(byPlace.get(l.place) ?? []), l]);
    for (const [pid, ls] of byPlace) {
      const p = placeById.get(pid);
      if (!p) continue;
      ls.forEach((l, i) => {
        markers.push({
          id: l.id,
          x: p.x + (i % 4) * 22 - 33 * Math.min(1, ls.length - 1) * 0.5,
          y: p.y + Math.floor(i / 4) * 22,
          label: `${l.name}${l.alt ? ' (one possible routine)' : ''}: ${l.travelling ? 'heading to ' : ''}${p.name}`,
          kind: l.alt ? 'alt' : 'villager',
          emphasis: !!villagerId,
          icon: l.name.charAt(0),
          onSelect: () => setSelected(pid),
        });
        if (l.travelling && l.from && villagerId) {
          const f = placeById.get(l.from);
          if (f) lines.push({ from: f, to: p, dashed: true });
        }
      });
    }
  } else if (mode === 'fishing') {
    for (const a of fishAreas) {
      const anchor = AREA_ANCHOR[a.id];
      if (!anchor) continue;
      const st = bestStatus(resolveAreaFish(a.id, ctx).map((r) => r.status));
      markers.push({ id: a.id, ...anchor, label: `${a.name}${st === 'now' ? ': fish biting now' : ''}`, kind: 'fish', emphasis: selected === a.id, icon: '🎣', onSelect: () => setSelected(a.id) });
    }
  } else {
    for (const p of places) {
      if (p.kind === 'shop' && !layers.shops) continue;
      if (p.kind === 'home' && !layers.homes) continue;
      if ((p.kind === 'outdoor' || p.kind === 'water' || p.kind === 'building' || p.kind === 'service') && !layers.outdoor) continue;
      markers.push({ id: p.id, x: p.x, y: p.y, label: p.name, kind: p.kind === 'shop' ? 'shop' : 'place', emphasis: selected === p.id, icon: p.kind === 'shop' ? '🏪' : p.kind === 'home' ? '🏠' : p.kind === 'water' ? '💧' : '📍', onSelect: () => setSelected(p.id) });
    }
    const fest = festivals.find((f) => f.season === ctx.date.season && ctx.date.day >= f.startDay && ctx.date.day <= f.endDay);
    const fp = fest && placeById.get(fest.place);
    if (fest && fp) markers.push({ id: `fest-${fest.id}`, x: fp.x + 26, y: fp.y - 20, label: `${fest.name} today`, kind: 'event', emphasis: true, icon: '🎪', onSelect: () => setSelected(fp.id) });
  }

  const selPlace = selected ? placeById.get(selected) : undefined;
  const selArea = selected ? fishAreas.find((a) => a.id === selected) : undefined;
  const highlight = selPlace ? selPlace.region : villagerId ? undefined : null;

  return (
    <div className="stack" style={{ marginTop: 4 }}>
      <ContextBar />
      <div className="seg" role="group" aria-label="Map mode">
        {(
          [
            ['villagers', '👤 Villagers'],
            ['fishing', '🎣 Fishing'],
            ['explore', '🧭 Explore'],
          ] as [Mode, string][]
        ).map(([m, l]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => (setSelected(null), set('mode', m))}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'villagers' && (
        <div className="row-wrap">
          <label className="field" style={{ maxWidth: 260 }}>
            Villager
            <select className="input" value={villagerId} onChange={(e) => set('villager', e.target.value)}>
              <option value="">Everyone</option>
              {villagers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grow" style={{ minWidth: 260 }}>
            <TimeControl value={time} onChange={setTime} label="Map time" />
          </div>
        </div>
      )}
      {mode === 'explore' && (
        <div className="chips" role="group" aria-label="Map layers">
          {(['shops', 'homes', 'outdoor'] as const).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={layers[k]} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>
              {k === 'shops' ? '🏪 Shops' : k === 'homes' ? '🏠 Homes' : '📍 Places & water'}
            </button>
          ))}
        </div>
      )}
      <ValleyMap label={mode === 'villagers' ? `Villager locations at ${formatTime(t)}` : mode === 'fishing' ? 'Fishing spots' : 'Places in the Valley'} markers={markers} lines={lines} highlightRegion={highlight} onRegionSelect={(id) => setSelected(places.find((p) => p.region === id)?.id ?? null)} />
      <p className="tiny muted">
        This is an original schematic, not a live tracker: villagers are shown at the place their schedule names for the chosen time. Dashed/blue markers are one of several possible routines. Off-map areas (Desert, Ginger Island, Witch’s Swamp) are listed below.
      </p>

      {(selPlace || selArea) && (
        <section className="card stack-sm" aria-live="polite">
          {selArea ? (
            <>
              <h3>🎣 {selArea.name}</h3>
              <p className="small muted">{selArea.description}</p>
              <ul className="list">
                {resolveAreaFish(selArea.id, ctx)
                  .filter((r) => r.status !== 'unavailable')
                  .map((r) => (
                    <li key={r.fish.id}>
                      <Link className="item" to={`/fish/${r.fish.id}`}>
                        <span className="grow item-title">{r.fish.name}</span>
                        <FishBadge status={r.status} />
                        {profile.collections.fishCaught[r.fish.id] && <Badge>✓</Badge>}
                      </Link>
                    </li>
                  ))}
              </ul>
              <Link className="btn small" to={`/fish/locations?area=${selArea.id}`}>
                Full details
              </Link>
            </>
          ) : (
            selPlace && (
              <>
                <h3>{selPlace.name}</h3>
                <p className="small muted">{regionById.get(selPlace.region)?.name}</p>
                {shops
                  .filter((s) => s.place === selPlace.id)
                  .map((s) => {
                    const r = resolveShopAvailability(s, ctx);
                    return (
                      <p key={s.id} className="small">
                        🏪 <Link to={`/shops#${s.id}`}>{s.name}</Link> — <Badge kind={r.status === 'open' ? 'open' : r.status === 'conditional' ? 'conditional' : ''}>{SHOP_STATUS_LABEL[r.status]}</Badge>{' '}
                        {r.hours ? `${formatTime(r.hours.start)}–${formatTime(r.hours.end)}` : r.reasons[0]}
                      </p>
                    );
                  })}
                {villagers
                  .filter((v) => v.home === selPlace.id)
                  .map((v) => (
                    <p key={v.id} className="small">
                      🏠 Home of <Link to={`/people/${v.id}`}>{v.name}</Link>
                    </p>
                  ))}
                {mode === 'villagers' && (
                  <p className="small">
                    At {formatTime(t)}:{' '}
                    {vlocs.filter((l) => l.place === selPlace.id).map((l) => `${l.name}${l.travelling ? ' (on the way)' : ''}${l.alt ? ' (possible)' : ''}`).join(', ') || 'no one listed'}
                  </p>
                )}
                {fishAreas
                  .filter((a) => a.region === selPlace.region)
                  .map((a) => (
                    <p key={a.id} className="small">
                      🎣 <Link to={`/fish/locations?area=${a.id}`}>{a.name}</Link>
                    </p>
                  ))}
              </>
            )
          )}
        </section>
      )}

      <details className="card" open={mode === 'villagers' && !!villagerId}>
        <summary className="item-title" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
          List view {mode === 'villagers' ? `(where everyone is at ${formatTime(t)})` : mode === 'fishing' ? '(fishing spots)' : '(places)'}
        </summary>
        {mode === 'villagers' ? (
          vlocs.length ? (
            <ul className="list">
              {vlocs.map((l) => (
                <li key={l.id}>
                  <Link className="item" to={`/people/${l.id.split('-')[0]}`}>
                    <span className="grow">
                      <span className="item-title">{l.name}</span> {l.alt && <Badge kind="random">Possible</Badge>}
                      <span className="item-sub" style={{ display: 'block' }}>
                        {l.travelling ? 'On the way to ' : ''}
                        {l.place ? placeById.get(l.place)?.name : 'Unknown'} · {l.note}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nobody to show" />
          )
        ) : mode === 'fishing' ? (
          <ul className="list">
            {fishAreas.map((a) => (
              <li key={a.id}>
                <button type="button" className="item" onClick={() => setSelected(a.id)}>
                  🎣 <span className="grow">{a.name}</span>
                  {a.requires && resolveFlag(a.requires, ctx.progress, ctx.date) === false && <Badge>🔒</Badge>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="list">
            {regions.map((r) => (
              <li key={r.id} className="stack-sm" style={{ padding: '8px 0' }}>
                <strong>
                  {r.name} {r.offMap && <Badge>Off map</Badge>}
                </strong>
                <span className="small muted">{r.description}</span>
                <span className="row-wrap">
                  {places
                    .filter((p) => p.region === r.id)
                    .map((p) => (
                      <button key={p.id} type="button" className="chip" onClick={() => setSelected(p.id)}>
                        {p.name}
                      </button>
                    ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
      {villagerId && villagerById.get(villagerId) && (
        <Link className="btn" to={`/people/${villagerId}`}>
          Open {villagerById.get(villagerId)!.name}’s schedule
        </Link>
      )}
    </div>
  );
}
