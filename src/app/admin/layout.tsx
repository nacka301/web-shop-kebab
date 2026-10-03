import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Narudžbe",
  robots: { index: false, follow: false },
  manifest: "/admin/manifest.webmanifest",
  icons: { apple: "/admin/icons/180" },
  appleWebApp: { capable: true, title: "Narudžbe", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#e8491d", viewportFit: "cover" };

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
