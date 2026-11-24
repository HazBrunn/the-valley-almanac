/**
 * App state: farm profiles (durable, IndexedDB) + transient preview overrides (not saved).
 * All game logic lives in src/engine; this file only stores inputs and applies actions.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addDays, sameDate, type GameDate } from '../engine/calendar';
import type { GameContext } from '../engine/context';
import { newProfile, type DayRecord, type Profile, type WatchItem, type NoteItem } from '../engine/profile';
import { fixedWeatherFor, type Weather } from '../engine/weather';
import type { GameMinutes } from '../engine/time';
import { festivals } from '../data';
import { loadAll, saveProfile, saveActive, deleteProfile, requestPersistence } from './db';

export interface Preview {
  date?: GameDate;
  weather?: Weather;
  time?: GameMinutes | null;
}

interface StoreValue {
  ready: boolean;
  persistent: boolean;
  profiles: Profile[];
  profile: Profile;
  /** the active played day with preview overrides applied */
  ctx: GameContext;
  /** the active played day, no preview */
  activeCtx: GameContext;
  preview: Preview;
  isPreview: boolean;
  setPreview: (p: Preview) => void;
  clearPreview: () => void;
  update: (fn: (p: Profile) => Profile) => void;
  setDay: (patch: Partial<DayRecord>) => void;
  nextDay: () => { auto?: string };
  prevDay: () => boolean;
  commitPreviewDate: (d: GameDate) => void;
  toggleCaught: (fishId: string) => void;
  toggleFavourite: (id: string) => void;
  addWatch: (item: Omit<WatchItem, 'id' | 'createdAt'>) => void;
  updateWatch: (id: string, patch: Partial<WatchItem>) => void;
  removeWatch: (id: string) => void;
  isWatched: (kind: WatchItem['kind'], ref: string) => WatchItem | undefined;
  saveNote: (note: Partial<NoteItem> & { text: string }) => void;
  deleteNote: (id: string) => void;
  createProfile: (name: string) => void;
  switchProfile: (id: string) => void;
  removeProfile: (id: string) => void;
  replaceProfiles: (ps: Profile[], mode: 'merge' | 'replace') => void;
  resetProfile: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function isFestivalDay(d: GameDate) {
  return festivals.some((f) => f.kind === 'main' && f.season === d.season && d.day >= f.startDay && d.day <= f.endDay);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [preview, setPreviewState] = useState<Preview>({});
  const dirty = useRef(new Set<string>());
  const latest = useRef<Profile[]>([]);
  latest.current = profiles;

  useEffect(() => {
    let cancelled = false;
    loadAll().then(({ profiles: ps, active, persistent: pers }) => {
      if (cancelled) return;
      let list = ps;
      if (!list.length) {
        const p = newProfile(uid());
        list = [p];
        void saveProfile(p);
      }
      setProfiles(list);
      setActiveId(active && list.some((p) => p.id === active) ? active : list[0]!.id);
      setPersistent(pers);
      setReady(true);
      void requestPersistence();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const flush = useCallback(() => {
    for (const id of dirty.current) {
      const p = latest.current.find((x) => x.id === id);
      if (p) void saveProfile(p);
    }
    dirty.current.clear();
  }, []);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const profile = useMemo(() => profiles.find((p) => p.id === activeId) ?? profiles[0] ?? newProfile('placeholder'), [profiles, activeId]);

  const update = useCallback(
    (fn: (p: Profile) => Profile) => {
      setProfiles((ps) => ps.map((p) => (p.id === profile.id ? { ...fn(p), updatedAt: Date.now() } : p)));
      dirty.current.add(profile.id);
    },
    [profile.id],
  );

  // Persist right after each committed change (IndexedDB writes are cheap and async).
  useEffect(() => {
    if (dirty.current.size) flush();
  }, [profiles, flush]);

  const setDay = useCallback(
    (patch: Partial<DayRecord>) =>
      update((p) => {
        const changedDate = patch.date && !sameDate(patch.date, p.day.date);
        return {
          ...p,
          history: changedDate ? [...p.history, p.day].slice(-30) : p.history,
          day: { ...p.day, ...patch },
          tomorrowWeather: changedDate ? 'unknown' : p.tomorrowWeather,
        };
      }),
    [update],
  );

  const nextDay = useCallback(() => {
    const next = addDays(profile.day.date, 1);
    const fixed = fixedWeatherFor(next, isFestivalDay(next));
    const weather: Weather = fixed?.weather ?? profile.tomorrowWeather;
    update((p) => ({
      ...p,
      history: [...p.history, p.day].slice(-30),
      day: { date: next, weather, islandWeather: 'unknown', time: p.day.time === null ? null : 360 },
      tomorrowWeather: 'unknown',
    }));
    setPreviewState({});
    return { auto: fixed ? fixed.reason : profile.tomorrowWeather !== 'unknown' ? "Weather set from the TV forecast you entered." : undefined };
  }, [profile.day.date, profile.tomorrowWeather, update]);

  const prevDay = useCallback(() => {
    if (!profile.history.length) {
      update((p) => ({ ...p, day: { ...p.day, date: addDays(p.day.date, -1), weather: 'unknown', time: p.day.time } }));
      return false;
    }
    update((p) => ({ ...p, day: p.history[p.history.length - 1]!, history: p.history.slice(0, -1) }));
    return true;
  }, [profile.history.length, update]);

  const commitPreviewDate = useCallback(
    (d: GameDate) => {
      const fixed = fixedWeatherFor(d, isFestivalDay(d));
      setDay({ date: d, weather: fixed?.weather ?? 'unknown', islandWeather: 'unknown' });
      setPreviewState({});
    },
    [setDay],
  );

  const activeCtx: GameContext = useMemo(
    () => ({ date: profile.day.date, weather: profile.day.weather, islandWeather: profile.day.islandWeather, time: profile.day.time, progress: profile.progress }),
    [profile.day, profile.progress],
  );
  const isPreview = preview.date !== undefined || preview.weather !== undefined || preview.time !== undefined;
  const ctx: GameContext = useMemo(() => {
    if (!isPreview) return activeCtx;
    const dateChanged = preview.date && !sameDate(preview.date, activeCtx.date);
    return {
      ...activeCtx,
      date: preview.date ?? activeCtx.date,
      weather: preview.weather ?? (dateChanged ? 'unknown' : activeCtx.weather),
      islandWeather: dateChanged ? 'unknown' : activeCtx.islandWeather,
      time: preview.time !== undefined ? preview.time : activeCtx.time,
    };
  }, [activeCtx, preview, isPreview]);

  const value: StoreValue = {
    ready,
    persistent,
    profiles,
    profile,
    ctx,
    activeCtx,
    preview,
    isPreview,
    setPreview: (p) => setPreviewState((cur) => ({ ...cur, ...p })),
    clearPreview: () => setPreviewState({}),
    update,
    setDay,
    nextDay,
    prevDay,
    commitPreviewDate,
    toggleCaught: (id) =>
      update((p) => {
        const fishCaught = { ...p.collections.fishCaught };
        if (fishCaught[id]) delete fishCaught[id];
        else fishCaught[id] = true;
        return { ...p, collections: { ...p.collections, fishCaught } };
      }),
    toggleFavourite: (id) =>
      update((p) => {
        const favourites = { ...p.favourites };
        if (favourites[id]) delete favourites[id];
        else favourites[id] = true;
        return { ...p, favourites };
      }),
    addWatch: (item) => update((p) => ({ ...p, watchlist: [...p.watchlist, { ...item, id: uid(), createdAt: p.day.date }] })),
    updateWatch: (id, patch) => update((p) => ({ ...p, watchlist: p.watchlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
    removeWatch: (id) => update((p) => ({ ...p, watchlist: p.watchlist.filter((w) => w.id !== id) })),
    isWatched: (kind, ref) => profile.watchlist.find((w) => w.kind === kind && w.ref === ref && !w.done),
    saveNote: (note) =>
      update((p) => {
        const id = note.id ?? uid();
        const existing = p.notes.find((n) => n.id === id);
        const n: NoteItem = { id, text: note.text, date: note.date ?? existing?.date ?? p.day.date, updatedAt: Date.now() };
        return { ...p, notes: existing ? p.notes.map((x) => (x.id === id ? n : x)) : [n, ...p.notes] };
      }),
    deleteNote: (id) => update((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== id) })),
    createProfile: (name) => {
      const p = newProfile(uid(), name || 'New Farm');
      setProfiles((ps) => [...ps, p]);
      setActiveId(p.id);
      void saveProfile(p);
      void saveActive(p.id);
      setPreviewState({});
    },
    switchProfile: (id) => {
      flush();
      setActiveId(id);
      void saveActive(id);
      setPreviewState({});
    },
    removeProfile: (id) => {
      setProfiles((ps) => {
        let rest = ps.filter((p) => p.id !== id);
        if (!rest.length) {
          const p = newProfile(uid());
          void saveProfile(p);
          rest = [p];
        }
        if (activeId === id) {
          setActiveId(rest[0]!.id);
          void saveActive(rest[0]!.id);
        }
        return rest;
      });
      void deleteProfile(id);
    },
    replaceProfiles: (incoming, mode) => {
      setProfiles((ps) => {
        let next: Profile[];
        if (mode === 'replace') {
          for (const p of ps) void deleteProfile(p.id);
          next = incoming;
        } else {
          const ids = new Set(ps.map((p) => p.id));
          next = [...ps, ...incoming.map((p) => (ids.has(p.id) ? { ...p, id: uid(), farmName: `${p.farmName} (imported)` } : p))];
        }
        for (const p of next) void saveProfile(p);
        const first = mode === 'replace' ? next[0]! : next[ps.length]!;
        setActiveId(first.id);
        void saveActive(first.id);
        return next;
      });
      setPreviewState({});
    },
    resetProfile: () =>
      update((p) => ({ ...newProfile(p.id, p.farmName), createdAt: p.createdAt, onboarded: true })),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

export function useGame() {
  return useStore().ctx;
}
