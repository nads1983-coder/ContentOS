import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #050509 0%, #281a48 56%, #6b4f17 100%)",
          border: "6px solid #c99a22",
          borderRadius: 38,
          color: "#e0bb58",
          display: "flex",
          fontSize: 58,
          fontWeight: 900,
          height: "100%",
          justifyContent: "center",
          letterSpacing: 0,
          width: "100%"
        }}
      >
        CO
      </div>
    ),
    size
  );
}
