import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import { BottomNav, TopNav } from "./admin-nav";
import LogoutButton from "./logout-button";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const context = await getStaffContext();
  if (context.status === "anonymous") redirect("/admin/login");

  if (context.status === "no-access") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 text-center">
        <h1 className="font-display text-3xl">Nemate pristup</h1>
        <p className="mt-2 text-base text-[var(--muted)]">
          Račun {context.email ?? ""} nije povezan ni s jednom radnjom. Obratite se administratoru.
        </p>
        <LogoutButton className="mt-6 border border-black/10 bg-white" />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 print:pb-0">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-4 sm:px-6">
          <span className="min-w-0 flex-1 truncate py-3 text-lg font-extrabold md:mr-2 md:flex-none md:max-w-[30%]">{context.restaurant.name}</span>
          <TopNav />
          <LogoutButton />
        </div>
      </header>
      {children}
      <BottomNav />
    </div>
  );
}
