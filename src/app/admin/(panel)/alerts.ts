"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SOUND_KEY = "adminSoundOn";

export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function writeFlag(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // localStorage može biti blokiran — postavka se tada ne pamti, ali sve radi.
  }
}

// Zvuk nove narudžbe generiran Web Audio API-jem (bez datoteka): tri kratka rastuća tona.
// Preglednici ne dopuštaju zvuk bez dodira korisnika, pa ga uključuje veliki gumb;
// odluka se pamti i nakon ponovnog otvaranja prvi dodir ekrana ponovno budi zvuk.
export function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [ready, setReady] = useState(false);

  const ensureContext = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    ctx.onstatechange = () => setReady(ctx.state === "running");
    ctxRef.current = ctx;
    return ctx;
  }, []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const start = ctx.currentTime + 0.02;
    [784, 988, 1175].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = start + index * 0.17;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.5);
    });
  }, []);

  const enable = useCallback(async () => {
    const ctx = ensureContext();
    if (!ctx) return;
    await ctx.resume();
    setReady(ctx.state === "running");
    writeFlag(SOUND_KEY, true);
    play();
  }, [ensureContext, play]);

  useEffect(() => {
    if (!readFlag(SOUND_KEY)) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const resume = () => void ctx.resume();
    resume();
    window.addEventListener("pointerdown", resume, { once: true });
    return () => window.removeEventListener("pointerdown", resume);
  }, [ensureContext]);

  return { ready, enable, play };
}

// Ekran ne smije zaspati: Screen Wake Lock, ponovno zatražen kad se tab vrati u fokus.
export function useWakeLock() {
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!("wakeLock" in navigator)) {
      const markUnsupported = () => setUnsupported(true);
      markUnsupported();
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Odbijeno (npr. štednja baterije) — pokušat ćemo opet kad tab postane vidljiv.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release();
    };
  }, []);

  return { unsupported };
}

// Naslov kartice treperi s brojem novih narudžbi, da se vidi i kad je tab u pozadini.
export function useTitleBlink(count: number) {
  useEffect(() => {
    if (count === 0) return;
    const base = document.title;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = on ? `(${count}) NOVA NARUDŽBA!` : base;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = base;
    };
  }, [count]);
}
