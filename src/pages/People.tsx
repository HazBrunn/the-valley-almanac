import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { villagers } from '../data';
import { useStore } from '../state/store';
import { ContextBar } from '../ui/DayControls';
import { Portrait } from '../ui/icons';
import { Badge, Empty } from '../ui/common';
import { resolveVillagerSchedule, summariseLocation } from '../engine/schedule';
import { SEASON_LABEL, daysBetween } from '../engine/calendar';
import { resolveFlag } from '../engine/progress';
import { norm } from '../engine/search';

type Filter = 'all' | 'favourites' | 'birthday' | 'marriageable' | 'watched';

export default function People() {
  const { ctx, profile } = useStore();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const filter = (params.get('filter') as Filter) ?? 'all';
  const sort = params.get('sort') ?? 'name';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const list = useMemo(() => {
    const spoilers = profile.prefs.spoilers === 'show';
    let vs = villagers.filter((v) => spoilers || !v.availability?.spoiler || (v.availability.requires && resolveFlag(v.availability.requires, ctx.progress, ctx.date)));
    if (q) vs = vs.filter((v) => norm(v.name).includes(norm(q)) || norm(v.occupation).includes(norm(q)));
    if (filter === 'favourites') vs = vs.filter((v) => profile.favourites[v.id]);
    if (filter === 'birthday') vs = vs.filter((v) => v.birthday.season === ctx.date.season);
    if (filter === 'marriageable') vs = vs.filter((v) => v.marriageable);
    if (filter === 'watched') vs = vs.filter((v) => profile.watchlist.some((w) => w.kind === 'villager' && w.ref === v.id));
    const daysTo = (v: (typeof villagers)[number]) => {
      const d = daysBetween(ctx.date, { year: ctx.date.year, season: v.birthday.season, day: v.birthday.day });
      return d < 0 ? d + 112 : d;
    };
    if (sort === 'birthday') vs = [...vs].sort((a, b) => daysTo(a) - daysTo(b));
    return vs.map((v) => ({ v, res: resolveVillagerSchedule(v.id, ctx), bdayIn: daysTo(v) }));
  }, [ctx, profile, q, filter, sort]);

  return (
    <div className="stack">
      <ContextBar />
      <div className="stack-sm">
        <label className="field">
          <span className="sr-only">Search villagers</span>
          <input className="input" type="search" placeholder="Search villagers…" value={q} onChange={(e) => set('q', e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filter villagers">
          {(
            [
              ['all', 'Everyone'],
              ['favourites', '♥ Favourites'],
              ['watched', '★ Watched'],
              ['birthday', `🎂 ${SEASON_LABEL[ctx.date.season]} birthdays`],
              ['marriageable', '💍 Marriage candidates'],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => set('filter', k === 'all' ? '' : k)}>
              {l}
            </button>
          ))}
          <button type="button" className="chip" aria-pressed={sort === 'birthday'} onClick={() => set('sort', sort === 'birthday' ? '' : 'birthday')}>
            Sort: {sort === 'birthday' ? 'next birthday' : 'A–Z'}
          </button>
        </div>
      </div>
      {ctx.time === null && <p className="small muted">Set a time of day (tap the date chip) to see where everyone is right now.</p>}
      {list.length === 0 ? (
        <Empty emoji="🔍" title="No villagers match">
          <button type="button" className="btn small" onClick={() => setParams({}, { replace: true })}>
            Clear filters
          </button>
        </Empty>
      ) : (
        <ul className="grid-portraits list" style={{ listStyle: 'none' }} aria-label="Villagers">
          {list.map(({ v, res, bdayIn }) => (
            <li key={v.id} style={{ borderTop: 0 }}>
              <Link to={`/people/${v.id}`} className="card villager-card">
                <div className="row">
                  <Portrait name={v.name} />
                  <div className="grow">
                    <div className="item-title">
                      {v.name} {profile.favourites[v.id] && <span aria-label="favourite">♥</span>}
                    </div>
                    <div className="tiny muted">
                      🎂 {SEASON_LABEL[v.birthday.season]} {v.birthday.day}
                    </div>
                  </div>
                </div>
                {bdayIn === 0 && <Badge kind="last">🎂 Birthday today!</Badge>}
                {bdayIn > 0 && bdayIn <= 7 && <Badge kind="later">Birthday in {bdayIn}d</Badge>}
                <span className="small">{res ? summariseLocation(res, ctx.time) : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
