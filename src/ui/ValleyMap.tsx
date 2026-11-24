/**
 * An ORIGINAL schematic map of the Valley (not to scale, not game art). Regions are
 * hand-drawn shapes placed by relative geography; markers sit on region/building anchors.
 * Pan/zoom via buttons, drag and wheel; every marker is a focusable button with a label,
 * and pages always provide a list alternative.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { regions } from '../data';

export interface MapMarker {
  id: string;
  x: number;
  y: number;
  label: string;
  kind?: 'villager' | 'place' | 'fish' | 'shop' | 'event' | 'alt';
  emphasis?: boolean;
  icon?: string;
  onSelect?: () => void;
}

export interface MapLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
  dashed?: boolean;
}

const W = 1000;
const H = 700;

function Terrain() {
  return (
    <g aria-hidden="true">
      {/* sea */}
      <rect x="0" y="0" width={W} height={H} fill="#9cc7d3" />
      {/* main land */}
      <path d="M0 0 H1000 V560 C930 585 880 560 820 590 C760 610 700 580 620 585 C540 590 470 575 420 560 C360 545 300 600 240 640 C180 680 90 690 0 680 Z" fill="#b9d39a" />
      {/* beach sand */}
      <path d="M420 560 C470 575 540 590 620 585 C700 580 760 610 820 590 C880 560 930 585 1000 560 V620 C930 640 860 650 780 645 C700 640 620 650 540 640 C480 632 440 610 420 560 Z" fill="#ecd9a8" />
      {/* mountain */}
      <path d="M470 0 H1000 V230 C930 240 860 220 800 240 C730 260 650 250 590 230 C540 210 500 170 470 120 Z" fill="#a7b48e" />
      <path d="M760 40 l40 -40 l40 40 z M840 60 l50 -55 l50 55 z M700 50 l35 -40 l35 40 z" fill="#8c9476" />
      {/* lake */}
      <ellipse cx="705" cy="175" rx="70" ry="38" fill="#7fb3c7" stroke="#5d93a8" strokeWidth="3" />
      {/* railroad strip */}
      <rect x="430" y="35" width="250" height="20" fill="#c6b18d" />
      <path d="M430 45 H680" stroke="#6b5a45" strokeWidth="3" strokeDasharray="6 6" />
      {/* forest */}
      <path d="M0 360 C80 340 160 350 240 370 C320 390 400 420 420 470 C430 520 400 560 360 580 C300 610 250 640 200 660 C120 690 60 690 0 680 Z" fill="#86ad6f" />
      {[...Array(26)].map((_, i) => (
        <circle key={i} cx={20 + ((i * 53) % 360)} cy={390 + ((i * 37) % 250)} r="13" fill="#5f8b4e" opacity="0.75" />
      ))}
      {/* forest river */}
      <path d="M150 700 C200 640 260 610 330 600 C380 592 420 610 470 640" fill="none" stroke="#7fb3c7" strokeWidth="14" strokeLinecap="round" />
      {/* forest pond */}
      <ellipse cx="235" cy="455" rx="34" ry="22" fill="#7fb3c7" stroke="#5d93a8" strokeWidth="3" />
      {/* farm */}
      <rect x="60" y="150" width="230" height="190" rx="18" fill="#c9b98a" />
      {[...Array(6)].map((_, i) => (
        <path key={i} d={`M80 ${180 + i * 26} H270`} stroke="#a98f62" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
      ))}
      {/* town ground */}
      <rect x="420" y="240" width="400" height="260" rx="26" fill="#d9cfb4" />
      {/* town river */}
      <path d="M840 230 C800 300 780 380 790 470 C800 530 770 560 740 590" fill="none" stroke="#7fb3c7" strokeWidth="14" strokeLinecap="round" />
      {/* paths */}
      <path d="M290 245 H430 M560 230 V160 M300 340 V420 M560 500 V560 M820 300 H900 V150" stroke="#e8dcc0" strokeWidth="10" strokeLinecap="round" fill="none" />
      {/* piers */}
      <rect x="600" y="620" width="12" height="60" fill="#8b7158" />
      <rect x="750" y="630" width="12" height="60" fill="#8b7158" />
    </g>
  );
}

