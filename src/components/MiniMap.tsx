"use client";

import { cn } from "@/lib/utils";

// Dependency-free SVG market map. Plots candidates over a *fixed* continental-US
// frame (not the points' bounding box) so geography stays stable and recognizable
// across filters, with faint state context, deterministic de-overlap for facilities
// that share a city, and hover labels. For a full tiled basemap, swap in
// Leaflet/OpenStreetMap (see README) — this keeps the app fully offline.

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
  tier?: string | null;
  score?: number;
};

const TIER_COLOR: Record<string, string> = {
  high: "#0E9F6E",
  medium: "#5B4FE0",
  low: "#94A3B8",
  avoid: "#E11D48",
};

// Fixed continental-US viewport (aspect-corrected at mid-latitude).
const BOUNDS = { minLng: -125, maxLng: -66.5, minLat: 24, maxLat: 49.5 };
const W = 900;
const H = 490;

// Approximate state centroids for faint geographic context labels.
const STATE_CENTROIDS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AZ: [34.3, -111.7], AR: [34.8, -92.4], CA: [37.2, -119.5],
  CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5], FL: [28.6, -82.4],
  GA: [32.6, -83.4], IA: [42.0, -93.5], ID: [44.4, -114.6], IL: [40.0, -89.2],
  IN: [39.9, -86.3], KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.0, -92.0],
  MA: [42.3, -71.8], MD: [39.0, -76.8], ME: [45.4, -69.2], MI: [44.3, -85.4],
  MN: [46.3, -94.3], MO: [38.4, -92.5], MS: [32.7, -89.7], MT: [47.0, -109.6],
  NC: [35.5, -79.4], ND: [47.5, -100.3], NE: [41.5, -99.8], NH: [43.7, -71.6],
  NJ: [40.2, -74.7], NM: [34.4, -106.1], NV: [39.3, -116.6], NY: [42.9, -75.5],
  OH: [40.3, -82.8], OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8],
  RI: [41.7, -71.5], SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4],
  TX: [31.5, -99.3], UT: [39.3, -111.7], VA: [37.5, -78.9], VT: [44.1, -72.7],
  WA: [47.4, -120.5], WI: [44.6, -89.9], WV: [38.6, -80.6], WY: [43.0, -107.5],
};

function projX(lng: number) {
  return ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
}
function projY(lat: number) {
  return H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
}
const clampX = (x: number) => Math.max(14, Math.min(W - 14, x));
const clampY = (y: number) => Math.max(14, Math.min(H - 14, y));

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~2.39996 rad

export function MiniMap({
  points,
  className,
  onSelect,
}: {
  points: MapPoint[];
  className?: string;
  onSelect?: (i: number) => void;
}) {
  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground",
          className,
        )}
      >
        No mappable locations yet
      </div>
    );
  }

  // Group points that land on (almost) the same coordinate so stacked facilities
  // fan out into a readable phyllotaxis cluster instead of an opaque blob.
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${p.lat.toFixed(1)},${p.lng.toFixed(1)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(i);
  });

  const placed = points.map((p) => ({ ...p, cx: clampX(projX(p.lng)), cy: clampY(projY(p.lat)) }));
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const baseX = placed[idxs[0]].cx;
    const baseY = placed[idxs[0]].cy;
    idxs.forEach((idx, k) => {
      const r = k === 0 ? 0 : 6 + 3.1 * Math.sqrt(k);
      const a = k * GOLDEN;
      placed[idx].cx = clampX(baseX + r * Math.cos(a));
      placed[idx].cy = clampY(baseY + r * Math.sin(a));
    });
  }

  // Label only the strongest few points to avoid clutter (hover shows the rest).
  const labelSet = new Set(
    points
      .map((p, i) => ({ i, s: p.score ?? 0 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.i),
  );

  const statesInView = Object.entries(STATE_CENTROIDS);

  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Market map of candidates by location">
        <defs>
          <linearGradient id="tycho-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f7f8fd" />
            <stop offset="1" stopColor="#eef1f9" />
          </linearGradient>
          <pattern id="tycho-grid" width="45" height="45" patternUnits="userSpaceOnUse">
            <path d="M 45 0 L 0 0 0 45" fill="none" stroke="#e2e6f1" strokeWidth="1" />
          </pattern>
          <filter id="tycho-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#1e2147" floodOpacity="0.28" />
          </filter>
        </defs>

        <rect width={W} height={H} fill="url(#tycho-sky)" />
        <rect width={W} height={H} fill="url(#tycho-grid)" />

        {/* faint state context labels */}
        {statesInView.map(([abbr, [lat, lng]]) => {
          const x = projX(lng);
          const y = projY(lat);
          if (x < 8 || x > W - 8 || y < 8 || y > H - 8) return null;
          return (
            <text
              key={abbr}
              x={x}
              y={y}
              fontSize="13"
              fontWeight="600"
              fill="#c4cad9"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ userSelect: "none" }}
            >
              {abbr}
            </text>
          );
        })}

        <style>{`
          .tycho-pt { transition: opacity .12s ease; }
          .tycho-pt > circle { transition: r .12s ease, stroke-width .12s ease; }
          .tycho-pt:hover > circle { stroke-width: 3; }
          .tycho-pt:hover > .tycho-hoverlabel { opacity: 1; }
          .tycho-clickable { cursor: pointer; }
        `}</style>

        {/* candidate markers */}
        {placed.map((p, i) => {
          const color = TIER_COLOR[p.tier ?? "low"] ?? TIER_COLOR.medium;
          const r = p.score != null ? 4.5 + (p.score / 100) * 6.5 : 6;
          const showLabel = labelSet.has(i) && p.label;
          return (
            <g
              key={i}
              className={cn("tycho-pt", onSelect && "tycho-clickable")}
              onClick={() => onSelect?.(i)}
            >
              <title>{p.label ? `${p.label}${p.score != null ? ` · ${p.score}` : ""}` : ""}</title>
              <circle
                cx={p.cx}
                cy={p.cy}
                r={r}
                fill={color}
                fillOpacity={0.82}
                stroke="#ffffff"
                strokeWidth={1.5}
                filter="url(#tycho-shadow)"
              />
              {showLabel ? (
                <text
                  x={p.cx + r + 4}
                  y={p.cy + 3.5}
                  fontSize="11.5"
                  fontWeight="500"
                  fill="#2b2f45"
                  stroke="#ffffff"
                  strokeWidth="3"
                  paintOrder="stroke"
                  style={{ pointerEvents: "none" }}
                >
                  {p.label}
                </text>
              ) : null}
              {/* hover label for unlabeled points */}
              {!showLabel && p.label ? (
                <text
                  className="tycho-hoverlabel"
                  x={p.cx + r + 4}
                  y={p.cy + 3.5}
                  fontSize="11.5"
                  fontWeight="500"
                  fill="#2b2f45"
                  stroke="#ffffff"
                  strokeWidth="3"
                  paintOrder="stroke"
                  opacity={0}
                  style={{ pointerEvents: "none" }}
                >
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
