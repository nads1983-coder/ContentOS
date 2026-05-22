import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #050509 0%, #14121d 44%, #27184a 100%)",
          color: "#f4f1ea",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, Arial, sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: 72,
          width: "100%"
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 24 }}>
          <div
            style={{
              alignItems: "center",
              background: "linear-gradient(135deg, rgba(139,63,242,0.46), rgba(201,154,34,0.24))",
              border: "3px solid #c99a22",
              borderRadius: 24,
              color: "#e0bb58",
              display: "flex",
              fontSize: 42,
              fontWeight: 900,
              height: 96,
              justifyContent: "center",
              width: 96
            }}
          >
            CO
          </div>
          <div style={{ fontSize: 42, fontWeight: 800 }}>ContentOS</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#e0bb58", fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
            AI Social Content Generator
          </div>
          <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.02, maxWidth: 960 }}>
            Create platform-ready content from one idea.
          </div>
        </div>
      </div>
    ),
    size
  );
}
