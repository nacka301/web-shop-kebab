import { ImageResponse } from "next/og";
import { fetchShopBySlug } from "@/lib/data/restaurants";

export const dynamic = "force-dynamic";
export const alt = "Naruči online";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generirana kartica za pregled linka: boja radnje, naziv i poziv na naručivanje.
export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  const color = shop?.accentColor ?? "#e8491d";
  const name = shop?.naziv ?? "Naruči online";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: color,
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 38, fontWeight: 700, opacity: 0.9 }}>{shop?.adresa ?? ""}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: name.length > 14 ? 110 : 150, fontWeight: 800, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 56, fontWeight: 700 }}>Naruči online, bez čekanja u redu</div>
        </div>
        <div style={{ display: "flex", fontSize: 34, fontWeight: 600, opacity: 0.9 }}>Plaćanje pri preuzimanju</div>
      </div>
    ),
    size
  );
}
