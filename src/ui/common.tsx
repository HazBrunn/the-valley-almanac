import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store';
import type { WatchItem } from '../engine/profile';
import type { FishStatus } from '../engine/fish';
import { FISH_STATUS_LABEL } from '../engine/fish';

export function Sign({ children, icon, as: As = 'h2', id }: { children: ReactNode; icon?: ReactNode; as?: 'h1' | 'h2' | 'h3'; id?: string }) {
  return (
    <div className="section-head">
      <As className="sign" id={id}>
        {icon && <span aria-hidden="true">{icon}</span>}
        {children}
      </As>
    </div>
  );
}

const STATUS_ICON: Record<string, string> = {
  now: '●',
  later: '◔',
  today: '◑',
  earlier: '○',
  conditional: '?',
  unavailable: '—',
};

export function FishBadge({ status }: { status: FishStatus }) {
  return (
    <span className={`badge ${status}`}>
      <span aria-hidden="true">{STATUS_ICON[status]}</span>
      {FISH_STATUS_LABEL[status]}
    </span>
  );
}

export function Badge({ kind, children }: { kind?: string; children: ReactNode }) {
  return <span className={`badge ${kind ?? ''}`}>{children}</span>;
}

export function Empty({ emoji = '🌾', title, children }: { emoji?: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="big-emoji" aria-hidden="true">
        {emoji}
      </div>
      <p>
        <strong>{title}</strong>
      </p>
      {children}
    </div>
  );
}

export function WatchButton({ kind, refId, title, compact }: { kind: WatchItem['kind']; refId: string; title: string; compact?: boolean }) {
  const { isWatched, addWatch, removeWatch } = useStore();
  const toast = useToast();
  const w = isWatched(kind, refId);
  return (
    <button
      type="button"
      className={compact ? 'icon-btn' : 'btn small'}
      aria-pressed={!!w}
      aria-label={w ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
      title={w ? 'On your watchlist' : 'Add to watchlist'}
      onClick={() => {
        if (w) {
          removeWatch(w.id);
          toast(`${title} removed from your watchlist`);
        } else {
          addWatch({ kind, ref: refId, title });
          toast(`${title} added to your watchlist — it'll show on Today when relevant`);
        }
      }}
    >
      <span aria-hidden="true">{w ? '★' : '☆'}</span>
      {!compact && (w ? 'Watching' : 'Watch')}
    </button>
  );
}

export function FavButton({ id, name }: { id: string; name: string }) {
  const { profile, toggleFavourite } = useStore();
  const on = !!profile.favourites[id];
  return (
    <button type="button" className="icon-btn" aria-pressed={on} aria-label={on ? `Unfavourite ${name}` : `Favourite ${name}`} onClick={() => toggleFavourite(id)}>
      <span aria-hidden="true" style={{ color: on ? 'var(--rose)' : undefined, fontSize: '1.3rem' }}>
        {on ? '♥' : '♡'}
      </span>
    </button>
  );
}

export function CaughtToggle({ fishId, name }: { fishId: string; name: string }) {
  const { profile, toggleCaught } = useStore();
  const toast = useToast();
  const on = !!profile.collections.fishCaught[fishId];
  const [pop, setPop] = useState(false);
  return (
    <label className={`check ${pop ? 'celebrate' : ''}`}>
      <input
        type="checkbox"
        checked={on}
        onChange={() => {
          toggleCaught(fishId);
          if (!on) {
            setPop(true);
            window.setTimeout(() => setPop(false), 600);
            toast(`🎣 ${name} added to your catches`);
          }
        }}
      />
      <span>{on ? 'Caught' : 'Mark as caught'}</span>
    </label>
  );
}

// ---------------- dialog ----------------
export function Sheet({ open, onClose, title, children, labelId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; labelId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = labelId ?? `sheet-${title.replace(/\W+/g, '-').toLowerCase()}`;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={id}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <h2 id={id} className="grow">
              {title}
            </h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// ---------------- toasts ----------------
interface ToastItem {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}
const ToastCtx = createContext<(text: string, action?: ToastItem['action']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, action?: ToastItem['action']) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, text, action }]);
    window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), action ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="toast">
            <span className="grow">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.run();
                  setItems((xs) => xs.filter((x) => x.id !== t.id));
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function SourceLink({ href, label = 'Source' }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="small">
      {label} ↗
    </a>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SubNav({ items }: { items: { to: string; label: string; current: boolean }[] }) {
  return (
    <nav className="tabs" aria-label="Section">
      {items.map((i) => (
        <Link key={i.to} to={i.to} aria-current={i.current ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
