/** Original pixel-style SVG icons and decorations (no game art). */
import type { Season } from '../engine/calendar';

type P = { className?: string; title?: string };

const px = (cells: string[], palette: Record<string, string>) => {
  const rects: React.ReactElement[] = [];
  cells.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = palette[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }),
  );
  return rects;
};

export function TodayIcon({ className }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {px(
        [
          '................',
          '..W..........W..',
          '.WWWWWWWWWWWWWW.',
          '.WRRRRRRRRRRRRW.',
          '.WRRRRRRRRRRRRW.',
          '.WPPPPPPPPPPPPW.',
          '.WPPPPPPPPPPPPW.',
          '.WPPPPPGGPPPPPW.',
          '.WPPPPGGGGPPPPW.',
          '.WPPPPPGGPPPPPW.',
          '.WPPGPPPPPPPPPW.',
          '.WPPPGPPPPPPPPW.',
          '.WPPPPPPPPPPPPW.',
          '.WWWWWWWWWWWWWW.',
          '................',
          '................',
        ],
        { W: '#4a3b2d', R: '#c9573d', P: '#fbf1dc', G: '#6e9a4e' },
      )}
    </svg>
  );
}

export function PeopleIcon({ className }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {px(
        [
          '................',
          '.....HHHHHH.....',
          '....HHHHHHHH....',
          '....HSSSSSSH....',
          '....SSESSESS....',
          '....SSSSSSSS....',
          '.....SSMMSS.....',
          '......SSSS......',
          '....CCCCCCCC....',
          '...CCCCCCCCCC...',
          '...CCCCCCCCCC...',
          '...SCCCCCCCCS...',
          '...SCCCCCCCCS...',
          '....BBBBBBBB....',
          '....BB....BB....',
          '................',
        ],
        { H: '#7a4b2a', S: '#f0c9a0', E: '#33271c', M: '#b4465a', C: '#6e9a4e', B: '#4a3b2d' },
      )}
    </svg>
  );
}

export function FishNavIcon({ className }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {px(
        [
          '................',
          '................',
          '................',
          '.......DD.......',
          '.....DLLLLD...T.',
          '...DLLLLLLLLDTT.',
          '..DLELLLLLLLLTT.',
          '..DLLLLLLLLLLTT.',
          '..DWWLLLLLLLLTT.',
          '...DWWWWWWWLDTT.',
          '.....DWWWWD...T.',
          '.......DD.......',
          '................',
        ],
        { D: '#355f70', L: '#8dadba', E: '#33271c', W: '#dce8ee', T: '#5b8798' },
      )}
    </svg>
  );
}

export function CalendarIcon({ className }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {px(
        [
          '................',
          '..W..W..W..W....',
          '.WWWWWWWWWWWWWW.',
          '.WHHHHHHHHHHHHW.',
          '.WWWWWWWWWWWWWW.',
          '.WPPWPPWPPWPPPW.',
          '.WPPWPPWPPWPPPW.',
          '.WWWWWWWWWWWWWW.',
          '.WPPWRRWPPWPPPW.',
          '.WPPWRRWPPWPPPW.',
          '.WWWWWWWWWWWWWW.',
          '.WPPWPPWPPWPPPW.',
          '.WPPWPPWPPWPPPW.',
          '.WWWWWWWWWWWWWW.',
          '................',
          '................',
        ],
        { W: '#4a3b2d', H: '#be9060', P: '#fbf1dc', R: '#c9573d' },
      )}
    </svg>
  );
}

export function JournalIcon({ className }: P) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" shapeRendering="crispEdges">
      {px(
        [
          '................',
          '...BBBBBBBBBB...',
          '..BCCCCCCCCCCB..',
          '..BCCCCCCCCCCB..',
          '..BCCYYYYYYCCB..',
          '..BCCYPPPPYCCB..',
          '..BCCYYYYYYCCB..',
          '..BCCCCCCCCCCB..',
          '..BCCCCCCCCCCB..',
          '..BCCCCCCCCCCB..',
          '..BCCCCCCCCRCB..',
          '..BCCCCCCCCRCB..',
          '..BPPPPPPPPPPB..',
          '...BBBBBBBBBB...',
          '................',
          '................',
        ],
        { B: '#4a3b2d', C: '#8b5a3c', Y: '#e7c15a', P: '#fbf1dc', R: '#c9573d' },
      )}
    </svg>
  );
}

export function SearchIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </svg>
  );
}

