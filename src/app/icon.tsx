import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#14171d",
          borderRadius: 7,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="9" fill="none" stroke="#ff6a1f" strokeWidth="2.4" />
          <path
            d="M16 6 V26 M6 16 H26 M9 9 Q16 16 9 23 M23 9 Q16 16 23 23"
            stroke="#ff6a1f"
            strokeWidth="1.4"
            fill="none"
            opacity="0.75"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
