import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Business Research — business process automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const bytes = await readFile(join(process.cwd(), "public/brand.png"));
  const src = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;

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
          background: "linear-gradient(135deg, #020617 0%, #0f172a 42%, #1e1b4b 100%)",
        }}
      >
        <img src={src} width={260} height={260} alt="" />
        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 600,
            color: "#f8fafc",
            marginTop: 16,
            letterSpacing: "-0.04em",
          }}
        >
          Business Research
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#94a3b8", marginTop: 10 }}>
          Identify repetitive work and automate the processes that matter
        </div>
      </div>
    ),
    { ...size },
  );
}
