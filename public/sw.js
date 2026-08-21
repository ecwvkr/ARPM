// 웹 푸시 수신용 서비스 워커. 앱 캐싱은 하지 않는다 — 푸시를 받기 위해 필요한
// 최소한만 둔다(오프라인 캐시는 별개 문제고, 잘못 만들면 배포가 반영되지 않는다).
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "AR_PM", body: "", url: "/" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      // 같은 방의 알림은 쌓이지 않고 최신 것으로 덮인다.
      tag: payload.url,
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  // 이미 열려 있는 탭이 있으면 그 탭을 살린다.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
