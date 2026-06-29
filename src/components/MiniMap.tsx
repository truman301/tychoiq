"use client";

import { cn } from "@/lib/utils";

// Dependency-free SVG scatter "map" (equirectangular projection over the points'
// bounding box). Keeps the app fully offline. For production, swap in
// Leaflet/OpenStreetMap or Mapbox tiles (see README).

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
  tier?: string | null;
  score?: number;
};

const TIER_COLOR: Record<string, string> = {
  high: "#16a34a",
  medium: "#2563eb",
  low: "#94a3b8",
  avoid: "#dc2626",
};

export function MiniMap({ points, className, onSelect }: { points: MapPoint[]; className?: string; onSelect?: (i: number) => void }) {
  if (points.length === 0) {
    return <div className={cn("flex items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground", className)}>No mappable locations</div>;
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const pad = 0.4;
  const minLat = Math.min(...lats) - pad;
  const maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad;
  const maxLng = Math.max(...lngs) + pad;
  const W = 800;
  const H = 400;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng || 1)) * W;
  const y = (lat: number) => H - ((lat - minLat) / (maxLat - minLat || 1)) * H;

  return (
    <div className={cn("overflow-hidden rounded-md border bg-[#eef2f7]", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#dbe2ea" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        {points.map((p, i) => {
          const color = TIER_COLOR[p.tier ?? "low"] ?? "#2563eb";
          const r = p.score != null ? 5 + (p.score / 100) * 8 : 6;
          return (
            <g key={i} onClick={() => onSelect?.(i)} className={onSelect ? "cursor-pointer" : ""}>
              <circle cx={x(p.lng)} cy={y(p.lat)} r={r} fill={color} fillOpacity={0.55} stroke={color} strokeWidth={1.5} />
              {p.label ? (
                <text x={x(p.lng) + r + 3} y={y(p.lat) + 3} fontSize="11" fill="#334155">
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
