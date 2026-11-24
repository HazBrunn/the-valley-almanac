import { useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Sheet, useToast } from './common';
import { parseSaveXml, MAX_SAVE_BYTES, type SaveSummary } from '../engine/saveImport';
import { formatDate } from '../engine/calendar';
import { WEATHER_LABEL } from '../engine/weather';
import { FARM_LABEL, FLAG_LABEL, type ProgressFlag } from '../engine/progress';
import { villagerById } from '../data';

type Part = 'day' | 'progress' | 'hearts' | 'fish' | 'recipes' | 'museum';

export function SaveImport() {
  const { update, profile } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [parts, setParts] = useState<Record<Part, boolean>>({ day: true, progress: true, hearts: true, fish: true, recipes: true, museum: true });

  const apply = () => {
    if (!summary) return;
    update((p) => {
      const n = { ...p, collections: { ...p.collections }, progress: { ...p.progress, flags: { ...p.progress.flags } } };
      if (parts.day && summary.date) {
        n.history = [...p.history, p.day].slice(-30);
        n.day = { date: summary.date, weather: summary.weather, islandWeather: 'unknown', time: p.day.time === null ? null : 360 };
        if (summary.farmName) n.farmName = summary.farmName;
        if (summary.playerName) n.playerName = summary.playerName;
        n.platform = 'pc';
      }
      if (parts.progress) {
        Object.assign(n.progress.flags, summary.flags);
        if (summary.fishingLevel !== null) n.progress.fishingLevel = summary.fishingLevel;
        if (summary.spouse !== undefined) n.progress.spouse = summary.spouse;
        if (summary.farmType) n.progress.farmType = summary.farmType;
      }
      if (parts.hearts) n.progress.hearts = { ...p.progress.hearts, ...summary.hearts };
      if (parts.fish) n.collections.fishCaught = { ...p.collections.fishCaught, ...Object.fromEntries(summary.fishCaught.map((id) => [id, true as const])) };
      if (parts.recipes) {
        n.collections.recipesKnown = { ...p.collections.recipesKnown, ...Object.fromEntries(summary.recipesKnown.map((id) => [id, true as const])) };
        n.collections.recipesCooked = { ...p.collections.recipesCooked, ...Object.fromEntries(summary.recipesCooked.map((id) => [id, true as const])) };
      }
      if (parts.museum) n.collections.museumDonated = { ...p.collections.museumDonated, ...Object.fromEntries(summary.museumDonated.map((id) => [id, true as const])) };
      return n;
    });
    setSummary(null);
    toast('Save data merged into this farm');
  };

  const PARTS: [Part, string][] = summary
    ? [
        ['day', `Date & weather: ${summary.date ? formatDate(summary.date) : 'not found'} · ${WEATHER_LABEL[summary.weather]}`],
        ['progress', `Progress: fishing level ${summary.fishingLevel ?? '?'}, farm ${summary.farmType ? FARM_LABEL[summary.farmType] : '?'}, ${summary.spouse ? `married to ${villagerById.get(summary.spouse)?.name}` : summary.spouse === null ? 'not married' : 'marriage unknown'}, ${Object.keys(summary.flags).length} world flags`],
        ['hearts', `Friendship with ${Object.keys(summary.hearts).length} villagers`],
        ['fish', `${summary.fishCaught.length} fish caught${summary.unknownFish ? ` (+${summary.unknownFish} not in the Almanac)` : ''}`],
        ['recipes', `${summary.recipesKnown.length} recipes known, ${summary.recipesCooked.length} cooked`],
        ['museum', `${summary.museumDonated.length} museum donations`],
      ]
    : [];

  return (
    <section className="card stack-sm" aria-labelledby="save-h" id="save-import">
      <h2 id="save-h">Import from a save file (optional, PC/Mac/Linux)</h2>
      <p className="small">
        Read your date, friendships, fish caught, recipes and museum donations straight from a Stardew Valley save. The file is read on this device only — nothing is uploaded. Saves live in:
      </p>
      <ul className="tiny">
        <li>
          Windows: <span className="kbd">%AppData%\StardewValley\Saves\YourFarm_123…</span>
        </li>
        <li>
          macOS / Linux: <span className="kbd">~/.config/StardewValley/Saves/YourFarm_123…</span>
        </li>
      </ul>
      <p className="tiny muted">Pick the file named exactly like its folder (not “SaveGameInfo”). Console saves can’t be accessed, and mobile saves are hard to reach — manual entry always works. Bundles aren’t read from saves yet; tick them in the Journal.</p>
      <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Reading…' : 'Choose save file…'}
      </button>
      <input
        ref={fileRef}
        type="file"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setError('');
          if (file.size > MAX_SAVE_BYTES) {
            setError('That file is too large to be a Stardew Valley save.');
            return;
          }
          setBusy(true);
          try {
            setSummary(parseSaveXml(await file.text()));
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not read that file.');
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && (
        <p className="notice warn" role="alert">
          {error}
        </p>
      )}
      <Sheet open={!!summary} onClose={() => setSummary(null)} title="Import from save">
        {summary && (
          <>
            <p className="small">
              Found <strong>{summary.farmName ?? 'a farm'}</strong>
              {summary.playerName ? ` (${summary.playerName})` : ''}, game version {summary.gameVersion ?? 'unknown'}. Choose what to merge into <strong>{profile.farmName}</strong>:
            </p>
            {summary.gameVersion && !summary.gameVersion.startsWith('1.6') && <p className="notice small">This save is from version {summary.gameVersion}; the Almanac follows 1.6 rules.</p>}
            {PARTS.map(([k, l]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={parts[k]} onChange={(e) => setParts((p) => ({ ...p, [k]: e.target.checked }))} />
                <span className="small">{l}</span>
              </label>
            ))}
            {Object.keys(summary.flags).length > 0 && (
              <details className="small">
                <summary>World flags found</summary>
                <ul>
                  {Object.entries(summary.flags).map(([f, v]) => (
                    <li key={f}>
                      {FLAG_LABEL[f as ProgressFlag]}: {v ? 'yes' : 'no'}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {summary.warnings.map((w) => (
              <p key={w} className="tiny muted">
                {w}
              </p>
            ))}
            <p className="tiny muted">Merging only adds or updates; it never removes things you ticked by hand. Your previous day is kept for undo.</p>
            <div className="row-wrap">
              <button type="button" className="btn primary" onClick={apply}>
                Merge selected
              </button>
              <button type="button" className="btn ghost" onClick={() => setSummary(null)}>
                Cancel
              </button>
            </div>
          </>
        )}
      </Sheet>
    </section>
  );
}
