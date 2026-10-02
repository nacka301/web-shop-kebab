"use client";

import { useEffect } from "react";

// Broji posjet jelovniku: jednom po kartici preglednika (sessionStorage, bez kolačića), samo
// kad se JavaScript stvarno izvrši, što ujedno odbacuje većinu robota. Šalje se samo slug i izvor.
export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage blokiran: broji se svako otvaranje, što je prihvatljivo.
    }
    const src = new URLSearchParams(window.location.search).get("src");
    fetch("/api/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, src }),
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);

  return null;
}
