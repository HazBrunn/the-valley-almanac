/** Minimal, defensive helpers for reading MediaWiki wikitext snapshots. */

export interface Linked {
  text: string;
  links: string[];
}

/** Strip markup to plain text, remembering [[link]] targets. */
export function cleanWikitext(input: string): Linked {
  const links: string[] = [];
  let s = input;
  s = s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\[\[File:[^\]]*\]\]/gi, '');
  // {{NPC|Name|...}} / {{Name|X}} / {{Season|X}} → X
  s = s.replace(/\{\{(?:NPC|Name|Season|Weather inline|Price|Tprice)\|([^|}]+)[^}]*\}\}/gi, '$1');
  s = s.replace(/\{\{[^}]*\}\}/g, '');
  s = s.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, target: string, label: string) => {
    links.push(target.trim());
    return label;
  });
  s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, target: string) => {
    links.push(target.trim());
    return target.replace(/#.*/, '');
  });
  s = s.replace(/'''?/g, '');
  s = s.replace(/[’‘]/g, "'");
  s = s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return { text: s, links };
}

/** Extract a level-2 section (== Title ==) body. */
export function section(text: string, title: string): string | null {
  const re = new RegExp(`(^|\\n)==\\s*${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*==\\s*\\n([\\s\\S]*?)(?=\\n==[^=]|$)`);
  const m = re.exec(text);
  return m ? m[2]! : null;
}

/** Parse "|key = value" lines of the first {{Infobox ...}} template. */
export function infobox(text: string): Record<string, string> {
  const m = /\{\{Infobox[^\n]*\n([\s\S]*?)\n\}\}/.exec(text);
  const out: Record<string, string> = {};
  if (!m) return out;
  let cur: string | null = null;
  for (const line of m[1]!.split('\n')) {
    const kv = /^\|\s*(\w+)\s*=\s*(.*)$/.exec(line);
    if (kv) {
      cur = kv[1]!;
      out[cur] = kv[2]!;
    } else if (cur) out[cur] += `\n${line}`;
  }
  return out;
}
