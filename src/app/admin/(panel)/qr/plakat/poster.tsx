import { qrSvg } from "@/lib/qr";

// Boje se moraju ispisati i kad preglednik inače izostavlja pozadine.
const EXACT = "[print-color-adjust:exact] [-webkit-print-color-adjust:exact]";

function Qr({ svg, label }: { svg: string; label: string }) {
  return <div role="img" aria-label={label} className="[&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

// A4 plakat: naziv u boji radnje, naslov, veliki QR i kratka uputa.
export async function Poster({ name, color, url }: { name: string; color: string; url: string }) {
  const svg = await qrSvg(url);
  return (
    <section
      data-poster="a4"
      className={`relative mx-auto flex h-[297mm] w-[210mm] flex-col items-center overflow-hidden bg-white text-[#111] ${EXACT}`}
    >
      <div className={`flex h-[62mm] w-full items-center justify-center px-[14mm] text-center ${EXACT}`} style={{ background: color }}>
        <h1 className="text-[22mm] font-extrabold leading-none tracking-tight text-white">{name}</h1>
      </div>
      <h2 className="mt-[14mm] max-w-[170mm] text-center text-[15mm] font-extrabold leading-[1.08]">Naruči online, bez čekanja u redu</h2>
      <div className="mt-[10mm] h-[118mm] w-[118mm] rounded-[4mm] border-[1.2mm] p-[2mm]" style={{ borderColor: color }}>
        <Qr svg={svg} label={`QR kod za ${url}`} />
      </div>
      <p className="mt-[8mm] text-[9mm] font-bold">Skeniraj kamerom mobitela</p>
      <p className="mt-auto pb-[12mm] text-[5mm] text-[#555]">Plaćanje pri preuzimanju</p>
    </section>
  );
}

// Naljepnice oko 8 x 8 cm, 2 x 3 na jednom listu A4 (označene obrubom za rezanje).
export async function Stickers({ name, color, url }: { name: string; color: string; url: string }) {
  const svg = await qrSvg(url);
  return (
    <section
      data-poster="stickers"
      className={`mx-auto grid h-[297mm] w-[210mm] grid-cols-[80mm_80mm] content-center justify-center gap-[8mm] bg-white ${EXACT}`}
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex h-[80mm] w-[80mm] flex-col items-center justify-between rounded-[5mm] border-[1.2mm] bg-white px-[4mm] py-[4mm] text-[#111]"
          style={{ borderColor: color }}
        >
          <p className="max-w-full truncate text-[6.5mm] font-extrabold leading-none" style={{ color }}>{name}</p>
          <div className="h-[50mm] w-[50mm]">
            <Qr svg={svg} label={`QR kod za ${url}`} />
          </div>
          <p className="text-[4.2mm] font-bold leading-none">Skeniraj i naruči online</p>
        </div>
      ))}
    </section>
  );
}
