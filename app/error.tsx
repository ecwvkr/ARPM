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
          <Button size="sm" variant="outline" render={<Link href="/">대시보드로</Link>} />
        </div>
      </div>
    </div>
  );
}
