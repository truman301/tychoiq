import { ImageResponse } from "next/og";

// Run on the edge runtime: avoids the Node build of @vercel/og (which throws
// "Invalid URL" via fileURLToPath during static prerender) and generates the
// card on demand instead of at build time.
export const runtime = "edge";

export const alt = "Tycho IQ — AI-trained, evidence-first prospect discovery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social card. Pure flexbox + inline styles (satori-compatible), no external
// fonts or assets, so it renders identically on any deploy target.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "radial-gradient(1100px 600px at 80% -10%, #2a2a6e 0%, #141433 45%, #0c0c22 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #5B4FE0 0%, #8B5CF6 100%)",
              boxShadow: "0 18px 50px -12px rgba(91,79,224,0.7)",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                border: "3px solid rgba(255,255,255,0.92)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 13, height: 13, borderRadius: 999, background: "white" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>
            <span>Tycho</span>
            <span style={{ color: "#b9acff" }}>&nbsp;IQ</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 940 }}>
            Find the accounts databases miss.
          </div>
          <div style={{ fontSize: 30, color: "#c9c9e6", maxWidth: 900, lineHeight: 1.3 }}>
            AI-trained, evidence-first prospect discovery. Train the model, scan a
            region, score fit and risk — every result backed by a source.
          </div>
        </div>

        <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#9a9ac8" }}>
          <span>Train-first</span>
          <span style={{ color: "#5B4FE0" }}>·</span>
          <span>Evidence-first</span>
          <span style={{ color: "#5B4FE0" }}>·</span>
          <span>Precision over volume</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
