"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="max-w-sm space-y-3 rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <h1 className="text-base font-bold">문제가 발생했습니다</h1>
        <p className="text-sm text-muted-foreground">
          페이지를 불러오는 중 오류가 발생했습니다. 다시 시도해 주세요.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <Button size="sm" onClick={reset}>
            다시 시도
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/login">다시 로그인</Link>} />
        </div>
        {/* 프로덕션 빌드는 에러 메시지를 숨기므로(React #441), 서버 로그와 대조할 수 있는
            digest만이라도 보여준다. 문의 시 이 값이 있으면 원인 추적이 가능하다. */}
        {error.digest && (
          <p className="pt-1 font-mono text-xs text-muted-foreground/70">오류 코드: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
