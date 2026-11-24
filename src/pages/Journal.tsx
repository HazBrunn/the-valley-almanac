import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fish as ALL_FISH, museum, bundles as ALL_BUNDLES } from '../data';
import { useStore } from '../state/store';
import { Badge, Empty, FishBadge, Sign, SubNav, useToast } from '../ui/common';
import { FishGlyph } from '../ui/icons';
import { glyphShape } from '../ui/fishShape';
import { RecipesList } from './Reference';
import { addDays, formatDate, SEASONS, SEASON_LABEL, compareDates, type GameDate, type Season } from '../engine/calendar';
import { resolveFishAvailability } from '../engine/fish';
import { activeBundles, bundleComplete, bundleSubmitted } from '../engine/collections';
import type { WatchItem } from '../engine/profile';
import { norm } from '../engine/search';

type Section = 'watch' | 'fish' | 'bundles' | 'museum' | 'recipes' | 'notes';

const KIND_ICON: Record<WatchItem['kind'], string> = {
  fish: '🐟',
  villager: '👤',
  crop: '🌱',
  forage: '🍄',
  bundle: '🧺',
  event: '🎪',
  recipe: '🍳',
  museum: '🏺',
  custom: '📝',
};

function hrefFor(w: WatchItem): string {
  switch (w.kind) {
    case 'fish':
      return `/fish/${w.ref}`;
    case 'villager':
      return `/people/${w.ref}`;
    case 'crop':
      return `/crops?crop=${w.ref}`;
    case 'forage':
      return `/forage#${w.ref}`;
    case 'bundle':
      return `/journal/bundles#${w.ref}`;
    case 'recipe':
      return `/recipes#${w.ref}`;
    case 'museum':
      return `/journal/museum#${w.ref}`;
    default:
      return '/journal';
  }
}

function DateFields({ value, onChange }: { value: GameDate | undefined; onChange: (d: GameDate | undefined) => void }) {
  const { activeCtx } = useStore();
  const v = value ?? activeCtx.date;
  return (
    <div className="row-wrap">
      <label className="check">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? activeCtx.date : undefined)} />
        In-game date
      </label>
      {value && (
        <>
          <select className="input" style={{ width: 'auto' }} aria-label="Season" value={v.season} onChange={(e) => onChange({ ...v, season: e.target.value as Season })}>
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {SEASON_LABEL[s]}
              </option>
            ))}
          </select>
          <input className="input" style={{ width: 80 }} type="number" min={1} max={28} aria-label="Day" value={v.day} onChange={(e) => onChange({ ...v, day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
          <input className="input" style={{ width: 90 }} type="number" min={1} max={999} aria-label="Year" value={v.year} onChange={(e) => onChange({ ...v, year: Math.max(1, Number(e.target.value) || 1) })} />
        </>
      )}
    </div>
  );
}

