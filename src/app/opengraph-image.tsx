import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const svg = await readFile(
    path.join(process.cwd(), "public/brand/logo.svg"),
    "utf8",
  );
  const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        background:
          "radial-gradient(60% 55% at 50% 0%, rgba(238,3,15,0.22), #050607 70%)",
        color: "#f4f4f5",
      }}
    >
      <img src={logo} alt="" width={640} height={205} />
      <div style={{ fontSize: 40, color: "#c9c9cf", letterSpacing: -0.5 }}>
        {SITE_DESCRIPTION}
      </div>
    </div>,
    size,
  );
}
