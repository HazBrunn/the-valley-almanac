import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import { DayCard } from '../ui/DayControls';
import { Sign, Badge, Empty, useToast } from '../ui/common';
import { resolveDailyOpportunities, type Opportunity } from '../engine/opportunities';
import type { CalendarEvent } from '../engine/events';
import { toDayIndex, formatDate, WEEKDAY_SHORT, weekdayOf } from '../engine/calendar';
import { shops } from '../data';
import { resolveShopAvailability, SHOP_STATUS_LABEL } from '../engine/shops';
import { formatTime } from '../engine/time';

const LABEL_KIND: Record<string, string> = {
  'Available now': 'now',
  'Later today': 'later',
  Today: 'today',
  'Coming up': 'later',
  Conditional: 'conditional',
  Unknown: 'conditional',
  'Last chance': 'last',
};

const SECTIONS = [
  { id: 'highlights', label: "Today's highlights" },
  { id: 'weather', label: 'Weather opportunities' },
  { id: 'personal', label: 'For you' },
  { id: 'upcoming', label: 'Coming up' },
  { id: 'deadlines', label: 'Seasonal deadlines' },
];

function OppItem({ o, onDismiss }: { o: Opportunity; onDismiss?: () => void }) {
  const inner = (
    <>
      <span aria-hidden="true" style={{ fontSize: '1.5rem', width: 32, textAlign: 'center' }}>
        {o.icon}
      </span>
      <span className="grow">
        <span className="item-title">{o.title}</span> <Badge kind={LABEL_KIND[o.label]}>{o.label}</Badge>
        <span className="item-sub" style={{ display: 'block' }}>
          {o.detail}
        </span>
      </span>
    </>
  );
  return (
    <li className="row">
      {o.href ? (
        <Link className="item grow" to={o.href}>
          {inner}
        </Link>
      ) : (
        <div className="item grow">{inner}</div>
      )}
      {onDismiss && (
        <button type="button" className="icon-btn" aria-label={`Hide ${o.title} for today`} title="Hide for today" onClick={onDismiss}>
          ✕
        </button>
      )}
    </li>
  );
}

function EventItem({ e, onDismiss }: { e: CalendarEvent; onDismiss?: () => void }) {
  return (
    <OppItem
      o={{ id: e.id, label: e.certainty === 'certain' ? 'Today' : 'Conditional', icon: e.icon, title: e.title, detail: e.detail, href: e.href, weight: e.weight }}
      onDismiss={onDismiss}
    />
  );
}

