import { fishById } from '../data';

export function glyphShape(id: string): 'fish' | 'crab' | 'algae' | 'jelly' | 'legend' {
  const f = fishById.get(id);
  if (!f) return 'fish';
  if (f.method === 'crab-pot') return 'crab';
  if (/jelly/.test(id)) return 'jelly';
  if (/algae|seaweed/.test(id)) return 'algae';
  if (f.legendary) return 'legend';
  return 'fish';
}
