import { ImageResponse } from "next/og";
import { fetchShopBySlug } from "@/lib/data/restaurants";

export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon u boji radnje: prvo slovo naziva na accent_color pozadini.
export default async function Icon({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await fetchShopBySlug(slug);
  const letter = (shop?.naziv ?? "N").trim().charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: shop?.accentColor ?? "#e8491d",
          color: "#ffffff",
          fontSize: 42,
          fontWeight: 800,
          borderRadius: 14,
        }}
      >
        {letter}
      </div>
    ),
    size
  );
}
