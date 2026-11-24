import { useState } from 'react';
import { useStore } from '../state/store';
import { SEASONS, SEASON_LABEL, WEEKDAY_LABEL, WEEKDAY_SHORT, WEEKDAYS, formatDate, weekdayOf, type GameDate, type Season, sameDate } from '../engine/calendar';
import { WEATHER_ICON, WEATHER_LABEL, weatherOptionsFor, type Weather } from '../engine/weather';
import { DAY_START, DAY_END, TIME_STEP, formatTime, type GameMinutes } from '../engine/time';
import { Sheet, useToast } from './common';

export function WeatherPicker({ value, season, onChange, label, includeUnknown = true }: { value: Weather; season: Season; onChange: (w: Weather) => void; label: string; includeUnknown?: boolean }) {
  const opts: Weather[] = [...weatherOptionsFor(season), ...(includeUnknown ? (['unknown'] as Weather[]) : [])];
  return (
    <div className="weather-row" role="group" aria-label={label}>
      {opts.map((w) => (
        <button key={w} type="button" className="weather-btn" aria-pressed={value === w} onClick={() => onChange(w)}>
          <span aria-hidden="true">{WEATHER_ICON[w]}</span>
          {w === 'unknown' ? 'Not sure' : WEATHER_LABEL[w]}
        </button>
      ))}
    </div>
  );
}

