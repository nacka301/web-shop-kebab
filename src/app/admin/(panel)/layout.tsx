import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const context = await getStaffContext();
  if (context.status === "anonymous") redirect("/admin/login");

  if (context.status === "no-access") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 text-center">
        <h1 className="font-display text-3xl">Nemate pristup</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Račun {context.email ?? ""} nije povezan ni s jednom radnjom. Obratite se administratoru.
        </p>
        <LogoutButton className="mt-6 border border-black/10 bg-white" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 print:hidden border-b border-[var(--border)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-1 px-3 sm:px-6">
          <span className="mr-2 max-w-[40%] truncate text-sm font-extrabold">{context.restaurant.name}</span>
          <nav className="flex flex-1 gap-1">
            <Link href="/admin" className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold hover:bg-black/[0.05]">Narudžbe</Link>
            <Link href="/admin/jelovnik" className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold hover:bg-black/[0.05]">Jelovnik</Link>
            <Link href="/admin/qr" className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold hover:bg-black/[0.05]">QR</Link>
            <Link href="/admin/statistika" className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold hover:bg-black/[0.05]">Statistika</Link>
            <Link href="/admin/postavke" className="flex min-h-12 items-center rounded-xl px-3 text-sm font-bold hover:bg-black/[0.05]">Postavke</Link>
          </nav>
          <LogoutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
