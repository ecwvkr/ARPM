"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/global-toast";
import { getPushStatus, savePushSubscription, removePushSubscription } from "@/app/actions/push";

// base64url로 온 VAPID 공개키를 브라우저가 요구하는 바이트 배열로 바꾼다.
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "checking" | "unsupported" | "unconfigured" | "denied" | "off" | "on";

export function PushForm({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [deviceCount, setDeviceCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 지원 여부·권한·구독 상태를 한 번에 판정한다. 브라우저와 서버를 함께 봐야 하므로
  // 비동기 한 덩어리로 묶어 두는 편이 분기가 흩어지지 않는다.
  useEffect(() => {
    let cancelled = false;

    (async (): Promise<{ state: State; count: number }> => {
      if (!publicKey) return { state: "unconfigured", count: 0 };
      // iOS는 홈 화면에 추가한 PWA에서만 푸시를 지원한다. 지원 여부는 브라우저가 알려준다.
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return { state: "unsupported", count: 0 };
      }
      if (Notification.permission === "denied") return { state: "denied", count: 0 };

      const [reg, status] = await Promise.all([navigator.serviceWorker.getRegistration(), getPushStatus()]);
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      return { state: sub ? "on" : "off", count: status.deviceCount };
    })()
      .then((next) => {
        if (cancelled) return;
        setState(next.state);
        setDeviceCount(next.count);
      })
      .catch(() => {
        if (!cancelled) setState("off");
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  function enable() {
    if (!publicKey) return;
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const json = sub.toJSON();
        await savePushSubscription({
          endpoint: sub.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
        });
        setState("on");
        setDeviceCount((n) => n + 1);
        setErrorMessage(null);
        showToast("이 기기에서 알림을 받습니다");
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "알림을 켤 수 없습니다.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
        setDeviceCount((n) => Math.max(0, n - 1));
        showToast("이 기기의 알림을 껐습니다");
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "알림을 끌 수 없습니다.");
      }
    });
  }

  return (
    <div className="max-w-sm space-y-2">
      {state === "checking" && <p className="text-sm text-muted-foreground">확인 중...</p>}

      {state === "unconfigured" && (
        <p className="text-sm text-muted-foreground">
          서버에 푸시 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.
        </p>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-muted-foreground">
          이 브라우저는 웹 푸시를 지원하지 않습니다. 아이폰은 사파리에서 &lsquo;홈 화면에 추가&rsquo;한
          뒤 그 앱에서 켜야 합니다.
        </p>
      )}

      {state === "denied" && (
        <p className="text-sm text-muted-foreground">
          브라우저에서 알림이 차단되어 있습니다. 주소창 옆 자물쇠 아이콘에서 알림을 허용으로 바꿔 주세요.
        </p>
      )}

      {(state === "off" || state === "on") && (
        <>
          <div className="flex items-center gap-2">
            {state === "on" ? (
              <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={disable}>
                이 기기 알림 끄기
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={isPending} onClick={enable}>
                이 기기에서 알림 받기
              </Button>
            )}
            <span className="text-xs text-muted-foreground">알림 받는 기기 {deviceCount}대</span>
          </div>
          <p className="text-xs text-muted-foreground">
            채팅 메시지가 오면 앱을 닫아 두어도 알림이 옵니다. 기기마다 따로 켜야 합니다.
          </p>
        </>
      )}

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
}
