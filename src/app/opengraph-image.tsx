import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Mining Showdown — ASE2 Scalability Lab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px",
        position: "relative",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "#10b981",
        }}
      />

      {/* Tagline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            background: "#10b981",
            borderRadius: "50%",
          }}
        />
        <span
          style={{
            color: "#10b981",
            fontFamily: "monospace",
            fontSize: "16px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          ASE2 — Scalability Multiplayer
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: "88px",
          fontWeight: 700,
          color: "white",
          textAlign: "center",
          lineHeight: 1.05,
          marginBottom: "32px",
          letterSpacing: "-2px",
        }}
      >
        Mining <span style={{ color: "#10b981" }}>Showdown</span>
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "26px",
          color: "#71717a",
          textAlign: "center",
          maxWidth: "760px",
          lineHeight: 1.4,
        }}
      >
        Who builds the most efficient mining infrastructure under load?
      </div>

      {/* Bottom tags */}
      <div
        style={{
          position: "absolute",
          bottom: "48px",
          display: "flex",
          gap: "32px",
          fontSize: "15px",
          color: "#3f3f46",
          fontFamily: "monospace",
          letterSpacing: "0.05em",
        }}
      >
        <span style={{ color: "#52525b" }}>Vertical Scaling</span>
        <span>·</span>
        <span style={{ color: "#52525b" }}>Horizontal Scaling</span>
        <span>·</span>
        <span style={{ color: "#52525b" }}>DB Sharding</span>
      </div>
    </div>,
    { ...size },
  );
}
