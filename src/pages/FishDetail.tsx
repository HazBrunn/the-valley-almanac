import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fishById, fishAreaById, recipes } from '../data';
import type { FishRule } from '../data/types';
import { useStore } from '../state/store';
import { ContextBar } from '../ui/DayControls';
import { CaughtToggle, Empty, FishBadge, Sign, SourceLink, WatchButton } from '../ui/common';
import { FishGlyph } from '../ui/icons';
import { glyphShape } from '../ui/fishShape';
import { ValleyMap, type MapMarker } from '../ui/ValleyMap';
import { AREA_ANCHOR } from './Fish';
import { resolveFishAvailability, describeRule, describeNext, lastDayThisSeason } from '../engine/fish';
import { SEASONS, SEASON_LABEL, formatDate } from '../engine/calendar';
import { DAY_START, DAY_END, formatTime, formatTimeShort, formatWindows } from '../engine/time';
import { bundlesUsing, bundleSubmitted } from '../engine/collections';

const pct = (t: number) => ((t - DAY_START) / (DAY_END - DAY_START)) * 100;

export default function FishDetail() {
  const { id = '' } = useParams();
  const f = fishById.get(id);
  const { ctx, profile } = useStore();
  const [sel, setSel] = useState<{ area: string; season: string } | null>(null);
  const res = useMemo(() => (f ? resolveFishAvailability(f, ctx) : null), [f, ctx]);
  if (!f || !res) return <Empty emoji="🐟" title="Fish not found"><Link to="/fish">Back to fish</Link></Empty>;

  const areas = [...new Set(f.rules.flatMap((r) => r.areas))];
  const rulesFor = (area: string, season: string): FishRule[] => f.rules.filter((r) => r.areas.includes(area) && (r.seasons as string[]).includes(season));
  const cellText = (rs: FishRule[]) => {
    if (!rs.length) return { text: '—', cls: '' };
    const regular = rs.filter((r) => !r.event && !r.days);
    const base = regular.length ? regular : rs;
    if (base.some((r) => r.weather === 'any')) return { text: base.some((r) => r.note?.includes('Rain Totem')) ? 'Totem' : rs.some((r) => r.event) && !regular.length ? 'Event' : 'Yes', cls: 'yes' };
    if (base.some((r) => r.weather === 'rain')) return { text: base.some((r) => r.note?.includes('Rain Totem')) ? 'Totem 🌧' : 'Rain', cls: 'rain' };
    return { text: 'Dry', cls: 'yes' };
  };
  const selRules = sel ? rulesFor(sel.area, sel.season) : [];
  const usedBundles = bundlesUsing('fish', f.id);
  const recipesUsing = recipes.filter((r) => r.ingredients.some((i) => i.name === f.name));
  const last = lastDayThisSeason(f, ctx);
  const next = res.next;
  const markers: MapMarker[] = areas
    .filter((a) => AREA_ANCHOR[a])
    .map((a) => ({
      id: a,
      ...AREA_ANCHOR[a]!,
      label: `${f.name}: ${fishAreaById.get(a)?.name ?? a}`,
      kind: 'fish' as const,
      emphasis: res.activeRules.some((r) => r.rule.areas.includes(a)),
      icon: '🎣',
    }));

  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <FishGlyph color={f.color} shape={glyphShape(f.id)} className="fish-icon" title={f.name} />
        <div className="grow stack-sm">
          <h2 style={{ fontSize: '1.6rem' }}>{f.name}</h2>
          <p className="small muted">{f.description}</p>
          <div className="row-wrap small">
            <span>💰 {f.sellPrice}g base</span>
            {f.difficulty !== undefined && <span>🎯 Difficulty {f.difficulty}</span>}
            <span>{f.method === 'crab-pot' ? '🦀 Crab pot' : '🎣 Fishing rod'}</span>
            {f.legendary && <span className="badge last">👑 {f.legendary === 'legendary' ? 'Legendary' : 'Legendary II'}</span>}
          </div>
          <div className="row-wrap">
            <WatchButton kind="fish" refId={f.id} title={f.name} />
            <CaughtToggle fishId={f.id} name={f.name} />
          </div>
        </div>
      </div>

      <ContextBar />
      <section className="card stack-sm" aria-labelledby="avail">
        <h3 id="avail">
          Today: <FishBadge status={res.status} />
        </h3>
        {res.activeRules.map((r) => (
          <p key={r.rule.id} className="small">
            {r.day === true ? '✅' : '❔'} {describeRule(r.rule)}
            {r.rule.spot ? ` — ${r.rule.spot}` : ''}
            {r.unknowns.length > 0 && <span className="muted"> · depends on: {r.unknowns.join('; ')}</span>}
          </p>
        ))}
        {res.reasons.length > 0 && (
          <ul className="small">
            {res.reasons.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        {next && <p className="small">📆 {describeNext(next)}</p>}
        {last && <p className="small">⏳ Last possible day this season: {formatDate(last, { year: false })}.</p>}
      </section>

      <section className="section" aria-labelledby="matrix-h">
        <Sign id="matrix-h" icon="🗺️">
          Where & when
        </Sign>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="matrix">
            <caption className="sr-only">Location by season availability for {f.name}. Select a cell for the exact rule.</caption>
            <thead>
              <tr>
                <th scope="col">Location</th>
                {SEASONS.map((s) => (
                  <th scope="col" key={s} style={s === ctx.date.season ? { color: 'var(--accent-ink)' } : undefined}>
                    {SEASON_LABEL[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a}>
                  <th scope="row">{fishAreaById.get(a)?.name ?? a}</th>
                  {SEASONS.map((s) => {
                    const rs = rulesFor(a, s);
                    const c = cellText(rs);
                    return (
                      <td key={s}>
                        <button
                          type="button"
                          className={`${c.cls} ${sel?.area === a && sel.season === s ? 'sel' : ''}`}
                          disabled={!rs.length}
                          aria-label={`${fishAreaById.get(a)?.name} in ${SEASON_LABEL[s]}: ${rs.length ? c.text : 'not available'}`}
                          onClick={() => setSel({ area: a, season: s })}
                        >
                          {c.text}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">Yes = any weather · Rain = rain/storm only · Dry = not in rain · Totem = only if you use a Rain Totem in winter · Event = festival days only.</p>
          {sel && (
            <div className="stack-sm" aria-live="polite">
              <h4 style={{ margin: '8px 0 0' }}>
                {fishAreaById.get(sel.area)?.name} · {SEASON_LABEL[sel.season as keyof typeof SEASON_LABEL]}
              </h4>
              {selRules.map((r) => (
                <p key={r.id} className="small">
                  {formatWindows(r.windows)} · {r.weather === 'rain' ? 'rain only' : r.weather === 'dry' ? 'not in rain' : 'any weather'}
                  {r.days ? ` · days ${r.days[0]}–${r.days[1]}` : ''}
                  {r.minLevel ? ` · Fishing level ${r.minLevel}+` : ''}
                  {r.event ? ` · ${r.event}` : ''}
                  {r.note ? ` — ${r.note}` : ''}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="time-h">
        <Sign id="time-h" icon="🕰️">
          Time of day
        </Sign>
        <div className="card stack-sm">
          {f.rules.map((r) => (
            <div key={r.id}>
              <div className="small" style={{ fontWeight: 700 }}>
                {r.areas.map((a) => fishAreaById.get(a)?.name ?? a).join(', ')} {r.event ? `(${r.event})` : ''}
              </div>
              <div className="tl-track" style={{ margin: 0, background: 'var(--surface-2)', borderRadius: 8 }} aria-label={formatWindows(r.windows)} role="img">
                {r.windows.map((w, i) => (
                  <span key={i} className={`tl-bar ${r.weather === 'rain' ? 'cond' : ''}`} style={{ left: `${pct(w.start)}%`, width: `${pct(w.end) - pct(w.start)}%`, background: r.weather === 'rain' ? undefined : f.color }}>
                    {formatTimeShort(w.start)}–{formatTimeShort(w.end)}
                    {r.weather === 'rain' ? ' 🌧' : ''}
                  </span>
                ))}
                {ctx.time !== null && <span className="tl-cursor" style={{ left: `${pct(ctx.time)}%` }} />}
              </div>
            </div>
          ))}
          {ctx.time !== null && <p className="tiny muted">Red line: {formatTime(ctx.time)}</p>}
        </div>
      </section>

      {markers.length > 0 && <ValleyMap label={`Where to catch ${f.name}`} markers={markers} />}

      {(usedBundles.length > 0 || recipesUsing.length > 0 || f.notes.length > 0) && (
        <section className="card stack-sm">
          {usedBundles.map((b) => (
            <p key={b.id} className="small">
              🧺 <Link to={`/journal/bundles#${b.id}`}>{b.name}</Link> ({b.roomName}
              {b.remix ? ', remixed' : ''}) — {bundleSubmitted(profile, b)}/{b.itemsRequired} submitted. Catching it and submitting it are tracked separately.
            </p>
          ))}
          {recipesUsing.length > 0 && (
            <p className="small">
              🍳 Used in:{' '}
              {recipesUsing.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ', '}
                  <Link to={`/recipes#${r.id}`}>{r.name}</Link>
                </span>
              ))}
            </p>
          )}
          {f.notes.map((n) => (
            <p key={n} className="small">
              ℹ️ {n}
            </p>
          ))}
        </section>
      )}
      <p className="small">
        <SourceLink href={f.source} label="Stardew Valley Wiki" /> · Ruleset: vanilla 1.6.15
      </p>
    </div>
  );
}
