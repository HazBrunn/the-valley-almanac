import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import { Sheet, Sign, SourceLink, useToast } from '../ui/common';
import { villagers, meta, fish, places } from '../data';
import { PROGRESS_FLAGS, FLAG_LABEL, FLAG_HELP, FARM_LABEL, resolveFlag, type FarmType, type ProgressFlag } from '../engine/progress';
import { makeBackup, parseBackup, ImportError, type Profile } from '../engine/profile';
import { formatDate } from '../engine/calendar';
import { SaveImport } from '../ui/SaveImport';

const DERIVED: ProgressFlag[] = ['railroadOpen', 'kentHome'];

function getTheme(): 'auto' | 'light' | 'dark' {
  try {
    const v = localStorage.getItem('valley-almanac:theme');
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

function applyTheme(t: 'auto' | 'light' | 'dark') {
  if (t === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try {
    if (t === 'auto') localStorage.removeItem('valley-almanac:theme');
    else localStorage.setItem('valley-almanac:theme', t);
  } catch {
    /* ignore */
  }
}

function About() {
  return (
    <section className="card stack-sm" aria-labelledby="about-h" id="about">
      <h2 id="about-h">About The Valley Almanac</h2>
      <p>A cosy companion for Stardew Valley: tell it your in-game day once and it answers where villagers are likely to be, which fish are biting, and what’s special today — offline, with no account and no tracking.</p>
      <p style={{ fontFamily: 'var(--font-head)', fontSize: '1.1rem' }}>Made with love for Esha. 🌸</p>
      <p className="small">
        <strong>Unofficial fan project.</strong> Not affiliated with or endorsed by ConcernedApe or Stardew Valley’s publishers. Stardew Valley is a trademark of ConcernedApe LLC. All artwork in this app (icons, portraits, map) is original; no game sprites or files are included.
      </p>
      <h3>Game data</h3>
      <p className="small">
        Ruleset: vanilla Stardew Valley {meta.gameVersion}. {meta.platforms} Mods are not supported. Data snapshot: {meta.generatedAt}.
      </p>
      <ul className="small">
        {meta.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer noopener">
              {s.label}
            </a>{' '}
            — {s.license}, retrieved {s.retrieved}
          </li>
        ))}
      </ul>
      <p className="small">
        Schedules, fish rules, festival times, shop hours and TV listings are derived from the Stardew Valley Wiki (CC BY-NC-SA 3.0); thanks to its many editors. Item, crop, bundle and gift data from <em>stardew-valley-data</em> (MIT). Fonts: Young Serif, Nunito and Pixelify Sans (SIL Open Font License).
      </p>
      <p className="small muted">
        Coverage: {villagers.length} villagers, {fish.length} fish & catchables, {places.length} map places. Where the game is random or depends on things the app can’t see (rerun recipes, Bookseller dates, rotating stock, random routines), it says so instead of guessing.
      </p>
    </section>
  );
}

export default function Settings({ aboutOnly }: { aboutOnly?: boolean }) {
  const { profile, profiles, update, createProfile, switchProfile, removeProfile, replaceProfiles, resetProfile, persistent, activeCtx } = useStore();
  const toast = useToast();
  const [theme, setTheme] = useState(getTheme());
  const [newName, setNewName] = useState('');
  const [importing, setImporting] = useState<Profile[] | null>(null);
  const [importError, setImportError] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: () => void; danger: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => applyTheme(theme), [theme]);

  if (aboutOnly) return <div style={{ marginTop: 12 }}><About /></div>;

  const setFlag = (f: ProgressFlag, v: boolean | undefined) =>
    update((p) => {
      const flags = { ...p.progress.flags };
      if (v === undefined) delete flags[f];
      else flags[f] = v;
      return { ...p, progress: { ...p.progress, flags } };
    });

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(makeBackup(profiles), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valley-almanac-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Backup saved to your downloads');
  };

  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <section className="card stack-sm" aria-labelledby="farm-h">
        <h2 id="farm-h">Your farm</h2>
        <label className="field">
          Farm name
          <input className="input" value={profile.farmName} maxLength={60} onChange={(e) => update((p) => ({ ...p, farmName: e.target.value }))} />
        </label>
        <label className="field">
          Farmer name (optional)
          <input className="input" value={profile.playerName} maxLength={60} onChange={(e) => update((p) => ({ ...p, playerName: e.target.value }))} />
        </label>
        <label className="field">
          Platform
          <select className="input" value={profile.platform} onChange={(e) => update((p) => ({ ...p, platform: e.target.value as Profile['platform'] }))}>
            <option value="unknown">Not specified</option>
            <option value="pc">PC / Mac / Linux</option>
            <option value="console">Console (Switch, PlayStation, Xbox)</option>
            <option value="mobile">Mobile</option>
          </select>
        </label>
        <p className="small muted">The Almanac uses the vanilla {meta.gameVersion} rules on every platform; consoles and mobile may lag behind PC patches.</p>
        <p className="small">Current day: {formatDate(activeCtx.date, { weekday: true })}</p>
      </section>

      <section className="card stack-sm" aria-labelledby="profiles-h">
        <h2 id="profiles-h">Farm profiles</h2>
        <p className="small muted">Each farm keeps its own day, progress, watchlist and notes.</p>
        <ul className="list">
          {profiles.map((p) => (
            <li key={p.id} className="row">
              <span className="grow item">
                <span>
                  <span className="item-title">{p.farmName}</span> {p.id === profile.id && <span className="badge now">Active</span>}
                  <span className="item-sub" style={{ display: 'block' }}>
                    {formatDate(p.day.date)}
                  </span>
                </span>
              </span>
              {p.id !== profile.id && (
                <button type="button" className="btn small" onClick={() => (switchProfile(p.id), toast(`Switched to ${p.farmName}`))}>
                  Switch
                </button>
              )}
              <button
                type="button"
                className="btn small danger"
                onClick={() =>
                  setConfirm({
                    title: `Delete ${p.farmName}?`,
                    body: 'This permanently removes this farm’s day, progress, watchlist and notes from this device. Export a backup first if you might want it back.',
                    danger: 'Delete farm',
                    action: () => (removeProfile(p.id), toast(`${p.farmName} deleted`)),
                  })
                }
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            createProfile(newName.trim().slice(0, 60));
            setNewName('');
            toast('New farm created');
          }}
        >
          <input className="input" placeholder="New farm name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="New farm name" />
          <button type="submit" className="btn">
            Add farm
          </button>
        </form>
      </section>

      <section className="card stack-sm" aria-labelledby="progress-h" id="progress">
        <h2 id="progress-h">World progress (all optional)</h2>
        <p className="small muted">Leave anything as “Not sure” — the Almanac will show both possibilities rather than guess.</p>
        <label className="field">
          Fishing level
          <select className="input" value={profile.progress.fishingLevel ?? ''} onChange={(e) => update((p) => ({ ...p, progress: { ...p.progress, fishingLevel: e.target.value === '' ? undefined : Number(e.target.value) } }))}>
            <option value="">Not sure</option>
            {Array.from({ length: 15 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Married to
          <select
            className="input"
            value={profile.progress.spouse === undefined ? '' : profile.progress.spouse === null ? 'none' : profile.progress.spouse}
            onChange={(e) => update((p) => ({ ...p, progress: { ...p.progress, spouse: e.target.value === '' ? undefined : e.target.value === 'none' ? null : e.target.value } }))}
          >
            <option value="">Not sure</option>
            <option value="none">Not married</option>
            {villagers
              .filter((v) => v.marriageable)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
        <label className="field">
          Farm map
          <select className="input" value={profile.progress.farmType ?? ''} onChange={(e) => update((p) => ({ ...p, progress: { ...p.progress, farmType: (e.target.value || undefined) as FarmType | undefined } }))}>
            <option value="">Not sure</option>
            {Object.entries(FARM_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="stack-sm">
          {PROGRESS_FLAGS.map((f) => {
            const derived = DERIVED.includes(f);
            const v = derived ? resolveFlag(f, profile.progress, activeCtx.date) : profile.progress.flags[f];
            return (
              <div key={f} className="stack-sm" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span style={{ fontWeight: 700 }}>{FLAG_LABEL[f]}</span>
                {FLAG_HELP[f] && <span className="tiny muted">{FLAG_HELP[f]}</span>}
                {derived ? (
                  <span className="small">{v ? 'Yes' : 'Not yet'} (from your date)</span>
                ) : (
                  <div className="seg" role="group" aria-label={FLAG_LABEL[f]}>
                    {(
                      [
                        [true, 'Yes'],
                        [false, 'No'],
                        [undefined, 'Not sure'],
                      ] as [boolean | undefined, string][]
                    ).map(([val, l]) => (
                      <button key={l} type="button" aria-pressed={v === val} onClick={() => setFlag(f, val)}>
                        {l}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack-sm" aria-labelledby="prefs-h" id="prefs">
        <h2 id="prefs-h">Preferences</h2>
        <label className="check">
          <input type="checkbox" checked={profile.prefs.spoilers === 'show'} onChange={(e) => update((p) => ({ ...p, prefs: { ...p.prefs, spoilers: e.target.checked ? 'show' : 'hide' } }))} />
          Show spoilers (heart events, late-game characters and fish)
        </label>
        <label className="check">
          <input type="checkbox" checked={profile.prefs.collectionFocus} onChange={(e) => update((p) => ({ ...p, prefs: { ...p.prefs, collectionFocus: e.target.checked } }))} />
          Collection focus: suggest fish I haven’t caught on Today
        </label>
        <div className="seg" role="group" aria-label="Colour theme">
          {(['auto', 'light', 'dark'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              {t === 'auto' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>

      <SaveImport />

      <section className="card stack-sm" aria-labelledby="backup-h" id="backup">
        <h2 id="backup-h">Backup & restore</h2>
        <p className="small">
          Everything is stored only on this device{persistent ? '' : ' (in limited fallback storage — private browsing may forget it)'}. Browsers can clear site data, especially on iPhone/iPad if the app isn’t used for a while, so export a backup now and then.
        </p>
        <div className="row-wrap">
          <button type="button" className="btn primary" onClick={exportBackup}>
            Export backup
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            Import backup…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              setImportError('');
              try {
                if (file.size > 2_000_000) throw new ImportError('That file is too large to be a Valley Almanac backup.');
                setImporting(parseBackup(await file.text()));
              } catch (err) {
                setImportError(err instanceof ImportError ? err.message : 'Could not read that file.');
              }
            }}
          />
        </div>
        {importError && (
          <p className="notice warn" role="alert">
            {importError}
          </p>
        )}
        <button
          type="button"
          className="btn danger"
          onClick={() =>
            setConfirm({
              title: `Reset ${profile.farmName}?`,
              body: 'This clears the day, progress, watchlist, collections and notes for this farm. It cannot be undone unless you have a backup.',
              danger: 'Reset farm',
              action: () => (resetProfile(), toast('Farm reset')),
            })
          }
        >
          Reset this farm…
        </button>
      </section>

      <Sheet open={!!importing} onClose={() => setImporting(null)} title="Import backup">
        {importing && (
          <>
            <p>This backup contains {importing.length} farm{importing.length === 1 ? '' : 's'}:</p>
            <ul className="small">
              {importing.map((p) => (
                <li key={p.id}>
                  <strong>{p.farmName}</strong> — {formatDate(p.day.date)}, {Object.keys(p.collections.fishCaught).length} fish caught, {p.watchlist.length} watchlist items
                </li>
              ))}
            </ul>
            <div className="row-wrap">
              <button type="button" className="btn primary" onClick={() => (replaceProfiles(importing, 'merge'), setImporting(null), toast('Backup added alongside your farms'))}>
                Add as extra farms
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => (replaceProfiles(importing, 'replace'), setImporting(null), toast('Your farms were replaced with the backup'))}
              >
                Replace all my farms
              </button>
              <button type="button" className="btn ghost" onClick={() => setImporting(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Sheet>
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title ?? 'Confirm'}>
        {confirm && (
          <>
            <p>{confirm.body}</p>
            <div className="row-wrap">
              <button type="button" className="btn danger" onClick={() => (confirm.action(), setConfirm(null))}>
                {confirm.danger}
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Sheet>

      <About />
      <Sign as="h3">Install & offline</Sign>
      <p className="small">
        Add the Almanac to your home screen (Share → “Add to Home Screen” on iPhone/iPad, or the install button in Chrome/Edge). After the first visit it works fully offline. <Link to="/welcome">Show the welcome tour again</Link>
      </p>
      <SourceLink href="https://www.stardewvalley.net/" label="Official Stardew Valley site" />
    </div>
  );
}
