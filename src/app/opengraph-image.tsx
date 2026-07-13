import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0c10",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 10,
            background: "linear-gradient(90deg, transparent 0%, #ff6a1f 30%, #ff6a1f 70%, transparent 100%)",
            opacity: 0.7,
            display: "flex",
          }}
        />
        <svg width="120" height="120" viewBox="0 0 32 32" style={{ marginBottom: 28 }}>
          <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="8" fill="#1b1f27" stroke="#343a46" strokeWidth="1" />
          <circle cx="16" cy="16" r="8.5" fill="none" stroke="#ff6a1f" strokeWidth="1.75" />
          <path
            d="M16 7.5 V24.5 M7.5 16 H24.5 M9.9 9.9 Q16 16 9.9 22.1 M22.1 9.9 Q16 16 22.1 22.1"
            stroke="#ff6a1f"
            strokeWidth="1.1"
            fill="none"
            opacity="0.75"
          />
        </svg>
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 96, fontWeight: 700, letterSpacing: -2 }}>
          <span style={{ color: "#f4f5f7" }}>Chat</span>
          <span style={{ color: "#ff6a1f" }}>CBA</span>
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 32, color: "#9199a8", letterSpacing: 1 }}>
          Your AI Salary Cap Expert
        </div>
      </div>
    ),
    { ...size }
  );
}
