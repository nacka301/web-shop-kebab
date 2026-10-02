"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="flex min-h-12 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-base font-bold text-white transition active:scale-[0.97]">
      <Printer className="h-5 w-5" /> Ispiši
    </button>
  );
}
