import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../state/store';
import { Badge, Sign, useToast } from '../ui/common';
import { SEASONS, SEASON_LABEL, WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_LABEL, isSeason, sameDate, formatDate, weekdayOf, relativeDays, nextSeason, previousSeason, type GameDate, type Season } from '../engine/calendar';
import { resolveCalendarEvents, EVENT_LAYERS, LAYER_LABEL, type CalendarEvent, type EventLayer } from '../engine/events';
import { compareDates } from '../engine/calendar';

function personalEvents(date: GameDate, profile: ReturnType<typeof useStore>['profile']): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const w of profile.watchlist)
    if (w.due && sameDate(w.due, date) && !w.done)
      out.push({ id: `w-${w.id}`, layer: 'personal', icon: '📝', title: w.title, detail: w.note ?? 'Reminder', certainty: 'certain', href: '/journal', weight: 88 });
  for (const n of profile.notes)
    if (sameDate(n.date, date)) out.push({ id: `n-${n.id}`, layer: 'personal', icon: '🗒️', title: n.text.slice(0, 60), detail: 'Note', certainty: 'certain', href: '/journal/notes', weight: 30 });
  return out;
}

export default function Calendar() {
  const { activeCtx, profile, update, setPreview, commitPreviewDate, addWatch } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const season: Season = isSeason(params.get('season')) ? (params.get('season') as Season) : activeCtx.date.season;
  const year = Math.max(1, Number(params.get('year')) || activeCtx.date.year);
  const selDay = Number(params.get('day')) || (season === activeCtx.date.season && year === activeCtx.date.year ? activeCtx.date.day : 1);
  const selected: GameDate = { year, season, day: Math.min(28, Math.max(1, selDay)) };
  const hidden = new Set(profile.prefs.hiddenLayers);
  const [reminder, setReminder] = useState('');

  const go = (s: Season, y: number, d?: number) => {
    const p = new URLSearchParams();
    p.set('season', s);
    p.set('year', String(y));
    if (d) p.set('day', String(d));
    setParams(p, { replace: true });
  };

  const days = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const date = { year, season, day: i + 1 };
        const evs = [...resolveCalendarEvents(date, activeCtx.progress), ...personalEvents(date, profile)].filter(
          (e) => !hidden.has(e.layer) && (profile.prefs.spoilers === 'show' || !e.spoiler),
        );
        return { date, evs };
      }),
    [year, season, activeCtx.progress, profile, hidden],
  );
  const selEvents = days[selected.day - 1]!.evs;
  const isPlayed = sameDate(selected, activeCtx.date);
  const prevS = previousSeason(season);
  const nextS = nextSeason(season);

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <div className="row-wrap">
        <div className="seg" role="group" aria-label="Season">
          {SEASONS.map((s) => (
            <button key={s} type="button" aria-pressed={s === season} onClick={() => go(s, year)}>
              {SEASON_LABEL[s]}
            </button>
          ))}
        </div>
        <label className="row small" style={{ fontWeight: 800 }}>
          Year
          <select className="input" style={{ width: 90 }} value={year} onChange={(e) => go(season, Number(e.target.value))}>
            {Array.from({ length: Math.max(activeCtx.date.year + 3, 4) }, (_, i) => i + 1).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        {(season !== activeCtx.date.season || year !== activeCtx.date.year) && (
          <button type="button" className="btn small ghost" onClick={() => go(activeCtx.date.season, activeCtx.date.year, activeCtx.date.day)}>
            Back to my day
          </button>
        )}
      </div>
      <div className="row">
        <button type="button" className="icon-btn" aria-label={`Previous season (${SEASON_LABEL[prevS]})`} onClick={() => go(prevS, season === 'spring' ? Math.max(1, year - 1) : year)}>
          ‹
        </button>
        <h2 className="grow" style={{ textAlign: 'center' }}>
          {SEASON_LABEL[season]}, Year {year} <span className="small muted">(28 days)</span>
        </h2>
        <button type="button" className="icon-btn" aria-label={`Next season (${SEASON_LABEL[nextS]})`} onClick={() => go(nextS, season === 'winter' ? year + 1 : year)}>
          ›
        </button>
      </div>

      <div className="cal" role="grid" aria-label={`${SEASON_LABEL[season]} Year ${year}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-head" role="columnheader" aria-label={WEEKDAY_LABEL[w]}>
            {WEEKDAY_SHORT[w]}
          </div>
        ))}
        {days.map(({ date, evs }) => {
          const today = sameDate(date, activeCtx.date);
          const sel = sameDate(date, selected);
          const inRange = evs.some((e) => e.range);
          const label = `${SEASON_LABEL[season]} ${date.day}, ${WEEKDAY_LABEL[weekdayOf(date)]}${today ? ' (your current day)' : ''}. ${evs.length ? evs.map((e) => e.title).join('; ') : 'No events'}`;
          return (
            <button key={date.day} type="button" className={`cal-day ${today ? 'today' : ''} ${sel ? 'sel' : ''} ${inRange ? 'range' : ''}`} aria-pressed={sel} aria-label={label} onClick={() => go(season, year, date.day)}>
              <span className="n">{date.day}</span>
              <span className="ev" aria-hidden="true">
                {evs.filter((e) => !e.minor).slice(0, 4).map((e) => (
                  <span key={e.id} style={{ opacity: e.certainty === 'certain' ? 1 : 0.55 }}>
                    {e.icon}
                  </span>
                ))}
                {evs.filter((e) => !e.minor).length > 4 && <span className="tiny">+{evs.filter((e) => !e.minor).length - 4}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="tiny muted">Bold border: your current played day. Faded icons are possibilities, not certainties.</p>

      <section className="card stack-sm" aria-labelledby="sel-h" aria-live="polite">
        <h2 id="sel-h">
          {formatDate(selected, { weekday: true })} <span className="small muted">({relativeDays(activeCtx.date, selected)})</span>
        </h2>
        {selEvents.length ? (
          <ul className="list">
            {selEvents.map((e) => (
              <li key={e.id}>
                <Link className="item" to={e.href ?? '#'}>
                  <span aria-hidden="true" style={{ fontSize: '1.4rem', width: 30, textAlign: 'center' }}>
                    {e.icon}
                  </span>
                  <span className="grow">
                    <span className="item-title">{e.title}</span> {e.certainty !== 'certain' && <Badge kind={e.certainty}>{e.certainty === 'possible' ? 'Possible' : 'Conditional'}</Badge>}
                    <span className="item-sub" style={{ display: 'block' }}>
                      {e.detail}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing scheduled — fish, forage, or visit a friend.</p>
        )}
        <div className="row-wrap">
          {!isPlayed && (
            <>
              <Link to="/fish/timeline" className="btn small" onClick={() => setPreview({ date: selected })}>
                Preview fish on this day
              </Link>
              <Link to="/people" className="btn small" onClick={() => setPreview({ date: selected })}>
                Preview villagers
              </Link>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  commitPreviewDate(selected);
                  toast(`Your current day is now ${formatDate(selected)}`);
                }}
              >
                Make this my current day
              </button>
            </>
          )}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reminder.trim()) return;
            addWatch({ kind: 'custom', title: reminder.trim().slice(0, 120), due: selected });
            setReminder('');
            toast('Reminder added — it will appear on Today near the date');
          }}
        >
          <input className="input" value={reminder} onChange={(e) => setReminder(e.target.value)} placeholder={`Add a reminder for ${SEASON_LABEL[season]} ${selected.day}…`} aria-label="New reminder text" />
          <button className="btn" type="submit">
            Add
          </button>
        </form>
        {compareDates(selected, activeCtx.date) < 0 && <p className="tiny muted">This date is in the past for your farm.</p>}
      </section>

      <section className="section">
        <Sign icon="🎛️">Layers</Sign>
        <div className="chips" role="group" aria-label="Calendar layers" style={{ flexWrap: 'wrap' }}>
          {EVENT_LAYERS.map((l: EventLayer) => (
            <button
              key={l}
              type="button"
              className="chip"
              aria-pressed={!hidden.has(l)}
              onClick={() =>
                update((p) => ({
                  ...p,
                  prefs: { ...p.prefs, hiddenLayers: hidden.has(l) ? p.prefs.hiddenLayers.filter((x) => x !== l) : [...p.prefs.hiddenLayers, l] },
                }))
              }
            >
              {LAYER_LABEL[l]}
            </button>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>
          Legend: 🎂 birthday · 🥚💐🍲🎡🎃⛸️🎁 festivals · 🏜️🎣🦑🌙 mini-festivals · 🛒 Traveling Cart · 📚 Bookseller (possible) · 🍓🫐 berry season · 🌱 last planting day · 📺 TV · 🩺 check-up · ⛈️ storm · 🌿 green rain (possible) · 📝 your reminders
        </p>
      </section>
    </div>
  );
}
