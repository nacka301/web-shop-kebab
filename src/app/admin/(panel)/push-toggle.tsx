"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Obavijesti na ovom uređaju: pretplata se sprema u bazu (RLS: samo za vlastitu radnju),
// a server šalje push čim stigne narudžba, i kad je ekran zaključan ili aplikacija zatvorena.
export default function PushToggle({ restaurantId }: { restaurantId: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // iPhone: Push postoji samo u aplikaciji dodanoj na početni zaslon.
      setState(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription && Notification.permission === "granted" ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    // Odgođeno u mikrotask: provjera stanja pretplate je vanjski sustav (preglednik), ne dio rendera.
    void Promise.resolve().then(refresh);
  }, [refresh]);

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      await navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/", updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!) }));
      const json = subscription.toJSON();
      const supabase = createBrowserSupabaseClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("subscription");
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          { restaurant_id: restaurantId, user_id: auth.user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
          { onConflict: "endpoint" }
        );
      if (error) throw new Error("save");
      setState("on");
      setMessage("Obavijesti su uključene na ovom uređaju.");
    } catch {
      setMessage("Uključivanje obavijesti nije uspjelo. Pokušaj ponovno.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/admin/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await createBrowserSupabaseClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch {
      setMessage("Isključivanje nije uspjelo. Pokušaj ponovno.");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/push/test", { method: "POST" });
      setMessage(response.ok ? "Poslana je probna obavijest. Stiže za nekoliko sekundi." : "Probna obavijest nije poslana.");
    } catch {
      setMessage("Probna obavijest nije poslana.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading") return null;

  const box = "mt-3 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm card-shadow";
  if (state === "needs-install")
    return (
      <p className={`${box} font-semibold`}>
        <Bell className="mr-1.5 inline h-4 w-4" /> Za obavijesti na iPhoneu: Safari → Podijeli → „Dodaj na početni zaslon”, pa otvori aplikaciju s početnog zaslona i uključi obavijesti.
      </p>
    );
  if (state === "unsupported")
    return <p className={`${box} text-[var(--muted)]`}>Ovaj preglednik ne podržava obavijesti kad je ekran zaključan.</p>;
  if (state === "denied")
    return (
      <p className={`${box} font-semibold text-red-700`}>
        Obavijesti su blokirane. Dopusti ih u postavkama preglednika za ovu stranicu (ikona lokota → Obavijesti), pa osvježi.
      </p>
    );

  return (
    <section className={box}>
      {state === "off" ? (
        <button
          onClick={() => void enable()}
          disabled={busy}
          className="min-h-12 w-full rounded-xl bg-[var(--brand)] px-4 text-base font-bold text-white transition active:scale-[0.97] disabled:opacity-50"
        >
          <BellRing className="mr-2 inline h-5 w-5" /> Uključi obavijesti o narudžbama
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 font-bold text-green-700">
            <BellRing className="mr-1.5 inline h-4 w-4" /> Obavijesti uključene na ovom uređaju
          </span>
          <button onClick={() => void sendTest()} disabled={busy} className="min-h-11 rounded-xl border border-[var(--border)] px-3 font-bold disabled:opacity-50">
            Probna obavijest
          </button>
          <button onClick={() => void disable()} disabled={busy} className="min-h-11 rounded-xl px-3 font-bold text-[var(--muted)] disabled:opacity-50">
            Isključi
          </button>
        </div>
      )}
      {message && <p className="mt-2 font-semibold">{message}</p>}
    </section>
  );
}
