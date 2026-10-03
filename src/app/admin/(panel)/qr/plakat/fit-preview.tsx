"use client";

import { useLayoutEffect, useRef, useState } from "react";

// A4 je 210 x 297 mm (≈ 794 x 1123 px). Na telefonu se pregled smanji da stane u širinu ekrana;
// pri ispisu se smanjenje uklanja, pa list ostaje u pravoj veličini.
const SHEET_W = (210 * 96) / 25.4;
const SHEET_H = (297 * 96) / 25.4;

export default function FitPreview({ children }: { children: React.ReactNode }) {
  const holder = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = holder.current;
    if (!element) return;
    const update = () => setScale(Math.min(1, element.clientWidth / SHEET_W));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const s = scale ?? 1;
  return (
    <div ref={holder} className="mx-auto w-full max-w-[210mm] print:max-w-none">
      <div
        className={`mx-auto overflow-hidden rounded-lg shadow-md print:h-auto print:!w-auto print:overflow-visible print:shadow-none ${scale === null ? "opacity-0 print:opacity-100" : ""}`}
        style={{ width: SHEET_W * s, height: SHEET_H * s }}
      >
        <div className="print:!transform-none" style={{ width: "210mm", transform: `scale(${s})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
