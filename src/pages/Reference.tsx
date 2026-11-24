import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { shops, crops, forage, recipes, calendarExtras, placeName, cropById } from '../data';
import { useStore } from '../state/store';
import { ContextBar } from '../ui/DayControls';
import { Badge, Empty, Sign, SourceLink, SubNav, WatchButton, useToast } from '../ui/common';
import { resolveShopAvailability, SHOP_STATUS_LABEL } from '../engine/shops';
import { calculateCropPlan, lastSafePlantingDay, FERTILISER_LABEL, type CropModifiers, type Fertiliser } from '../engine/crops';
import { qosSundayRecipe } from '../engine/events';
import { addDays, formatDate, SEASONS, SEASON_LABEL, WEEKDAY_LABEL, type GameDate, type Season } from '../engine/calendar';
import { formatTime } from '../engine/time';
import { norm } from '../engine/search';

type Section = 'shops' | 'crops' | 'forage' | 'recipes';

function useHashScroll() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) window.setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
  }, [hash]);
}

function Shops() {
  const { ctx } = useStore();
  const res = shops.map((s) => resolveShopAvailability(s, ctx));
  return (
    <div className="stack">
      <ContextBar />
      <p className="small muted">Opening status for the day shown above. Building access and the shopkeeper being at the counter are listed separately where they differ. Stock is never guessed.</p>
      <div className="grid-2">
        {res.map((r) => (
          <div className="card stack-sm" id={r.shop.id} key={r.shop.id}>
            <div className="row">
              <h3 className="grow">{r.shop.name}</h3>
              <Badge kind={r.status === 'open' ? 'open' : r.status === 'conditional' ? 'conditional' : r.status === 'opens-later' ? 'later' : ''}>{SHOP_STATUS_LABEL[r.status]}</Badge>
            </div>
            <div className="small">
              {r.hours ? `Today: ${formatTime(r.hours.start)} – ${formatTime(r.hours.end)}` : 'Not open today'}
              {r.shop.closedWeekdays.length > 0 && ` · Closed ${r.shop.closedWeekdays.map((d) => WEEKDAY_LABEL[d as keyof typeof WEEKDAY_LABEL]).join(', ')}`}
            </div>
            {r.reasons.map((x) => (
              <p key={x} className="small">
                ⛔ {x}
              </p>
            ))}
            {r.notes.map((x) => (
              <p key={x} className="small muted">
                ℹ️ {x}
              </p>
            ))}
            {r.shop.exceptions
              .filter((e) => !r.notes.includes(e.note) && !r.reasons.includes(e.note))
              .map((e) => (
                <p key={e.note} className="tiny muted">
                  • {e.note}
                </p>
              ))}
            <p className="small">{r.shop.sells}</p>
            <Link className="small" to={`/map?place=${r.shop.place}`}>
              📍 {placeName(r.shop.place)}
            </Link>
          </div>
        ))}
        <div className="card stack-sm" id="bookseller">
          <h3>Bookseller</h3>
          <p className="small">Visits twice each season on dates chosen at random for your save from these candidates:</p>
          <ul className="small">
            {SEASONS.map((s) => (
              <li key={s}>
                {SEASON_LABEL[s]}: {calendarExtras.bookseller[s].join(', ')}
              </li>
            ))}
          </ul>
          <p className="tiny muted">The in-game calendar shows the actual dates with a balloon icon. Open all day when in town (above JojaMart / the Movie Theater).</p>
        </div>
      </div>
      <SourceLink href="https://stardewvalleywiki.com/Shops" label="Shop hours on the Stardew Valley Wiki" />
    </div>
  );
}

const fertOptions: Fertiliser[] = ['none', 'speed-gro', 'deluxe-speed-gro', 'hyper-speed-gro'];

