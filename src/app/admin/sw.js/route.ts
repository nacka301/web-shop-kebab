// Service worker samo za /admin: prima web push i otvara ploču s narudžbama na dodir obavijesti.
// Servira se kao route (ne iz public/) da mu je doseg /admin/ i da ga proxy ne traži prijavu.
const SW = `
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || "Nova narudžba";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "order",
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300, 150, 300],
      icon: "/admin/icons/192",
      badge: "/admin/icons/192",
      data: { url: data.url || "/admin" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes("/admin") && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
`;

export function GET() {
  return new Response(SW, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