export function MenuIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function MapIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function BackIcon({ className }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

/** Original pixel fish glyph tinted per species (not a game sprite). */
export function FishGlyph({ color, className, title, shape = 'fish' }: { color: string; className?: string; title?: string; shape?: 'fish' | 'crab' | 'algae' | 'jelly' | 'legend' }) {
  const base = color;
  const rows: Record<string, string[]> = {
    fish: [
      '................',
      '................',
      '......DDDD......',
      '....DBBBBBBD..DD',
      '..DBBBBBBBBBDDBD',
      '.DBEBBBBBBBBBBBD',
      '.DBBBBBBBBBBBBD.',
      '.DLLBBBBBBBBBBBD',
      '..DLLLLLLLLLDDBD',
      '....DLLLLLLD..DD',
      '......DDDD......',
      '................',
    ],
    legend: [
      '.......SS.......',
      '......DDDDS.....',
      '....DBBBBBBD..DD',
      '..DBBBBSBBBBDDBD',
      '.DBEBBBBBBSBBBBD',
      '.DBBBSBBBBBBBBD.',
      '.DLLBBBBBSBBBBBD',
      '..DLLLLLLLLLDDBD',
      '....DLLLLLLD..DD',
      '......DDDD......',
      '................',
      '................',
    ],
    crab: [
      '................',
      '..DD........DD..',
      '.DBBD......DBBD.',
      '.DBD........DBD.',
      '..DDDBBBBBBDDD..',
      '....DBEBBEBD....',
      '...DBBBBBBBBD...',
      '...DBBBBBBBBD...',
      '..D.DDDDDDDD.D..',
      '.D..D......D..D.',
      '................',
      '................',
    ],
    algae: [
      '................',
      '.....D....D.....',
      '....DBD..DBD....',
      '....DBD.DBD.....',
      '.....DBDBD..D...',
      '..D..DBBD..DBD..',
      '.DBD.DBD..DBD...',
      '..DBDDBD.DBD....',
      '...DBBBDDBD.....',
      '....DBBBBD......',
      '.....DDDD.......',
      '................',
    ],
    jelly: [
      '................',
      '.....DDDDDD.....',
      '...DLLBBBBBBD...',
      '..DLBBBBBBBBBD..',
      '..DBBBBBBBBBBD..',
      '..DDDDDDDDDDDD..',
      '...D.D.D..D.D...',
      '...D..D.D.D..D..',
      '....D.D..D..D...',
      '...D...D..D.....',
      '................',
      '................',
    ],
  };
  return (
    <svg viewBox="0 -2 16 16" className={className ?? 'fish-icon'} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title} shapeRendering="crispEdges">
      {px(rows[shape]!, { D: '#33271c', B: base, L: 'rgba(255,255,255,0.55)', E: '#fff', S: '#f2c84b' })}
    </svg>
  );
}

const PORTRAIT_COLORS = ['#6e9a4e', '#b8791f', '#b0582a', '#4f7d9f', '#8b5a8c', '#a24b5c', '#3f7f6e', '#7a6a3a', '#5a6fb0', '#9c6b3f'];
export function Portrait({ name, size, className }: { name: string; size?: 'lg'; className?: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = PORTRAIT_COLORS[h % PORTRAIT_COLORS.length]!;
  return (
    <span className={`portrait ${size ?? ''} ${className ?? ''}`} style={{ background: `linear-gradient(160deg, ${bg}, color-mix(in srgb, ${bg} 70%, black))` }} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/** Seasonal header decoration: blossoms, sunbeams, falling leaves or snowflakes. */
export function SeasonDeco({ season }: { season: Season }) {
  const items = Array.from({ length: 14 }, (_, i) => ({ x: (i * 73) % 100, y: (i * 37) % 80 + 5, s: 0.6 + ((i * 13) % 7) / 10 }));
  return (
    <svg className="header-deco" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {items.map((p, i) => {
        if (season === 'spring')
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s * 0.5} ${p.s})`} opacity="0.55">
              <circle r="2" fill="#f4b9c9" />
              <circle r="0.8" fill="#fff4c2" />
            </g>
          );
        if (season === 'summer')
          return <circle key={i} cx={p.x} cy={p.y} r={p.s * 0.9} fill="#fff3b0" opacity="0.45" />;
        if (season === 'fall')
          return <rect key={i} x={p.x} y={p.y} width={p.s * 1.2} height={p.s * 2.4} rx="0.6" fill={i % 2 ? '#b0582a' : '#d98c3e'} opacity="0.5" transform={`rotate(${i * 25} ${p.x} ${p.y})`} />;
        return <circle key={i} cx={p.x} cy={p.y} r={p.s * 0.7} fill="#ffffff" opacity="0.8" />;
      })}
    </svg>
  );
}
