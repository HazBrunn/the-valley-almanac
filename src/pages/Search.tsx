import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../state/store';
import { search, ENTITY_LABEL } from '../engine/search';
import { Badge, Empty } from '../ui/common';

const SUGGESTIONS = ['Sebastian', 'Catfish', 'Eel', 'Traveling Cart', 'Salmonberry', 'Egg Festival', 'Strawberry', 'Spring Crops Bundle', 'Pierre'];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const { profile } = useStore();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const results = useMemo(() => search(q, { spoilers: profile.prefs.spoilers === 'show', limit: 40 }), [q, profile.prefs.spoilers]);
  return (
    <div className="stack" style={{ marginTop: 12 }}>
      <form role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          Search the whole almanac
          <input ref={input} className="input" type="search" value={q} placeholder="Villagers, fish, crops, bundles, shops…" onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} autoComplete="off" />
        </label>
      </form>
      {!q && (
        <div className="stack-sm">
          <p className="small muted">Try:</p>
          <div className="row-wrap">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => setParams({ q: s }, { replace: true })}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {q && (
        <div className="card" aria-live="polite">
          {results.length ? (
            <ul className="list">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <Link className="item" to={r.href}>
                    <span className="grow">
                      <span className="item-title">{r.title}</span> <Badge>{ENTITY_LABEL[r.type]}</Badge>
                      <span className="item-sub" style={{ display: 'block' }}>
                        {r.snippet}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty emoji="🔍" title={`Nothing found for “${q}”`}>
              <p className="small">Check the spelling, or try a shorter word.</p>
            </Empty>
          )}
        </div>
      )}
    </div>
  );
}
