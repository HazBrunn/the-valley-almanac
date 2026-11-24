/**
 * Interactive time × fish chart (Gantt-style). One row per fish × rule that is relevant to
 * the selected day. Bars: solid = possible today; striped dashed = depends on unknown
 * weather/progress; dotted hatched = wrong weather today. Each bar is a link with a full
 * text label, and an equivalent list is rendered below for screen readers and small screens.
 */
import { Link } from 'react-router-dom';
import { fish as ALL_FISH, fishAreaById } from '../data';
import type { GameContext } from '../engine/context';
import { evaluateRule, wrongWeather } from '../engine/fish';
import { evaluate } from '../engine/conditions';
import { DAY_START, DAY_END, formatTime, formatTimeShort, formatWindows, inAnyWindow, type GameMinutes } from '../engine/time';
import { FishGlyph } from './icons';
import { glyphShape } from './fishShape';

export interface TimelineRow {
  key: string;
  fishId: string;
  name: string;
  color: string;
  areas: string;
  windows: { start: number; end: number }[];
  state: 'ok' | 'cond' | 'off';
  note: string;
  /** sort helpers */
  rain: boolean;
  minor: boolean;
}

export function timelineRows(ctx: GameContext, opts: { area?: string; includeWrongWeather: boolean; filter?: (fishId: string) => boolean }): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const f of ALL_FISH) {
    if (f.method !== 'rod') continue;
    if (opts.filter && !opts.filter(f.id)) continue;
    for (const rule of f.rules) {
      if (opts.area && !rule.areas.includes(opts.area)) continue;
      const r = evaluateRule(rule, ctx, opts.area);
      let state: TimelineRow['state'] | null = null;
      let note = '';
      if (r.day === true) state = 'ok';
      else if (r.day === 'unknown') {
        state = 'cond';
        note = r.unknowns.join('; ');
      } else if (opts.includeWrongWeather && wrongWeather(rule, ctx)) {
        // all non-weather date conditions hold?
        const seasonOk = evaluate({ kind: 'season', in: rule.seasons }, { date: ctx.date, weather: 'unknown', time: null, progress: ctx.progress }).value === true;
        const dayOk = !rule.days || (ctx.date.day >= rule.days[0] && ctx.date.day <= rule.days[1]);
        if (seasonOk && dayOk) {
          state = 'off';
          note = rule.weather === 'rain' ? 'needs rain' : 'needs no rain';
        }
      }
      if (!state) continue;
      rows.push({
        key: `${rule.id}`,
        fishId: f.id,
        name: f.name,
        color: f.color,
        areas: (opts.area ? [opts.area] : rule.areas).map((a) => fishAreaById.get(a)?.name ?? a).join(', '),
        windows: rule.windows,
        state,
        note: [note, rule.event ? `${rule.event} only` : '', rule.minLevel ? `Fishing ${rule.minLevel}+` : ''].filter(Boolean).join(' · '),
        rain: rule.weather === 'rain',
        minor: f.category === 'other',
      });
    }
  }
  const rank = { ok: 0, cond: 1, off: 2 };
  const span = (r: TimelineRow) => r.windows.reduce((n, w) => n + (w.end - w.start), 0);
  return rows.sort(
    (a, b) =>
      rank[a.state] - rank[b.state] ||
      Number(a.minor) - Number(b.minor) ||
      Number(b.rain) - Number(a.rain) ||
      span(a) - span(b) ||
      (a.windows[0]?.start ?? 0) - (b.windows[0]?.start ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

const pct = (t: number) => ((t - DAY_START) / (DAY_END - DAY_START)) * 100;
const TICKS = [6, 9, 12, 15, 18, 21, 24, 26].map((h) => h * 60);

export function FishTimeline({ rows, cursor, onCursor }: { rows: TimelineRow[]; cursor: GameMinutes; onCursor: (t: GameMinutes) => void }) {
  const catchable = rows.filter((r) => r.state !== 'off' && inAnyWindow(cursor, r.windows));
  return (
    <div className="stack">
      <div className="legend" aria-label="Legend">
        <span>
          <span className="sw" style={{ background: 'var(--accent)' }} /> Possible today
        </span>
        <span>
          <span className="sw tl-bar cond" style={{ position: 'static', display: 'inline-block' }} /> Depends (weather/progress unknown)
        </span>
        <span>
          <span className="sw tl-bar off" style={{ position: 'static', display: 'inline-block' }} /> Wrong weather today
        </span>
        <span>
          <span className="sw" style={{ background: 'var(--rose)', width: 4 }} /> Selected time
        </span>
      </div>
      <div className="time-row">
        <label htmlFor="tl-cursor" className="small" style={{ fontWeight: 800 }}>
          Time
        </label>
        <input id="tl-cursor" type="range" min={DAY_START} max={DAY_END - 10} step={10} value={cursor} onChange={(e) => onCursor(Number(e.target.value))} aria-valuetext={formatTime(cursor)} />
        <span className="time-label">{formatTime(cursor)}</span>
      </div>
      <div className="timeline-wrap" aria-hidden="false">
        <div className="timeline" role="img" aria-label={`Fishing timeline with ${rows.length} rows. An equivalent list follows.`}>
          <div className="tl-axis" aria-hidden="true">
            <div style={{ padding: '6px 8px' }}>Fish</div>
            <div className="ticks">
              {TICKS.map((t) => (
                <span key={t} className="tick" style={{ left: `${pct(t)}%` }}>
                  {formatTimeShort(t)}
                </span>
              ))}
            </div>
          </div>
          {rows.map((r) => (
            <div className="tl-row" key={r.key}>
              <Link className="tl-label" to={`/fish/${r.fishId}`}>
                <FishGlyph color={r.color} shape={glyphShape(r.fishId)} className="fish-icon" />
                <span>
                  {r.name}
                  <span className="tiny muted" style={{ display: 'block', fontWeight: 600 }}>
                    {r.areas}
                  </span>
                </span>
              </Link>
              <div className="tl-track">
                {TICKS.map((t) => (
                  <span key={t} className="tl-grid" style={{ left: `${pct(t)}%` }} />
                ))}
                {r.windows.map((w, i) => (
                  <Link
                    key={i}
                    to={`/fish/${r.fishId}`}
                    className={`tl-bar ${r.state === 'cond' ? 'cond' : r.state === 'off' ? 'off' : ''}`}
                    style={{ left: `${pct(w.start)}%`, width: `${pct(w.end) - pct(w.start)}%`, ...(r.state === 'ok' ? { background: r.color } : {}) }}
                    aria-label={`${r.name}: ${formatTime(w.start)} to ${formatTime(w.end)}${r.state === 'cond' ? ', conditional' : r.state === 'off' ? ', wrong weather today' : ''}`}
                    tabIndex={-1}
                  >
                    {formatTimeShort(w.start)}–{formatTimeShort(w.end)}
                    {r.state === 'off' ? ' · wrong weather' : r.state === 'cond' ? ' · if…' : ''}
                  </Link>
                ))}
                <span className="tl-cursor" style={{ left: `${pct(cursor)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <section aria-labelledby="tl-list">
        <h3 id="tl-list">
          Catchable at {formatTime(cursor)} ({catchable.length})
        </h3>
        <ul className="list">
          {catchable.map((r) => (
            <li key={r.key}>
              <Link className="item" to={`/fish/${r.fishId}`}>
                <FishGlyph color={r.color} shape={glyphShape(r.fishId)} />
                <span className="grow">
                  <span className="item-title">{r.name}</span> {r.state === 'cond' && <span className="badge conditional">? Conditional</span>}
                  <span className="item-sub" style={{ display: 'block' }}>
                    {r.areas} · {formatWindows(r.windows)}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {catchable.length === 0 && <li className="muted small">Nothing in these filters at this time.</li>}
        </ul>
      </section>
    </div>
  );
}
