/* Smart Noakhali Service Worker Push & Click Handler */

self.addEventListener("push", (event) => {
  let payload = {
    title: "স্মার্ট নোয়াখালী",
    body: "আপনার জন্য একটি নতুন বিজ্ঞপ্তি রয়েছে।",
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag: "smart-noakhali-alert",
    data: {
      url: "/notifications",
    },
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || parsed.message || payload.body,
        icon: parsed.icon || payload.icon,
        badge: parsed.badge || payload.badge,
        tag: parsed.tag || parsed.id || payload.tag,
        data: {
          url: parsed.link || parsed.url || (parsed.data && parsed.data.url) || "/notifications",
          category: parsed.category || (parsed.data && parsed.data.category) || "",
          priority: parsed.priority || (parsed.data && parsed.data.priority) || "normal",
          notificationId: parsed.id || (parsed.data && parsed.data.notificationId) || "",
        },
      };
    } catch {
      const textBody = event.data.text();
      if (textBody) {
        payload.body = textBody;
      }
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: true,
    requireInteraction: payload.data && payload.data.priority === "urgent",
    data: payload.data,
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(payload.title, options),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          try {
            client.postMessage({
              type: "SN_PUSH_RECEIVED",
              payload,
            });
          } catch {
            // ignore
          }
        }
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const targetPath = data.url || data.link || "/notifications";
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        try {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            return client.focus().then((focused) => {
              if (focused && "navigate" in focused && focused.url !== targetUrl) {
                return focused.navigate(targetUrl).catch(() => focused);
              }
              return focused;
            });
          }
        } catch {
          // ignore
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
