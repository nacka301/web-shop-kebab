import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

// Jednostavna ikona generirana u hodu (bez datoteka): narančasti kvadrat s bijelim "N".
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = Number(size);
  if (!SIZES.has(px)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e8491d",
          color: "#ffffff",
          fontSize: px * 0.62,
          fontWeight: 800,
        }}
      >
        N
      </div>
    ),
    { width: px, height: px, headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
