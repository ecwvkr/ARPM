"use client";

import { useEffect, useState } from "react";

// ponytail: 단일 인스턴스 훅. 여러 곳에서 동시에 띄울 필요가 생기면 그때 컨텍스트로 승격.
export function useSavedToast(message = "저장되었습니다") {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, [visible]);

  const toast = visible ? (
    <div className="fixed bottom-6 left-1/2 z-100 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-medium whitespace-nowrap text-background shadow-lg">
      ✓ {message}
    </div>
  ) : null;

  return { toast, trigger: () => setVisible(true) };
}
