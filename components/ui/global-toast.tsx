"use client";

import { useEffect, useState } from "react";

// 카드 자체가 사라지는 동작(보관 등) 뒤에 뜨는 토스트는 그 카드에 상태를 두면 카드가
// 언마운트되면서 같이 사라진다. 대신 커스텀 이벤트로 쏘고, 루트 레이아웃에 한 번만
// 마운트되는 이 호스트가 페이지 전환과 무관하게 받아서 띄운다.
const EVENT = "app-toast";

export function showToast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function GlobalToastHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function handle(e: Event) {
      setMessage((e as CustomEvent<string>).detail);
    }
    window.addEventListener(EVENT, handle);
    return () => window.removeEventListener(EVENT, handle);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 1500);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-100 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-medium whitespace-nowrap text-background shadow-lg">
      ✓ {message}
    </div>
  );
}