function Watchlist() {
  const { profile, activeCtx, updateWatch, removeWatch, addWatch } = useStore();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<GameDate | undefined>();
  const [recurring, setRecurring] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const active = profile.watchlist.filter((w) => !w.done).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.due && b.due ? compareDates(a.due, b.due) : a.due ? -1 : b.due ? 1 : 0));
  const done = profile.watchlist.filter((w) => w.done);
  return (
    <div className="stack">
      <form
        className="card stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addWatch({ kind: 'custom', title: title.trim().slice(0, 120), ...(due ? { due } : {}), recurring });
          setTitle('');
          setDue(undefined);
          setRecurring(false);
          toast('Goal added');
        }}
      >
        <h3>Add a personal goal</h3>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Give Vincent a birthday gift, buy a Rain Totem…" aria-label="Goal" />
        <DateFields value={due} onChange={setDue} />
        <label className="check">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} /> Recurring opportunity (keep after completing)
        </label>
        <button type="submit" className="btn primary">
          Add goal
        </button>
        <p className="tiny muted">Reminders appear on Today when you advance your game day in the Almanac — the app can’t see your real game while it’s closed.</p>
      </form>
      <div className="card">
        {active.length ? (
          <ul className="list">
            {active.map((w) => {
              const snoozed = w.snoozedUntil && compareDates(w.snoozedUntil, activeCtx.date) > 0;
              return (
                <li key={w.id} className="stack-sm" style={{ padding: '8px 0' }}>
                  <div className="row">
                    <Link className="item grow" to={hrefFor(w)}>
                      <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>
                        {w.pinned ? '📌' : KIND_ICON[w.kind]}
                      </span>
                      <span className="grow">
                        <span className="item-title">{w.title}</span> {w.recurring && <Badge>Recurring</Badge>} {snoozed && <Badge kind="conditional">Snoozed until {formatDate(w.snoozedUntil!, { year: false })}</Badge>}
                        <span className="item-sub" style={{ display: 'block' }}>
                          {w.due ? `Due ${formatDate(w.due)}` : 'No date'}
                          {w.note ? ` · ${w.note}` : ''}
                        </span>
                      </span>
                    </Link>
                  </div>
                  <div className="row-wrap">
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        if (w.recurring) {
                          updateWatch(w.id, { snoozedUntil: addDays(activeCtx.date, 1) });
                          toast(`Nice! ${w.title} — see you next time`);
                        } else {
                          updateWatch(w.id, { done: true });
                          toast(`✨ Done: ${w.title}`, { label: 'Undo', run: () => updateWatch(w.id, { done: false }) });
                        }
                      }}
                    >
                      ✓ {w.recurring ? 'Done today' : 'Complete'}
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => updateWatch(w.id, { pinned: !w.pinned })} aria-pressed={!!w.pinned}>
                      {w.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => (updateWatch(w.id, { snoozedUntil: addDays(activeCtx.date, 7) }), toast('Snoozed for a week'))}>
                      Snooze 7 days
                    </button>
                    <button type="button" className="btn small ghost" onClick={() => setEditing(editing === w.id ? null : w.id)} aria-expanded={editing === w.id}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => {
                        removeWatch(w.id);
                        toast(`Removed ${w.title}`, { label: 'Undo', run: () => addWatch({ ...w }) });
                      }}
                    >
                      Remove
                    </button>
                  </div>
                  {editing === w.id && (
                    <div className="stack-sm card flat">
                      <label className="field">
                        Note
                        <textarea className="input" defaultValue={w.note ?? ''} onBlur={(e) => updateWatch(w.id, { note: e.target.value.slice(0, 1000) })} />
                      </label>
                      <DateFields value={w.due} onChange={(d) => updateWatch(w.id, { due: d })} />
                      {w.snoozedUntil && (
                        <button type="button" className="btn small ghost" onClick={() => updateWatch(w.id, { snoozedUntil: undefined })}>
                          Un-snooze
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty emoji="⭐" title="Your watchlist is empty">
            <p className="small">Tap ☆ Watch on a fish, villager, crop, forage item or bundle — or add your own goal above.</p>
          </Empty>
        )}
      </div>
      {done.length > 0 && (
        <details className="card">
          <summary>Completed ({done.length})</summary>
          <ul className="list">
            {done.map((w) => (
              <li key={w.id} className="row">
                <span className="grow item">✓ {w.title}</span>
                <button type="button" className="btn small ghost" onClick={() => updateWatch(w.id, { done: false })}>
                  Restore
                </button>
                <button type="button" className="btn small danger" onClick={() => removeWatch(w.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FishCollection() {
  const { profile, activeCtx, toggleCaught } = useStore();
  const [show, setShow] = useState<'all' | 'missing' | 'caught'>('all');
  const list = ALL_FISH.filter((f) => f.legendary !== 'legendary-2');
  const caught = list.filter((f) => profile.collections.fishCaught[f.id]).length;
  const shown = list.filter((f) => (show === 'missing' ? !profile.collections.fishCaught[f.id] : show === 'caught' ? profile.collections.fishCaught[f.id] : true));
  return (
    <div className="stack">
      <div className="card stack-sm">
        <h3>
          Fish caught: {caught} / {list.length}
        </h3>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={list.length} aria-valuenow={caught} aria-label="Fish collection progress">
          <span style={{ width: `${(caught / list.length) * 100}%` }} />
        </div>
        <p className="tiny muted">Includes crab-pot catches, algae and jellies as in the in-game collection tab. Legendary II fish are tracked separately on their pages. “Caught” is separate from bundle submissions.</p>
        <div className="seg" role="group" aria-label="Show">
          {(['all', 'missing', 'caught'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={show === s} onClick={() => setShow(s)}>
              {s === 'all' ? 'All' : s === 'missing' ? 'Not caught' : 'Caught'}
            </button>
          ))}
        </div>
      </div>
      <div className="card">
        <ul className="list">
          {shown.map((f) => {
            const r = resolveFishAvailability(f, activeCtx);
            const on = !!profile.collections.fishCaught[f.id];
            return (
              <li key={f.id} className="row">
                <label className="check" style={{ paddingLeft: 4 }}>
                  <input type="checkbox" checked={on} onChange={() => toggleCaught(f.id)} aria-label={`${f.name} caught`} />
                </label>
                <Link className="item grow" to={`/fish/${f.id}`}>
                  <FishGlyph color={f.color} shape={glyphShape(f.id)} />
                  <span className="grow">
                    <span className="item-title">{f.name}</span> {!on && <FishBadge status={r.status} />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Bundles() {
  const { profile, activeCtx, update } = useStore();
  const toast = useToast();
  const mode = profile.progress.bundleMode ?? 'standard';
  const { list, note } = activeBundles(profile);
  const rooms = [...new Set(ALL_BUNDLES.map((b) => b.roomName))];
  const allForMode = mode === 'standard' ? ALL_BUNDLES.filter((b) => !b.remix) : ALL_BUNDLES;
  const toggleItem = (bundleId: string, idx: number) =>
    update((p) => {
      const cur = { ...(p.collections.bundleItems[bundleId] ?? {}) };
      if (cur[idx]) delete cur[idx];
      else cur[idx] = true;
      return { ...p, collections: { ...p.collections, bundleItems: { ...p.collections.bundleItems, [bundleId]: cur } } };
    });
  return (
    <div className="stack">
      <div className="card stack-sm">
        <h3>Community Center bundles</h3>
        <div className="seg" role="group" aria-label="Bundle mode">
          {(['standard', 'remixed'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => update((p) => ({ ...p, progress: { ...p.progress, bundleMode: m } }))}>
              {m === 'standard' ? 'Standard bundles' : 'Remixed bundles'}
            </button>
          ))}
        </div>
        {note && <p className="notice small">{note}</p>}
        <p className="tiny muted">Tick items as you submit them. Submitting is tracked separately from catching or owning an item.</p>
      </div>
      {rooms.map((room) => {
        const bs = allForMode.filter((b) => b.roomName === room);
        if (!bs.length) return null;
        return (
          <section key={room} className="section">
            <Sign as="h3">{room}</Sign>
            <div className="grid-2">
              {bs.map((b) => {
                const inMine = list.includes(b);
                const n = bundleSubmitted(profile, b);
                const complete = bundleComplete(profile, b);
                return (
                  <div key={b.id} id={b.id} className={`card stack-sm ${complete ? 'celebrate' : ''}`} style={{ opacity: inMine ? 1 : 0.6 }}>
                    <div className="row">
                      <h4 className="grow" style={{ margin: 0 }}>
                        {b.name} {b.remix && <Badge>Remix</Badge>}
                      </h4>
                      {complete && <Badge kind="now">✓ Complete</Badge>}
                    </div>
                    {mode === 'remixed' && (
                      <label className="check small">
                        <input
                          type="checkbox"
                          checked={!!profile.collections.bundleSelection[b.id]}
                          onChange={() =>
                            update((p) => {
                              const sel = { ...p.collections.bundleSelection };
                              if (sel[b.id]) delete sel[b.id];
                              else sel[b.id] = true;
                              return { ...p, collections: { ...p.collections, bundleSelection: sel } };
                            })
                          }
                        />
                        This bundle is in my Community Center
                      </label>
                    )}
                    {b.type === 'gold' ? (
                      <label className="check">
                        <input type="checkbox" checked={!!profile.collections.bundleItems[b.id]?.[0]} onChange={() => toggleItem(b.id, 0)} />
                        Paid {b.goldCost?.toLocaleString()}g
                      </label>
                    ) : (
                      <>
                        <div className="small muted">
                          {n}/{b.itemsRequired} submitted{b.items.length > b.itemsRequired ? ` (choose ${b.itemsRequired} of ${b.items.length})` : ''}
                        </div>
                        <ul className="list">
                          {b.items.map((item, i) => {
                            const fishRes = item.ref?.kind === 'fish' ? resolveFishAvailability(ALL_FISH.find((f) => f.id === item.ref!.id)!, activeCtx) : null;
                            const href = item.ref ? (item.ref.kind === 'fish' ? `/fish/${item.ref.id}` : item.ref.kind === 'crop' ? `/crops?crop=${item.ref.id}` : `/forage#${item.ref.id}`) : null;
                            return (
                              <li key={i} className="row">
                                <label className="check grow">
                                  <input
                                    type="checkbox"
                                    checked={!!profile.collections.bundleItems[b.id]?.[i]}
                                    onChange={() => {
                                      toggleItem(b.id, i);
                                      if (!profile.collections.bundleItems[b.id]?.[i] && n + 1 === b.itemsRequired) toast(`🎉 ${b.name} complete!`);
                                    }}
                                  />
                                  <span>
                                    {item.quantity > 1 ? `${item.quantity} × ` : ''}
                                    {item.name}
                                    {item.quality ? ` (${item.quality} quality)` : ''}
                                  </span>
                                </label>
                                {fishRes && <FishBadge status={fishRes.status} />}
                                {href && (
                                  <Link to={href} className="small" aria-label={`Details for ${item.name}`}>
                                    Details
                                  </Link>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                    {b.reward && <div className="tiny muted">Reward: {b.reward}</div>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Museum() {
  const { profile, update } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'all' | 'artifact' | 'mineral' | 'missing'>('all');
  const donated = profile.collections.museumDonated;
  const list = useMemo(
    () =>
      museum.filter((m) => (!q || norm(m.name).includes(norm(q))) && (kind === 'all' ? true : kind === 'missing' ? !donated[m.id] : m.kind === kind)),
    [q, kind, donated],
  );
  const count = museum.filter((m) => donated[m.id]).length;
  return (
    <div className="stack">
      <div className="card stack-sm">
        <h3>
          Museum donations: {count} / {museum.length}
        </h3>
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={museum.length} aria-valuenow={count} aria-label="Museum progress">
          <span style={{ width: `${(count / museum.length) * 100}%` }} />
        </div>
        <input className="input" type="search" placeholder="Search artifacts and minerals…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search museum items" />
        <div className="chips" role="group" aria-label="Filter">
          {(['all', 'artifact', 'mineral', 'missing'] as const).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'All' : k === 'artifact' ? 'Artifacts' : k === 'mineral' ? 'Minerals' : 'Not donated'}
            </button>
          ))}
        </div>
        <p className="tiny muted">Drop sources are possibilities, never guarantees. Donating is tracked separately from finding an item.</p>
      </div>
      <div className="card">
        <ul className="list">
          {list.map((m) => (
            <li key={m.id} id={m.id} className="row" style={{ alignItems: 'flex-start' }}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!donated[m.id]}
                  aria-label={`${m.name} donated`}
                  onChange={() =>
                    update((p) => {
                      const d = { ...p.collections.museumDonated };
                      if (d[m.id]) delete d[m.id];
                      else d[m.id] = true;
                      return { ...p, collections: { ...p.collections, museumDonated: d } };
                    })
                  }
                />
              </label>
              <div className="grow item" style={{ display: 'block' }}>
                <span className="item-title">{m.name}</span> <Badge>{m.kind === 'artifact' ? 'Artifact' : 'Mineral'}</Badge>
                <span className="item-sub" style={{ display: 'block' }}>
                  {m.sources.length ? m.sources.join(' · ') : m.description}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Notes() {
  const { profile, saveNote, deleteNote, activeCtx } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  return (
    <div className="stack">
      <form
        className="card stack-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          saveNote({ text: text.trim(), date: activeCtx.date });
          setText('');
        }}
      >
        <label className="field">
          New note for {formatDate(activeCtx.date)}
          <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Things to remember, quest details, plans…" />
        </label>
        <button className="btn primary" type="submit">
          Save note
        </button>
      </form>
      {profile.notes.length ? (
        profile.notes.map((n) => (
          <div key={n.id} className="card stack-sm">
            <div className="row">
              <strong className="grow">{formatDate(n.date)}</strong>
              <button
                type="button"
                className="btn small danger"
                onClick={() => {
                  deleteNote(n.id);
                  toast('Note deleted', { label: 'Undo', run: () => saveNote(n) });
                }}
              >
                Delete
              </button>
            </div>
            <textarea className="input" defaultValue={n.text} aria-label={`Note from ${formatDate(n.date)}`} onBlur={(e) => e.target.value !== n.text && saveNote({ ...n, text: e.target.value })} />
          </div>
        ))
      ) : (
        <Empty emoji="🗒️" title="No notes yet" />
      )}
    </div>
  );
}

export default function Journal({ section }: { section: Section }) {
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <SubNav
        items={[
          { to: '/journal', label: 'Watchlist & goals', current: section === 'watch' },
          { to: '/journal/collections', label: 'Fish caught', current: section === 'fish' },
          { to: '/journal/bundles', label: 'Bundles', current: section === 'bundles' },
          { to: '/journal/museum', label: 'Museum', current: section === 'museum' },
          { to: '/journal/recipes', label: 'Recipes', current: section === 'recipes' },
          { to: '/journal/notes', label: 'Notes', current: section === 'notes' },
        ]}
      />
      {section === 'watch' && (
        <>
          <Watchlist />
          <div className="card row-wrap">
            <span className="grow small muted">Reference tools:</span>
            <Link className="btn small" to="/crops">
              🌱 Crop planner
            </Link>
            <Link className="btn small" to="/shops">
              🏪 Shops
            </Link>
            <Link className="btn small" to="/forage">
              🍄 Foraging
            </Link>
            <Link className="btn small" to="/recipes">
              📺 Recipes & TV
            </Link>
            <Link className="btn small" to="/map">
              🗺️ Map
            </Link>
          </div>
        </>
      )}
      {section === 'fish' && <FishCollection />}
      {section === 'bundles' && <Bundles />}
      {section === 'museum' && <Museum />}
      {section === 'recipes' && <RecipesList />}
      {section === 'notes' && <Notes />}
    </div>
  );
}
