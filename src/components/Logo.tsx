import * as React from "react";

/**
 * Tycho IQ brand mark — a precision astronomical instrument:
 * an orbital ring + tilted ecliptic, a solid core, a gold "catalogued"
 * star, and N/E/S/W sight ticks (the precision/observation motif).
 *
 * Colors are intentionally hard-coded (white + gold) so the mark reads
 * correctly when placed on the indigo brand tile, regardless of the
 * surrounding text color.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <ellipse
        cx="16"
        cy="16"
        rx="13"
        ry="5.3"
        stroke="white"
        strokeOpacity="0.45"
        strokeWidth="1.3"
        transform="rotate(-27 16 16)"
      />
      <circle cx="16" cy="16" r="9.6" stroke="white" strokeOpacity="0.9" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="3.7" fill="white" />
      <circle cx="25.7" cy="9.9" r="1.85" fill="#FBBF24" />
      <path
        d="M16 1.7v3.1M16 27.2v3.1M1.7 16h3.1M27.2 16h3.1"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Brand tile — the mark on the indigo gradient square. Used in the
 * sidebar, auth screens, and anywhere the logo stands alone.
 */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      className={
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[hsl(266_72%_56%)] shadow-glow " +
        (className ?? "h-9 w-9")
      }
    >
      <LogoMark className="h-[70%] w-[70%]" />
    </span>
  );
}

/**
 * Full lockup: tile + "Tycho IQ" wordmark. `tone` switches text color for
 * dark (sidebar) vs light backgrounds.
 */
export function Logo({
  tone = "dark",
  subtitle = "Prospect intelligence",
  tileClassName,
}: {
  tone?: "dark" | "light";
  subtitle?: string | null;
  tileClassName?: string;
}) {
  const title = tone === "dark" ? "text-white" : "text-foreground";
  const sub = tone === "dark" ? "text-sidebar-muted" : "text-muted-foreground";
  return (
    <span className="flex items-center gap-2.5">
      <LogoTile className={tileClassName ?? "h-9 w-9"} />
      <span className="leading-tight">
        <span className={"block font-display text-[15px] font-semibold tracking-tight " + title}>
          Tycho<span className="text-[hsl(250_85%_76%)]"> IQ</span>
        </span>
        {subtitle ? <span className={"block text-[11px] " + sub}>{subtitle}</span> : null}
      </span>
    </span>
  );
}