export default function Today() {
  const { ctx, activeCtx, profile, update, isPreview } = useStore();
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  // Today always reflects the played day (preview is for exploring elsewhere).
  const digest = useMemo(() => resolveDailyOpportunities(activeCtx, profile), [activeCtx, profile]);
  const hidden = new Set(profile.prefs.hiddenTodaySections);
  const dayIdx = toDayIndex(activeCtx.date);
  const dismiss = (id: string, title: string) => {
    update((p) => ({ ...p, prefs: { ...p.prefs, dismissed: [...p.prefs.dismissed.filter((d) => Number(d.split(':')[0]) >= dayIdx - 7), `${dayIdx}:${id}`] } }));
    toast(`Hidden “${title}” for today`, {
      label: 'Undo',
      run: () => update((p) => ({ ...p, prefs: { ...p.prefs, dismissed: p.prefs.dismissed.filter((d) => d !== `${dayIdx}:${id}`) } })),
    });
  };
  const highlights = showAll ? digest.todayEvents : digest.todayEvents.filter((e) => e.weight >= 20).slice(0, 6);
  const openShops = showAll ? shops.map((s) => resolveShopAvailability(s, activeCtx)) : [];

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      {isPreview && (
        <div className="preview-banner">
          <span>
            You’re previewing {formatDate(ctx.date, { year: false })} on other tabs. Today shows your played day.
          </span>
        </div>
      )}
      <DayCard />

      <section className="card" aria-label="Summary">
        <p style={{ fontSize: '1.05rem' }}>{digest.summary}</p>
        <div className="row-wrap" style={{ marginTop: 10 }}>
          <Link className="btn small" to="/people">
            👤 Find a villager
          </Link>
          <Link className="btn small" to="/fish?filter=catchable">
            🎣 Catchable fish
          </Link>
          <Link className="btn small" to="/calendar">
            📅 Calendar
          </Link>
          <Link className="btn small" to="/map">
            🗺️ Map
          </Link>
        </div>
      </section>

      {!hidden.has('highlights') && (
        <section className="section" aria-labelledby="h-highlights">
          <Sign icon="⭐" id="h-highlights">
            Today’s highlights
          </Sign>
          <div className="card">
            {highlights.length ? (
              <ul className="list">
                {highlights.map((e) => (
                  <EventItem key={e.id} e={e} onDismiss={() => dismiss(e.id, e.title)} />
                ))}
              </ul>
            ) : (
              <Empty emoji="🌤️" title="Nothing date-specific today">
                <p className="small">No birthdays or festivals — a free day to do whatever you like.</p>
              </Empty>
            )}
            <button type="button" className="btn ghost small" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
              {showAll ? 'Show fewer' : 'See all today'}
            </button>
            {showAll && (
              <div className="stack-sm" style={{ marginTop: 10 }}>
                <h3>Shops today</h3>
                <ul className="list">
                  {openShops.map((r) => (
                    <li key={r.shop.id}>
                      <Link className="item" to={`/shops#${r.shop.id}`}>
                        <span className="grow">
                          <span className="item-title">{r.shop.name}</span>{' '}
                          <Badge kind={r.status === 'open' ? 'open' : r.status === 'conditional' ? 'conditional' : r.status === 'opens-later' ? 'later' : ''}>{SHOP_STATUS_LABEL[r.status]}</Badge>
                          <span className="item-sub" style={{ display: 'block' }}>
                            {r.hours ? `${formatTime(r.hours.start)} – ${formatTime(r.hours.end)}` : r.reasons.join('; ')}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {!hidden.has('weather') && (digest.weatherFish.length > 0 || digest.rainIfUnknown.length > 0) && (
        <section className="section" aria-labelledby="h-weather">
          <Sign icon="🌧️" id="h-weather">
            Rainy-day fishing
          </Sign>
          <div className="card">
            {digest.weatherFish.length > 0 ? (
              <ul className="list">
                {digest.weatherFish.map((o) => (
                  <OppItem key={o.id} o={o} />
                ))}
              </ul>
            ) : (
              <div className="stack-sm">
                <p className="notice">Weather isn’t set. If it’s raining, these rain-only fish are possible today:</p>
                <p>
                  {digest.rainIfUnknown.map((f, i) => (
                    <span key={f.id}>
                      {i > 0 && ', '}
                      <Link to={`/fish/${f.id}`}>{f.name}</Link>
                    </span>
                  ))}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {!hidden.has('personal') && (
        <section className="section" aria-labelledby="h-personal">
          <Sign icon="💛" id="h-personal">
            For you
          </Sign>
          <div className="card">
            {digest.personal.length ? (
              <ul className="list">
                {digest.personal.slice(0, showAll ? 50 : 8).map((o) => (
                  <OppItem key={o.id} o={o} onDismiss={() => dismiss(o.id.startsWith('watch-') && o.watchId ? `watch-${o.watchId}` : o.id, o.title)} />
                ))}
              </ul>
            ) : (
              <Empty emoji="⭐" title="Nothing on your watchlist needs you today">
                <p className="small">
                  Tap ☆ on any fish, villager, crop or bundle to watch it. Or turn on <Link to="/settings#prefs">collection focus</Link> to see fish you haven’t caught.
                </p>
              </Empty>
            )}
          </div>
        </section>
      )}

      {!hidden.has('upcoming') && (
        <section className="section" aria-labelledby="h-upcoming">
          <Sign icon="📅" id="h-upcoming">
            Coming up
          </Sign>
          <div className="card">
            {digest.upcoming.length ? (
              <ul className="list">
                {digest.upcoming.slice(0, 8).map((u) => (
                  <li key={`${u.inDays}-${u.event.id}`}>
                    <Link className="item" to={u.event.href ?? `/calendar?season=${u.date.season}&day=${u.date.day}&year=${u.date.year}`}>
                      <span aria-hidden="true" style={{ fontSize: '1.5rem', width: 32, textAlign: 'center' }}>
                        {u.event.icon}
                      </span>
                      <span className="grow">
                        <span className="item-title">{u.event.title}</span>
                        <span className="item-sub" style={{ display: 'block' }}>
                          {WEEKDAY_SHORT[weekdayOf(u.date)]} {formatDate(u.date, { year: false })} · {u.inDays === 1 ? 'tomorrow' : `in ${u.inDays} days`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty emoji="🍃" title="A calm week ahead" />
            )}
          </div>
        </section>
      )}

      {!hidden.has('deadlines') && digest.deadlines.length > 0 && (
        <section className="section" aria-labelledby="h-deadlines">
          <Sign icon="⏳" id="h-deadlines">
            Seasonal deadlines
          </Sign>
          <div className="card">
            <ul className="list">
              {digest.deadlines.map((o) => (
                <OppItem key={o.id} o={o} />
              ))}
            </ul>
          </div>
        </section>
      )}

      <details className="card why">
        <summary>Customise Today</summary>
        <div className="stack-sm">
          {SECTIONS.map((s) => (
            <label key={s.id} className="check">
              <input
                type="checkbox"
                checked={!hidden.has(s.id)}
                onChange={(e) =>
                  update((p) => ({
                    ...p,
                    prefs: {
                      ...p.prefs,
                      hiddenTodaySections: e.target.checked ? p.prefs.hiddenTodaySections.filter((x) => x !== s.id) : [...p.prefs.hiddenTodaySections, s.id],
                    },
                  }))
                }
              />
              Show “{s.label}”
            </label>
          ))}
          <label className="check">
            <input type="checkbox" checked={profile.prefs.collectionFocus} onChange={(e) => update((p) => ({ ...p, prefs: { ...p.prefs, collectionFocus: e.target.checked } }))} />
            Collection focus: suggest fish I haven’t caught yet
          </label>
        </div>
      </details>
    </div>
  );
}
