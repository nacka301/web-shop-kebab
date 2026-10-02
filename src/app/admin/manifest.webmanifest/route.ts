// Manifest za instalaciju /admin na početni zaslon (bez service workera).
export function GET() {
  return Response.json(
    {
      name: "Narudžbe",
      short_name: "Narudžbe",
      description: "Primanje narudžbi uživo.",
      lang: "hr",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#f6f5f2",
      theme_color: "#e8491d",
      icons: [
        { src: "/admin/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/admin/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } }
  );
}
