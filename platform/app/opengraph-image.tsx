import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Better Media — File upload stack. One config. Full pipeline.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const steps = ["Validate", "Scan", "Process", "Store"];

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#000000",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "80px 96px",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* Blue glow — top-left */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: -60,
          left: -60,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
        }}
      />
      {/* Purple glow — top-right */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: -40,
          right: -40,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Logo row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 56 }}>
        <svg width="48" height="48" viewBox="0 0 256 256" fill="none">
          <rect width="256" height="256" rx="56" fill="white" />
          <path
            d="M72 160C52.1177 160 36 143.882 36 124C36 104.118 52.1177 88 72 88C78.1504 88 83.9404 89.5456 89.0014 92.2704C98.5365 72.6624 118.64 59 142 59C174.585 59 201 85.4152 201 118C201 119.353 200.954 120.696 200.864 122.027C213.57 127.159 222 139.611 222 154C222 173.882 205.882 190 186 190H80"
            stroke="black"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M92 122H164" stroke="black" strokeWidth="16" strokeLinecap="round" />
          <path d="M82 150H154" stroke="black" strokeWidth="16" strokeLinecap="round" />
        </svg>
        <span style={{ color: "#ffffff", fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
          Better Media
        </span>
      </div>

      {/* Headline — two spans in a column to avoid <br/> */}
      <div style={{ display: "flex", flexDirection: "column", marginBottom: 40 }}>
        <span
          style={{
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
          }}
        >
          File upload stack.
        </span>
        <span
          style={{
            color: "#ffffff",
            fontSize: 64,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
          }}
        >
          One config. Full pipeline.
        </span>
      </div>

      {/* Pipeline steps — flat list avoids conditional child rendering */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {steps.flatMap((step, i) => {
          const pill = (
            <div
              key={step}
              style={{
                display: "flex",
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 8,
                padding: "8px 20px",
                color: "#93c5fd",
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {step}
            </div>
          );
          if (i < steps.length - 1) {
            return [
              pill,
              <span key={`arrow-${i}`} style={{ color: "#3b82f6", fontSize: 22 }}>
                →
              </span>,
            ];
          }
          return [pill];
        })}
      </div>

      {/* URL */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 56,
          right: 96,
          color: "#52525b",
          fontSize: 22,
          letterSpacing: "-0.01em",
        }}
      >
        better-media.dev
      </div>
    </div>,
    { ...size }
  );
}
