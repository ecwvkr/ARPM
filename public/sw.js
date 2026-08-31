// 웹 푸시 수신용 서비스 워커. 앱 캐싱은 하지 않는다 — 푸시를 받기 위해 필요한
// 최소한만 둔다(오프라인 캐시는 별개 문제고, 잘못 만들면 배포가 반영되지 않는다).

// 새 워커를 바로 띄운다. 기다리게 두면 모든 탭을 닫기 전까지 옛 워커가 남아서,
// 이 파일을 고쳐 배포해도 한참 뒤에야 반영된다.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// 크롬은 fetch 처리기가 있어야 '앱 설치'로 인정한다(PWA 설치 조건). 실제로 가로채는
// 것은 없다 — 응답을 건드리면 배포한 새 버전이 캐시에 막힐 수 있다.
self.addEventListener("fetch", () => {});

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

  // 이미 열려 있는 탭이 있으면 그 탭을 살리되, 알림이 가리키는 화면으로 옮겨 준다.
  // 그냥 focus만 하면 초대 알림을 눌러도 마지막에 보던 화면이 그대로 뜬다.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (!client.url.startsWith(self.location.origin)) continue;
        if ("navigate" in client) return client.navigate(url).then((c) => c && c.focus());
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
