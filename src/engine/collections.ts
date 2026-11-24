/** Collection & bundle progress helpers. "Caught", "submitted", "donated", "known" and "cooked" stay distinct. */
import { bundles } from '../data';
import type { Bundle } from '../data/types';
import type { Profile } from './profile';

/** Bundles that exist in this player's Community Center. */
export function activeBundles(profile: Profile): { list: Bundle[]; note?: string } {
  const mode = profile.progress.bundleMode ?? 'standard';
  if (mode === 'standard') return { list: bundles.filter((b) => !b.remix) };
  const chosen = bundles.filter((b) => profile.collections.bundleSelection[b.id]);
  if (!chosen.length) return { list: bundles, note: 'Remixed bundles: tick the bundles you actually have to hide the others.' };
  return { list: chosen };
}

export function bundleSubmitted(profile: Profile, b: Bundle): number {
  return Object.keys(profile.collections.bundleItems[b.id] ?? {}).length;
}

export function bundleComplete(profile: Profile, b: Bundle): boolean {
  return b.type === 'items' ? bundleSubmitted(profile, b) >= b.itemsRequired : !!profile.collections.bundleItems[b.id]?.[0];
}

/** For each referenced entity, the incomplete bundles that still want it. */
export function bundleNeeds(profile: Profile): Map<string, { bundle: Bundle; quantity: number; quality?: string }[]> {
  const out = new Map<string, { bundle: Bundle; quantity: number; quality?: string }[]>();
  for (const b of activeBundles(profile).list) {
    if (bundleComplete(profile, b)) continue;
    const done = profile.collections.bundleItems[b.id] ?? {};
    b.items.forEach((item, i) => {
      if (done[i] || !item.ref) return;
      const key = `${item.ref.kind}:${item.ref.id}`;
      out.set(key, [...(out.get(key) ?? []), { bundle: b, quantity: item.quantity, ...(item.quality ? { quality: item.quality } : {}) }]);
    });
  }
  return out;
}

export function bundlesUsing(kind: string, id: string): Bundle[] {
  return bundles.filter((b) => b.items.some((i) => i.ref?.kind === kind && i.ref.id === id));
}