export function TimeControl({ value, onChange, label = 'Time of day' }: { value: GameMinutes | null; onChange: (t: GameMinutes | null) => void; label?: string }) {
  const t = value ?? 14 * 60;
  return (
    <div className="stack-sm">
      <label className="check">
        <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? t : null)} />
        <span>Set a time of day</span>
      </label>
      {value !== null && (
        <div className="time-row">
          <button type="button" className="icon-btn" aria-label="10 minutes earlier" onClick={() => onChange(Math.max(DAY_START, value - TIME_STEP))}>
            −
          </button>
          <input
            type="range"
            min={DAY_START}
            max={DAY_END}
            step={TIME_STEP}
            value={value}
            aria-label={label}
            aria-valuetext={formatTime(value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <button type="button" className="icon-btn" aria-label="10 minutes later" onClick={() => onChange(Math.min(DAY_END, value + TIME_STEP))}>
            +
          </button>
          <span className="time-label" aria-live="polite">
            {formatTime(value)}
          </span>
        </div>
      )}
      {value !== null && (
        <div className="row-wrap">
          {[6, 9, 12, 15, 18, 21, 24].map((h) => (
            <button key={h} type="button" className="chip" onClick={() => onChange(h * 60)} aria-pressed={value === h * 60}>
              {formatTime(h * 60)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatePicker({ value, onChange }: { value: GameDate; onChange: (d: GameDate) => void }) {
  return (
    <div className="stack">
      <div className="row-wrap">
        <div className="seg" role="group" aria-label="Season">
          {SEASONS.map((s) => (
            <button key={s} type="button" aria-pressed={value.season === s} onClick={() => onChange({ ...value, season: s })}>
              {SEASON_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="row">
          <button type="button" className="icon-btn" aria-label="Previous year" disabled={value.year <= 1} onClick={() => onChange({ ...value, year: Math.max(1, value.year - 1) })}>
            −
          </button>
          <span className="nowrap" style={{ fontWeight: 800 }}>
            Year {value.year}
          </span>
          <button type="button" className="icon-btn" aria-label="Next year" onClick={() => onChange({ ...value, year: Math.min(999, value.year + 1) })}>
            +
          </button>
        </div>
      </div>
      <div className="cal" role="grid" aria-label={`${SEASON_LABEL[value.season]} days`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-head" role="columnheader">
            {WEEKDAY_SHORT[w]}
          </div>
        ))}
        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
          <button
            key={d}
            type="button"
            className={`cal-day ${value.day === d ? 'sel' : ''}`}
            style={{ minHeight: 44 }}
            aria-pressed={value.day === d}
            aria-label={`${SEASON_LABEL[value.season]} ${d}, ${WEEKDAY_LABEL[weekdayOf({ day: d })]}`}
            onClick={() => onChange({ ...value, day: d })}
          >
            <span className="n">{d}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Big day card on Today. */
export function DayCard() {
  const { profile, setDay, nextDay, prevDay, update, isPreview } = useStore();
  const toast = useToast();
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<GameDate>(profile.day.date);
  const d = profile.day;
  return (
    <section className="card day-card" aria-labelledby="day-heading">
      <h2 id="day-heading" className="sr-only">
        Your current game day
      </h2>
      <div className="day-row">
        <button
          type="button"
          className="icon-btn"
          aria-label="Previous day (undo)"
          onClick={() => {
            const undone = prevDay();
            toast(undone ? 'Went back to the previous day' : 'Moved back one day (weather not set)');
          }}
        >
          ‹
        </button>
        <button
          type="button"
          className="day-date"
          onClick={() => {
            setDraft(d.date);
            setPicking(true);
          }}
          aria-label={`Current day ${formatDate(d.date, { weekday: true })}. Change date`}
        >
          <span className="d1">
            {SEASON_LABEL[d.date.season]} {d.date.day}, Year {d.date.year}
          </span>
          <span className="d2">{WEEKDAY_LABEL[weekdayOf(d.date)]}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next day"
          onClick={() => {
            const r = nextDay();
            toast(r.auto ? `Good morning! ${r.auto}` : 'Good morning! Set today’s weather when you know it.');
          }}
        >
          ›
        </button>
      </div>
      {isPreview && <p className="small muted">You are previewing another day elsewhere; this card always shows your played day.</p>}
      <WeatherPicker value={d.weather} season={d.date.season} onChange={(w) => setDay({ weather: w })} label="Today's weather" />
      {d.weather === 'unknown' && <p className="small muted">Weather isn’t set, so rain-only fish and rainy schedules are shown as possibilities.</p>}
      <TimeControl value={d.time} onChange={(t) => setDay({ time: t })} />
      <div className="row-wrap">
        <button
          type="button"
          className="btn primary big grow"
          onClick={() => {
            const r = nextDay();
            toast(r.auto ? `Good morning! ${r.auto}` : 'Good morning! Set today’s weather when you know it.');
          }}
        >
          Next day <span aria-hidden="true">→</span>
        </button>
      </div>
      <details className="why">
        <summary>Tomorrow’s forecast (from the TV) · Ginger Island weather</summary>
        <div className="stack">
          <p className="small muted">If you checked the TV weather report, enter it here and the next day starts with it. Otherwise the next day starts as “not sure”.</p>
          <WeatherPicker value={profile.tomorrowWeather} season={d.date.season} onChange={(w) => update((p) => ({ ...p, tomorrowWeather: w }))} label="Tomorrow's forecast" />
          <p className="small muted">Ginger Island has its own weather (sun or rain).</p>
          <div className="weather-row" role="group" aria-label="Ginger Island weather">
            {(['sun', 'rain', 'unknown'] as Weather[]).map((w) => (
              <button key={w} type="button" className="weather-btn" aria-pressed={d.islandWeather === w} onClick={() => setDay({ islandWeather: w })}>
                <span aria-hidden="true">{WEATHER_ICON[w]}</span>
                {w === 'unknown' ? 'Not sure' : WEATHER_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      </details>
      <Sheet open={picking} onClose={() => setPicking(false)} title="Set your game day">
        <DatePicker value={draft} onChange={setDraft} />
        <div className="row-wrap">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              if (!sameDate(draft, d.date)) setDay({ date: draft, weather: 'unknown', islandWeather: 'unknown' });
              setPicking(false);
            }}
          >
            Use {formatDate(draft)}
          </button>
          <button type="button" className="btn ghost" onClick={() => setPicking(false)}>
            Cancel
          </button>
        </div>
      </Sheet>
    </section>
  );
}

/** Compact shared-context chip for every other tab, with an edit sheet. */
export function ContextBar({ allowPreview = true }: { allowPreview?: boolean }) {
  const { ctx, activeCtx, isPreview, clearPreview, setPreview, setDay, commitPreviewDate, preview } = useStore();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'played' | 'preview'>('played');
  const [draft, setDraft] = useState<GameDate>(ctx.date);
  return (
    <>
      <div className="context-bar">
        <button
          type="button"
          className={`ctx-chip ${isPreview ? 'preview' : ''}`}
          onClick={() => {
            setDraft(ctx.date);
            setMode(isPreview ? 'preview' : 'played');
            setOpen(true);
          }}
          aria-label={`${isPreview ? 'Previewing' : 'Game day'}: ${formatDate(ctx.date, { weekday: true })}, ${WEATHER_LABEL[ctx.weather]}${ctx.time !== null ? `, ${formatTime(ctx.time)}` : ''}. Change`}
        >
          <span aria-hidden="true">📅</span>
          {isPreview && <span className="badge conditional">Preview</span>}
          <span>
            {SEASON_LABEL[ctx.date.season]} {ctx.date.day} · Y{ctx.date.year} · {WEEKDAY_SHORT[weekdayOf(ctx.date)]}
          </span>
          <span aria-hidden="true">{WEATHER_ICON[ctx.weather]}</span>
          {ctx.time !== null && <span className="nowrap">{formatTime(ctx.time)}</span>}
          <span aria-hidden="true">✎</span>
        </button>
        {isPreview && (
          <button type="button" className="btn small ghost" onClick={clearPreview}>
            Back to played day
          </button>
        )}
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Game day & conditions">
        {allowPreview && (
          <div className="seg" role="group" aria-label="What to change">
            <button type="button" aria-pressed={mode === 'played'} onClick={() => setMode('played')}>
              My played day
            </button>
            <button type="button" aria-pressed={mode === 'preview'} onClick={() => setMode('preview')}>
              Preview (temporary)
            </button>
          </div>
        )}
        {mode === 'played' ? (
          <div className="stack">
            <p className="small muted">Changes here update your saved game day everywhere.</p>
            <p>
              <strong>{formatDate(activeCtx.date, { weekday: true })}</strong>
            </p>
            <WeatherPicker value={activeCtx.weather} season={activeCtx.date.season} onChange={(w) => setDay({ weather: w })} label="Weather" />
            <TimeControl value={activeCtx.time} onChange={(t) => setDay({ time: t })} />
            <p className="small muted">To change the date or move to the next day, use the day card on Today.</p>
          </div>
        ) : (
          <div className="stack">
            <p className="small muted">Explore another day, weather or time without changing your saved game.</p>
            <DatePicker value={draft} onChange={(dd) => { setDraft(dd); setPreview({ date: dd }); }} />
            <WeatherPicker value={ctx.weather} season={ctx.date.season} onChange={(w) => setPreview({ weather: w })} label="Preview weather" />
            <TimeControl value={ctx.time} onChange={(t) => setPreview({ time: t })} label="Preview time" />
            <div className="row-wrap">
              {preview.date && !sameDate(preview.date, activeCtx.date) && (
                <button type="button" className="btn" onClick={() => { commitPreviewDate(preview.date!); setOpen(false); }}>
                  Make this my current day
                </button>
              )}
              <button type="button" className="btn ghost" onClick={() => { clearPreview(); setOpen(false); }}>
                End preview
              </button>
            </div>
          </div>
        )}
        <button type="button" className="btn primary" onClick={() => setOpen(false)}>
          Done
        </button>
      </Sheet>
    </>
  );
}
