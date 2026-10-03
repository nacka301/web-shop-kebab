"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, QrCode, Settings, UtensilsCrossed } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Narudžbe", Icon: ClipboardList, exact: true },
  { href: "/admin/jelovnik", label: "Jelovnik", Icon: UtensilsCrossed },
  { href: "/admin/qr", label: "QR", Icon: QrCode },
  { href: "/admin/statistika", label: "Statistika", Icon: BarChart3 },
  { href: "/admin/postavke", label: "Postavke", Icon: Settings },
] as const;

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
}

// Mobitel: traka na dnu ekrana (zona dosega palca), 5 jednakih ciljeva od 64 px s ikonom i riječju.
// Računalo: isti izbornik vodoravno u zaglavlju.
export function BottomNav() {
  const isActive = useActive();
  return (
    <nav
      aria-label="Glavni izbornik"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ href, label, Icon, ...rest }) => {
          const active = isActive(href, "exact" in rest ? rest.exact : false);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[13px] font-bold leading-none transition active:bg-black/[0.05] ${active ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Glavni izbornik" className="hidden flex-1 gap-1 md:flex">
      {ITEMS.map(({ href, label, ...rest }) => {
        const active = isActive(href, "exact" in rest ? rest.exact : false);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center rounded-xl px-3 text-base font-bold hover:bg-black/[0.05] ${active ? "text-[var(--brand)]" : ""}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
