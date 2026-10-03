import { formatTime } from "@/lib/hours";
import { formatEuro } from "@/lib/orders/limits";
import type { PricedLine } from "@/lib/orders/pricing";

export type NewOrderEmailInput = {
  restaurantName: string;
  shortCode: string;
  customerName: string;
  customerPhone: string;
  pickupType: "asap" | "time";
  pickupTime: Date | null;
  note: string;
  totalCents: number;
  lines: PricedLine[];
  adminUrl: string;
};

// Sve što je upisao kupac (ime, napomena, nazivi) ide u HTML, pa se uvijek escapea.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const singleLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

function pickupText(input: NewOrderEmailInput): string {
  if (input.pickupType !== "time" || !input.pickupTime) return "Što prije";
  const day = input.pickupTime.toLocaleDateString("hr-HR", { timeZone: "Europe/Zagreb", day: "2-digit", month: "2-digit" }).replace(/\s/g, "");
  return `${formatTime(input.pickupTime)} (${day})`;
}

export function buildNewOrderEmail(input: NewOrderEmailInput): { subject: string; html: string; text: string } {
  const subject = singleLine(`Nova narudžba ${input.shortCode} · ${formatEuro(input.totalCents)}`);
  const pickup = pickupText(input);

  const lineText = (line: PricedLine) =>
    `${line.qty}× ${line.name}${line.options.length ? ` (${line.options.map((o) => o.name).join(", ")})` : ""} — ${formatEuro(line.lineTotalCents)}`;

  const text = [
    `Nova narudžba ${input.shortCode} — ${input.restaurantName}`,
    "",
    `Kupac: ${singleLine(input.customerName)}`,
    `Telefon: ${input.customerPhone}`,
    `Preuzimanje: ${pickup}`,
    "",
    ...input.lines.map(lineText),
    ...(input.note ? ["", `NAPOMENA: ${singleLine(input.note)}`] : []),
    "",
    `Ukupno: ${formatEuro(input.totalCents)} (plaćanje pri preuzimanju)`,
    "",
    `Otvori narudžbe: ${input.adminUrl}`,
  ].join("\n");

  const rows = input.lines
    .map(
      (line) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:16px;line-height:1.4;">
          <strong>${line.qty}×</strong> ${escapeHtml(line.name)}
          ${line.options.length ? `<br><span style="color:#777;font-size:14px;">${escapeHtml(line.options.map((o) => o.name).join(", "))}</span>` : ""}
        </td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #eee;font-size:16px;white-space:nowrap;text-align:right;vertical-align:top;">${escapeHtml(formatEuro(line.lineTotalCents))}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f5f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#201c18;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f2;"><tr><td align="center" style="padding:16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;">
      <tr><td style="padding:24px 24px 8px;">
        <div style="font-size:14px;color:#777;">${escapeHtml(input.restaurantName)} · nova narudžba</div>
        <div style="font-size:40px;font-weight:800;letter-spacing:-0.5px;line-height:1.1;margin-top:4px;">${escapeHtml(input.shortCode)}</div>
      </td></tr>
      <tr><td style="padding:8px 24px;font-size:16px;line-height:1.5;">
        <strong>${escapeHtml(singleLine(input.customerName))}</strong><br>
        <a href="tel:${escapeHtml(input.customerPhone)}" style="color:#c93c14;font-weight:700;text-decoration:none;">${escapeHtml(input.customerPhone)}</a><br>
        Preuzimanje: <strong>${escapeHtml(pickup)}</strong>
      </td></tr>
      <tr><td style="padding:8px 24px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
      ${
        input.note
          ? `<tr><td style="padding:8px 24px;"><div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:12px;padding:12px 14px;font-size:16px;font-weight:700;color:#78350f;">Napomena: ${escapeHtml(singleLine(input.note))}</div></td></tr>`
          : ""
      }
      <tr><td style="padding:8px 24px 4px;font-size:20px;font-weight:800;">Ukupno: ${escapeHtml(formatEuro(input.totalCents))}<div style="font-size:13px;font-weight:500;color:#777;">Plaćanje pri preuzimanju</div></td></tr>
      <tr><td align="center" style="padding:20px 24px 28px;">
        <a href="${escapeHtml(input.adminUrl)}" style="display:block;background:#e8491d;color:#ffffff;font-size:18px;font-weight:800;text-decoration:none;padding:16px 20px;border-radius:12px;">Otvori narudžbe</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  return { subject, html, text };
}