export function ValleyMap({
  markers = [],
  lines = [],
  highlightRegion,
  showRegionLabels = true,
  onRegionSelect,
  label,
  children,
}: {
  markers?: MapMarker[];
  lines?: MapLine[];
  highlightRegion?: string | null;
  showRegionLabels?: boolean;
  onRegionSelect?: (id: string) => void;
  label: string;
  children?: ReactNode;
}) {
  const [view, setView] = useState({ x: 0, y: 0, w: W, h: H });
  const drag = useRef<{ px: number; py: number; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoom = (factor: number) =>
    setView((v) => {
      const w = Math.min(W, Math.max(250, v.w * factor));
      const h = (w / W) * H;
      const cx = v.x + v.w / 2;
      const cy = v.y + v.h / 2;
      return clamp({ x: cx - w / 2, y: cy - h / 2, w, h });
    });
  const clamp = (v: typeof view) => ({ ...v, x: Math.min(Math.max(v.x, 0), W - v.w), y: Math.min(Math.max(v.y, 0), H - v.h) });
  // Size markers and labels in screen pixels so they stay legible on small phones.
  const [pxWidth, setPxWidth] = useState(800);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setPxWidth(entries[0]?.contentRect.width || 800));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const unitsPerPx = view.w / Math.max(200, pxWidth);
  const scale = unitsPerPx; // 1 screen px in map units

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="group"
        aria-label={`${label}. Schematic map, not to scale.`}
        onPointerDown={(e) => {
          if ((e.target as Element).closest('.map-marker, .map-region')) return;
          drag.current = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current || !svgRef.current) return;
          const rect = svgRef.current.getBoundingClientRect();
          const k = view.w / rect.width;
          setView((v) => clamp({ ...v, x: drag.current!.vx - (e.clientX - drag.current!.px) * k, y: drag.current!.vy - (e.clientY - drag.current!.py) * k }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          e.preventDefault();
          zoom(e.deltaY > 0 ? 1.15 : 0.87);
        }}
      >
        <Terrain />
        {regions
          .filter((r) => !r.offMap)
          .map((r) => (
            <g key={r.id} className="map-region">
              {highlightRegion === r.id && <circle cx={r.x} cy={r.y} r={Math.max(70, 40 * scale)} fill="none" stroke="#b4465a" strokeWidth={3 * scale} strokeDasharray="10 8" />}
              {showRegionLabels && (
                <text
                  x={r.x}
                  y={r.y - 30}
                  textAnchor="middle"
                  fontSize={12 * scale}
                  fontWeight={800}
                  fill="#33271c"
                  stroke="#fbf6ea"
                  strokeWidth={3 * scale}
                  paintOrder="stroke"
                  style={{ cursor: onRegionSelect ? 'pointer' : undefined }}
                  onClick={onRegionSelect ? () => onRegionSelect(r.id) : undefined}
                >
                  {r.name}
                </text>
              )}
            </g>
          ))}
        {/* off-map destinations */}
        {regions
          .filter((r) => r.offMap)
          .map((r) => (
            <g key={r.id} aria-hidden="true">
              <text x={r.x < 150 ? 6 : r.x > 850 ? W - 6 : r.x} y={r.y + 4 * scale} textAnchor={r.x < 150 ? 'start' : r.x > 850 ? 'end' : 'middle'} fontSize={11 * scale} fontWeight={800} fill="#33271c" stroke="#fbf6ea" strokeWidth={3 * scale} paintOrder="stroke">
                {r.x < 150 ? `← ${r.name}` : `${r.name} →`}
              </text>
            </g>
          ))}
        {lines.map((l, i) => (
          <line key={i} x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y} stroke="#b4465a" strokeWidth={3 * scale} strokeDasharray={l.dashed ? '10 8' : undefined} strokeLinecap="round" />
        ))}
        {markers.map((m) => {
          const r = (m.emphasis ? 14 : 10) * scale;
          const fill = m.kind === 'alt' ? '#8dadba' : m.kind === 'villager' ? '#b4465a' : m.kind === 'fish' ? '#355f70' : m.kind === 'shop' ? '#be9060' : m.kind === 'event' ? '#8b5a8c' : '#685441';
          return (
            <g
              key={m.id}
              className="map-marker"
              role="button"
              tabIndex={0}
              aria-label={m.label}
              onClick={m.onSelect}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && m.onSelect) {
                  e.preventDefault();
                  m.onSelect();
                }
              }}
            >
              <title>{m.label}</title>
              <circle cx={m.x} cy={m.y} r={r + 3 * scale} fill="#fbf6ea" opacity={0.9} />
              <circle cx={m.x} cy={m.y} r={r} fill={fill} stroke="#33271c" strokeWidth={1.5 * scale} strokeDasharray={m.kind === 'alt' ? '4 3' : undefined} />
              {m.icon && (
                <text x={m.x} y={m.y + r * 0.38} textAnchor="middle" fontSize={r * 1.05} aria-hidden="true">
                  {m.icon}
                </text>
              )}
            </g>
          );
        })}
        {children}
      </svg>
      <div className="map-controls">
        <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => zoom(0.75)}>
          +
        </button>
        <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => zoom(1.33)}>
          −
        </button>
        <button type="button" className="icon-btn" aria-label="Reset map view" onClick={() => setView({ x: 0, y: 0, w: W, h: H })}>
          ⤢
        </button>
      </div>
      <span className="map-tag">Schematic · not to scale</span>
    </div>
  );
}
