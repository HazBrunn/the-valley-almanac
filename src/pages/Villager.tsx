import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { villagerById, placeById, placeName, regionOfPlace, universalGifts, checkups } from '../data';
import { useStore } from '../state/store';
import { ContextBar, TimeControl } from '../ui/DayControls';
import { Portrait } from '../ui/icons';
import { Badge, Empty, FavButton, SourceLink, WatchButton, Sheet } from '../ui/common';
import { ValleyMap, type MapMarker, type MapLine } from '../ui/ValleyMap';
import { resolveVillagerSchedule, locateAt, type ScheduleBranch } from '../engine/schedule';
import { describe as describeCond } from '../engine/conditions';
import { SEASON_LABEL, daysBetween, formatDate } from '../engine/calendar';
import { formatTime } from '../engine/time';
import type { ScheduleStep } from '../data/types';

type Tab = 'schedule' | 'gifts' | 'info' | 'hearts';

function BranchView({ branch, time, home, index, total }: { branch: ScheduleBranch; time: number; home: string; index: number; total: number }) {
  const loc = locateAt(branch.block, time, home);
  const current = (s: ScheduleStep) => loc.step === s;
  return (
    <div className="branch">
      <div className="row-wrap">
        <strong>{total > 1 ? `Option ${index + 1}: ` : ''}{branch.block.label}</strong>
        <Badge kind={branch.certainty === 'definite' ? 'certain' : branch.certainty}>
          {branch.certainty === 'definite' ? (total > 1 ? 'Otherwise' : 'Applies today') : branch.certainty === 'random' ? 'Random pick' : 'Possible'}
        </Badge>
      </div>
      {branch.certainty === 'possible' && <p className="small muted">{branch.why.join(' ')}</p>}
      <p className="small" style={{ margin: '6px 0' }}>
        <strong>At {formatTime(time)}:</strong> {loc.sentence}
      </p>
      <ol className="schedule" aria-label={`Schedule: ${branch.block.label}`}>
        {branch.block.steps.map((s, i) => (
          <li key={i} className={current(s) ? 'current' : ''} aria-current={current(s) ? 'step' : undefined}>
            <span className="t">{formatTime(s.time)}</span>
            <span>
              {s.kind === 'travel' ? '🚶 ' : '📍 '}
              {s.text}
              {s.place && (
                <span className="tiny muted" style={{ display: 'block' }}>
                  {s.kind === 'travel' ? 'Heading to ' : ''}
                  {placeName(s.place)}
                  {s.inferred ? ' (same place as before)' : ''}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function Villager() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'schedule';
  const { ctx, profile, update } = useStore();
  const v = villagerById.get(id);
  const [scrub, setScrub] = useState<number | null>(null);
  const [why, setWhy] = useState(false);
  const [giftItem, setGiftItem] = useState('');
  const time = scrub ?? ctx.time ?? 12 * 60;
  const res = useMemo(() => (v ? resolveVillagerSchedule(v.id, ctx) : null), [v, ctx]);

  if (!v || !res) return <Empty emoji="🤷" title="Villager not found"><Link to="/people">Back to People</Link></Empty>;

  const spoilers = profile.prefs.spoilers === 'show';
  const bday = { year: ctx.date.year, season: v.birthday.season, day: v.birthday.day };
  let bdayIn = daysBetween(ctx.date, bday);
  if (bdayIn < 0) bdayIn += 112;
  const hearts = profile.progress.hearts[v.id];
  const setTab = (t: Tab) => setParams(t === 'schedule' ? {} : { tab: t }, { replace: true });

  // map markers for current time
  const markers: MapMarker[] = [];
  const lines: MapLine[] = [];
  if (res.kind === 'schedule') {
    res.branches.forEach((b, i) => {
      const loc = locateAt(b.block, time, v.home);
      const p = loc.place ? placeById.get(loc.place) : undefined;
      if (p) {
        markers.push({ id: `b${i}`, x: p.x + i * 14, y: p.y, label: `${v.name}${res.branches.length > 1 ? ` (option ${i + 1})` : ''}: ${loc.status === 'travelling' ? 'heading to ' : ''}${p.name}`, kind: i === 0 ? 'villager' : 'alt', emphasis: true, icon: v.name.charAt(0) });
        if (loc.status === 'travelling' && loc.from) {
          const f = placeById.get(loc.from);
          if (f) lines.push({ from: { x: f.x, y: f.y }, to: { x: p.x, y: p.y }, dashed: true });
        }
      }
    });
  } else if (res.kind === 'festival') {
    const p = placeById.get(res.festival.place);
    if (p) markers.push({ id: 'fest', x: p.x, y: p.y, label: `${res.festival.name} at ${p.name}`, kind: 'event', emphasis: true, icon: '🎪' });
  } else {
    const p = placeById.get(v.home);
    if (p) markers.push({ id: 'home', x: p.x, y: p.y, label: `${v.name}: ${p.name}`, kind: 'villager', emphasis: true, icon: v.name.charAt(0) });
  }
  const offMapRegion = markers.length ? undefined : regionOfPlace(v.home)?.id;

  const answer =
    res.kind === 'schedule'
      ? (() => {
          if (!res.branches.length) return 'No listed schedule applies today.';
          const locs = res.branches.map((b) => locateAt(b.block, time, v.home));
          const uniq = [...new Set(locs.map((l) => (l.status === 'travelling' ? `on the way to ${placeName(l.place)}` : l.status === 'not-out-yet' ? `still at ${placeName(l.place)}` : `at ${placeName(l.place)}`)))];
          if (uniq.length === 1) return `At ${formatTime(time)}, ${v.name} is expected to be ${uniq[0]}.`;
          const reason = res.branches.some((b) => b.certainty === 'random') ? 'the game picks a routine at random each morning' : 'it depends on details you haven’t entered';
          return `At ${formatTime(time)}, ${v.name} could be ${uniq.slice(0, -1).join(', ')} or ${uniq[uniq.length - 1]} — ${reason}.`;
        })()
      : res.note;

  return (
    <div className="stack">
      <div className="card row" style={{ alignItems: 'flex-start' }}>
        <Portrait name={v.name} size="lg" />
        <div className="grow stack-sm">
          <h2 style={{ fontSize: '1.6rem' }}>{v.name}</h2>
          <span className="small muted">
            {v.occupation} · {v.address}
          </span>
          <span className="small">
            🎂 {SEASON_LABEL[v.birthday.season]} {v.birthday.day}
            {bdayIn === 0 ? ' — today!' : bdayIn <= 14 ? ` — in ${bdayIn} day${bdayIn === 1 ? '' : 's'}` : ''}
          </span>
          {hearts !== undefined && (
            <span className="small" aria-label={`${hearts} hearts`}>
              {'♥'.repeat(Math.min(hearts, 14))}
              <span className="muted">{'♡'.repeat(Math.max(0, (v.marriageable ? 10 : 10) - hearts))}</span>
            </span>
          )}
        </div>
        <div className="stack-sm">
          <FavButton id={v.id} name={v.name} />
          <WatchButton kind="villager" refId={v.id} title={v.name} compact />
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label={`${v.name} sections`}>
        {(
          [
            ['schedule', 'Schedule'],
            ['gifts', 'Gifts'],
            ['info', 'Info'],
            ['hearts', 'Heart events'],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'schedule' && (
        <div className="stack" role="tabpanel">
          <ContextBar />
          <div className="card stack-sm">
            <p style={{ fontSize: '1.05rem' }}>
              <strong>{answer}</strong>
            </p>
            {res.kind === 'schedule' &&
              res.notes.map((n) => (
                <p key={n} className="notice small">
                  {n}
                </p>
              ))}
            <TimeControl value={time} onChange={(t) => setScrub(t ?? null)} label="Scrub the time of day" />
            {scrub !== null && (
              <button type="button" className="btn small ghost" onClick={() => setScrub(null)}>
                Reset to {ctx.time !== null ? `game time (${formatTime(ctx.time)})` : 'noon'}
              </button>
            )}
          </div>
          <ValleyMap label={`${v.name}'s expected location`} markers={markers} lines={lines} highlightRegion={offMapRegion} />
          <p className="small muted">
            Markers show the place named in the schedule. Walking routes and exact arrival times aren’t known, so travel is drawn as a dashed line, not a live position.{' '}
            <Link to={`/map?villager=${v.id}`}>Open the full map</Link>
          </p>
          {res.kind === 'schedule' ? (
            res.branches.length ? (
              <section aria-label="Schedules for this day">
                {res.branches.map((b, i) => (
                  <BranchView key={b.block.id} branch={b} time={time} home={v.home} index={i} total={res.branches.length} />
                ))}
              </section>
            ) : (
              <Empty emoji="📜" title="No listed schedule for this day" />
            )
          ) : (
            <p className="notice">{res.note}</p>
          )}
          <div className="row-wrap">
            <button type="button" className="btn small" onClick={() => setWhy(true)}>
              Why this schedule? (sources & assumptions)
            </button>
          </div>
          <Sheet open={why} onClose={() => setWhy(false)} title={`How ${v.name}'s day was worked out`}>
            <p className="small">
              Schedules come from the Stardew Valley Wiki, listed from highest to lowest priority for each season. The first one whose conditions are definitely met wins; ones that depend on things you haven’t entered (or that the game picks at random) are shown as options instead of guessed.
            </p>
            {res.kind === 'schedule' && (
              <>
                <h3>Considered for {formatDate(ctx.date)}</h3>
                <ul className="small">
                  {res.branches.map((b) => (
                    <li key={b.block.id}>
                      <strong>{b.block.label}</strong> — {b.certainty === 'definite' ? 'applies' : b.certainty === 'random' ? 'random choice' : `possible (${b.unknowns.join('; ')})`}
                      <br />
                      <span className="muted">Condition: {describeCond(b.block.condition) || 'always'}</span>
                    </li>
                  ))}
                  {res.skipped.slice(0, 12).map((s) => (
                    <li key={s.block.id} className="muted">
                      {s.block.label} — skipped: {s.reasons.join('; ') || 'conditions not met'}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {v.scheduleNotes.length > 0 && (
              <>
                <h3>Notes</h3>
                {v.scheduleNotes.map((n) => (
                  <p key={n} className="small">
                    {n}
                  </p>
                ))}
              </>
            )}
            <SourceLink href={`${v.source}#Schedule`} label="Schedule on the Stardew Valley Wiki" />
          </Sheet>
        </div>
      )}

      {tab === 'gifts' && (
        <div className="stack" role="tabpanel">
          {bdayIn <= 7 && <p className="notice">🎂 Birthday {bdayIn === 0 ? 'today' : `in ${bdayIn} days`} — gifts are worth 8× friendship on their birthday.</p>}
          <div className="grid-2">
            {(
              [
                ['loves', 'Loves 😍'],
                ['likes', 'Likes 🙂'],
                ['neutrals', 'Neutral 😐'],
                ['dislikes', 'Dislikes 😕'],
                ['hates', 'Hates 😠'],
              ] as const
            ).map(([k, l]) => (
              <div className="card" key={k}>
                <h3>{l}</h3>
                <ul className="small">
                  {v.gifts[k].map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                  {v.gifts[k].length === 0 && <li className="muted">Nothing specific</li>}
                </ul>
                <details className="small">
                  <summary>Universal {k}</summary>
                  <p className="muted">Apply to everyone unless {v.name}’s own list above says otherwise.</p>
                  <ul>
                    {universalGifts[k].map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
          <div className="card stack-sm">
            <h3>Friendship & gift log (optional)</h3>
            <label className="field">
              Hearts with {v.name}: {hearts ?? 'not entered'}
              <input
                type="range"
                min={0}
                max={v.marriageable ? 14 : 10}
                value={hearts ?? 0}
                aria-valuetext={hearts === undefined ? 'not entered' : `${hearts} hearts`}
                onChange={(e) => update((p) => ({ ...p, progress: { ...p.progress, hearts: { ...p.progress.hearts, [v.id]: Number(e.target.value) } } }))}
              />
            </label>
            {hearts !== undefined && (
              <button
                type="button"
                className="btn small ghost"
                onClick={() =>
                  update((p) => {
                    const h = { ...p.progress.hearts };
                    delete h[v.id];
                    return { ...p, progress: { ...p.progress, hearts: h } };
                  })
                }
              >
                Clear (not entered)
              </button>
            )}
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (!giftItem.trim()) return;
                update((p) => ({ ...p, gifts: { ...p.gifts, [v.id]: [{ date: p.day.date, item: giftItem.trim().slice(0, 80) }, ...(p.gifts[v.id] ?? [])].slice(0, 200) } }));
                setGiftItem('');
              }}
            >
              <input className="input" placeholder="Gift given today…" value={giftItem} onChange={(e) => setGiftItem(e.target.value)} aria-label="Gift given today" />
              <button className="btn" type="submit">
                Log
              </button>
            </form>
            <ul className="small">
              {(profile.gifts[v.id] ?? []).slice(0, 10).map((g, i) => (
                <li key={i}>
                  {formatDate(g.date)} — {g.item}
                </li>
              ))}
            </ul>
            <p className="tiny muted">You can give each villager up to 2 gifts per week (plus one on their birthday).</p>
          </div>
        </div>
      )}

      {tab === 'info' && (
        <div className="card stack-sm" role="tabpanel">
          <p>{v.description}</p>
          <p className="small">
            <strong>Home:</strong> <Link to={`/map?place=${v.home}`}>{placeName(v.home)}</Link>
          </p>
          {v.marriageable && <p className="small">💍 Can be married.</p>}
          {v.availability && <p className="small">{v.availability.note}</p>}
          {checkups.filter((c) => c.villagerId === v.id).map((c) => (
            <p className="small" key={`${c.season}-${c.day}`}>
              🩺 Clinic check-up: {SEASON_LABEL[c.season]} {c.day}, {formatTime(c.window.start)} – {formatTime(c.window.end)}
            </p>
          ))}
          <SourceLink href={v.source} label="Stardew Valley Wiki" />
        </div>
      )}

      {tab === 'hearts' && (
        <div className="stack" role="tabpanel">
          {!spoilers ? (
            <div className="card stack-sm">
              <p>Heart events can contain story spoilers, so they’re hidden.</p>
              <button type="button" className="btn" onClick={() => update((p) => ({ ...p, prefs: { ...p.prefs, spoilers: 'show' } }))}>
                Show spoilers
              </button>
            </div>
          ) : v.heartEvents.length ? (
            v.heartEvents.map((e) => (
              <details className="card" key={`${e.heart}-${e.description}`}>
                <summary>
                  <strong>{e.heart} ♥</strong> — {e.description}
                </summary>
                <p className="small">{e.details}</p>
              </details>
            ))
          ) : (
            <Empty title="No heart events listed" />
          )}
        </div>
      )}
    </div>
  );
}
