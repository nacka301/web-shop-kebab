// Sadržaj obavijesti o novoj narudžbi. Namjerno BEZ imena i telefona gosta: obavijest prolazi kroz
// push servis preglednika (Google/Apple/Mozilla) i vidljiva je na zaključanom ekranu.
export type PushPayload = { title: string; body: string; url: string; tag: string };

const ITEMS = (n: number) => {
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return "stavka";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "stavke";
  return "stavki";
};

export function buildNewOrderPush(input: { shortCode: string; itemCount: number; totalCents: number }): PushPayload {
  const euro = (input.totalCents / 100).toFixed(2).replace(".", ",");
  return {
    title: `Nova narudžba ${input.shortCode}`,
    body: `${input.itemCount} ${ITEMS(input.itemCount)} · ${euro} €`,
    url: "/admin",
    tag: `order-${input.shortCode}`,
  };
}
