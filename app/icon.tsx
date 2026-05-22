import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #14121d 0%, #281a48 55%, #5b4514 100%)",
          border: "2px solid #c99a22",
          borderRadius: 14,
          color: "#e0bb58",
          display: "flex",
          fontSize: 22,
          fontWeight: 800,
          height: "100%",
          justifyContent: "center",
          width: "100%"
        }}
      >
        CO
      </div>
    ),
    size
  );
}