function Crops() {
  const { activeCtx, addWatch } = useStore();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [season, setSeason] = useState<Season>(activeCtx.date.season);
  const cropId = params.get('crop') ?? '';
  const crop = cropById.get(cropId);
  const [plant, setPlant] = useState<GameDate>(activeCtx.date);
  const [mods, setMods] = useState<CropModifiers>({ fertiliser: 'none', agriculturist: false, irrigated: false, protectedArea: false });
  const list = crops.filter((c) => c.seasons.includes(season));
  const plan = crop ? calculateCropPlan(crop, plant, mods) : null;
  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Season">
        {SEASONS.map((s) => (
          <button key={s} type="button" aria-pressed={season === s} onClick={() => setSeason(s)}>
            {SEASON_LABEL[s]}
          </button>
        ))}
      </div>
      {crop && plan && (
        <section className="card stack-sm" aria-labelledby="plan-h" id="planner">
          <div className="row">
            <h2 id="plan-h" className="grow">
              Plan: {crop.name}
            </h2>
            <WatchButton kind="crop" refId={crop.id} title={crop.name} />
            <button type="button" className="icon-btn" aria-label="Close planner" onClick={() => setParams({}, { replace: true })}>
              ✕
            </button>
          </div>
          <div className="row-wrap">
            <label className="field">
              Planting day
              <span className="row">
                <select className="input" style={{ width: 'auto' }} value={plant.season} onChange={(e) => setPlant({ ...plant, season: e.target.value as Season })} aria-label="Planting season">
                  {SEASONS.map((s) => (
                    <option key={s} value={s}>
                      {SEASON_LABEL[s]}
                    </option>
                  ))}
                </select>
                <input className="input" style={{ width: 80 }} type="number" min={1} max={28} value={plant.day} aria-label="Planting day" onChange={(e) => setPlant({ ...plant, day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
                <span className="small">Y{plant.year}</span>
              </span>
            </label>
            <label className="field">
              Fertiliser
              <select className="input" value={mods.fertiliser} onChange={(e) => setMods({ ...mods, fertiliser: e.target.value as Fertiliser })}>
                {fertOptions.map((f) => (
                  <option key={f} value={f}>
                    {FERTILISER_LABEL[f]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row-wrap">
            <label className="check">
              <input type="checkbox" checked={mods.agriculturist} onChange={(e) => setMods({ ...mods, agriculturist: e.target.checked })} /> Agriculturist (+10%)
            </label>
            {crop.paddy && (
              <label className="check">
                <input type="checkbox" checked={mods.irrigated} onChange={(e) => setMods({ ...mods, irrigated: e.target.checked })} /> Planted next to water (+25%)
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={mods.protectedArea} onChange={(e) => setMods({ ...mods, protectedArea: e.target.checked })} /> Greenhouse / Ginger Island farm
            </label>
          </div>
          {plan.valid ? (
            <>
              <p>
                <strong>
                  {plan.growDays} days to grow
                  {crop.regrowDays ? `, then every ${crop.regrowDays} days` : ''}
                </strong>{' '}
                · {plan.harvests.length} harvest{plan.harvests.length === 1 ? '' : 's'}
                {plan.deadline ? ` before ${formatDate(plan.deadline, { year: false })}` : ' in a year'}
              </p>
              <p className="small">Harvests: {plan.harvests.slice(0, 12).map((h) => formatDate(h, { year: false })).join(' · ')}{plan.harvests.length > 12 ? ' …' : ''}</p>
              <button
                type="button"
                className="btn small"
                onClick={() => {
                  addWatch({ kind: 'custom', title: `Harvest ${crop.name}`, due: plan.harvests[0]!, note: `Planted ${formatDate(plant)}` });
                  toast(`Reminder set for ${formatDate(plan.harvests[0]!, { year: false })}`);
                }}
              >
                Remind me on the first harvest
              </button>
            </>
          ) : (
            <p className="notice warn">{plan.reason}</p>
          )}
          {!plan.exact && <p className="tiny muted">Stage lengths for this crop aren’t in the dataset, so fertiliser days are estimated as growth − ⌈growth × speed⌉.</p>}
          <p className="tiny muted">Harvest day = planting day + growth days. Outdoor crops wither on the first night of a season they can’t grow in.</p>
        </section>
      )}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="simple">
          <caption className="sr-only">{SEASON_LABEL[season]} crops</caption>
          <thead>
            <tr>
              <th scope="col">Crop</th>
              <th scope="col">Grow</th>
              <th scope="col">Regrow</th>
              <th scope="col">Last safe planting</th>
              <th scope="col">Sells</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const last = lastSafePlantingDay(c, season, activeCtx.date.year);
              return (
                <tr key={c.id} id={c.id}>
                  <td>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => {
                        setParams({ crop: c.id }, { replace: true });
                        setPlant(season === activeCtx.date.season ? activeCtx.date : { year: activeCtx.date.year, season, day: 1 });
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      {c.name}
                    </button>
                    {c.seasons.length > 1 && <div className="tiny muted">{c.seasons.map((s) => SEASON_LABEL[s]).join(' + ')}</div>}
                  </td>
                  <td>{c.growDays}d</td>
                  <td>{c.regrowDays ? `${c.regrowDays}d` : '—'}</td>
                  <td>
                    {last ? `${SEASON_LABEL[season]} ${last}` : '—'}
                    {last && season === activeCtx.date.season && last >= activeCtx.date.day && last - activeCtx.date.day <= 3 && <Badge kind="last">Soon</Badge>}
                  </td>
                  <td>{c.sellPrice}g</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 && <Empty title="No crops for this season" />}
        <p className="tiny muted">Last safe planting assumes no speed fertiliser, planted outdoors. Tap a crop for the planner.</p>
      </div>
    </div>
  );
}

function Forage() {
  const { activeCtx } = useStore();
  const [season, setSeason] = useState<Season>(activeCtx.date.season);
  const list = forage.filter((f) => f.seasons.includes(season));
  const berries = calendarExtras.berries.filter((b) => b.season === season);
  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="Season">
        {SEASONS.map((s) => (
          <button key={s} type="button" aria-pressed={season === s} onClick={() => setSeason(s)}>
            {SEASON_LABEL[s]}
          </button>
        ))}
      </div>
      {berries.map((b) => {
        const active = activeCtx.date.season === b.season && activeCtx.date.day >= b.from && activeCtx.date.day <= b.to;
        return (
          <div key={b.id} className="card">
            <strong>
              {b.id === 'salmonberry' ? '🍓' : '🫐'} {b.name}: {SEASON_LABEL[b.season]} {b.from}–{b.to}
            </strong>{' '}
            {active && <Badge kind="now">On now</Badge>}
            <p className="small">{b.note}</p>
          </div>
        );
      })}
      <p className="small muted">Forage spawns are random: these are places an item can appear, not guarantees.</p>
      <div className="card">
        <ul className="list">
          {list.map((f) => (
            <li key={f.id} id={f.id} className="row">
              <div className="item grow" style={{ display: 'block' }}>
                <span className="item-title">{f.name}</span> {f.window && <Badge kind="later">{SEASON_LABEL[f.window.season]} {f.window.from}–{f.window.to}</Badge>}
                <span className="item-sub" style={{ display: 'block' }}>
                  {f.locations} · {f.sellPrice}g
                </span>
              </div>
              <WatchButton kind="forage" refId={f.id} title={f.name} compact />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function RecipesList() {
  const { profile, activeCtx, update } = useStore();
  const [q, setQ] = useState('');
  const upcoming = useMemo(() => {
    const out: { date: GameDate; name: string; id: string }[] = [];
    for (let i = 0; i <= 35 && out.length < 4; i++) {
      const d = addDays(activeCtx.date, i);
      const r = qosSundayRecipe(d);
      if (r) out.push({ date: d, name: r.name, id: r.id });
    }
    return out;
  }, [activeCtx.date]);
  const known = profile.collections.recipesKnown;
  const cooked = profile.collections.recipesCooked;
  const toggle = (key: 'recipesKnown' | 'recipesCooked', id: string) =>
    update((p) => {
      const m = { ...p.collections[key] };
      if (m[id]) delete m[id];
      else m[id] = true;
      return { ...p, collections: { ...p.collections, [key]: m } };
    });
  const list = recipes.filter((r) => !q || norm(r.name).includes(norm(q)) || r.ingredients.some((i) => norm(i.name).includes(norm(q))));
  return (
    <div className="stack">
      <section className="card stack-sm">
        <h3>📺 The Queen of Sauce — upcoming Sundays</h3>
        <ul className="list">
          {upcoming.map((u) => (
            <li key={u.id} className="item">
              <span className="grow">
                <a href={`#${u.id}`} className="item-title">
                  {u.name}
                </a>
                <span className="item-sub" style={{ display: 'block' }}>
                  Sunday {formatDate(u.date, { year: true })} {known[u.id] ? '· already known' : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="tiny muted">New recipes air on Sundays on a fixed 2-year rotation (odd years repeat Year 1, even years repeat Year 2). Wednesday reruns pick a random past recipe, preferring ones you don’t know — the Almanac can’t predict them.</p>
      </section>
      <div className="card stack-sm">
        <h3>
          Recipes: {Object.keys(known).length} known · {Object.keys(cooked).length} cooked / {recipes.length}
        </h3>
        <input className="input" type="search" placeholder="Search recipes or ingredients…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" />
      </div>
      <div className="card">
        <ul className="list">
          {list.map((r) => (
            <li key={r.id} id={r.id} className="stack-sm" style={{ padding: '8px 0' }}>
              <div className="row-wrap">
                <strong className="grow">{r.name}</strong>
                <label className="check small">
                  <input type="checkbox" checked={!!known[r.id]} onChange={() => toggle('recipesKnown', r.id)} /> Known
                </label>
                <label className="check small">
                  <input type="checkbox" checked={!!cooked[r.id]} onChange={() => toggle('recipesCooked', r.id)} /> Cooked
                </label>
              </div>
              <span className="small">{r.ingredients.map((i) => `${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`).join(', ')}</span>
              <span className="tiny muted">
                {r.sources.join(' · ')}
                {r.tv ? ` · TV: ${SEASON_LABEL[r.tv.season]} ${r.tv.day} in ${r.tv.cycleYear === 1 ? 'odd' : 'even'} years` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Reference({ section }: { section: Section }) {
  useHashScroll();
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <SubNav
        items={[
          { to: '/shops', label: 'Shops', current: section === 'shops' },
          { to: '/crops', label: 'Crops', current: section === 'crops' },
          { to: '/forage', label: 'Foraging', current: section === 'forage' },
          { to: '/recipes', label: 'Recipes & TV', current: section === 'recipes' },
        ]}
      />
      {section === 'shops' && <Shops />}
      {section === 'crops' && <Crops />}
      {section === 'forage' && <Forage />}
      {section === 'recipes' && <RecipesList />}
      <Sign as="h3">More</Sign>
      <p className="small">
        <Link to="/journal/museum">Museum donations</Link> · <Link to="/journal/bundles">Bundles</Link> · <Link to="/calendar">Calendar</Link>
      </p>
    </div>
  );
}
