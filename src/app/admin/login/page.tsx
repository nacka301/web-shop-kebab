import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/admin/context";
import LoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Već prijavljen vlasnik ne treba ponovno unositi lozinku.
  if ((await getStaffContext()).status === "ok") redirect("/admin");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="font-display text-3xl">Prijava za vlasnike</h1>
      <p className="mt-2 text-base text-[var(--muted)]">Prijavi se računom koji ti je dao administrator.</p>
      <LoginForm />
    </main>
  );
}
