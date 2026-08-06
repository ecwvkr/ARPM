"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TaskDetail } from "./task-detail";

// 알림에서 "?task=" 파라미터로 들어오면 해당 업무 상세를 바로 연다.
export function TaskDeepLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");

  if (!taskId) return null;

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("task");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <Sheet open onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>업무 상세</SheetTitle>
        </SheetHeader>
        <TaskDetail taskId={taskId} onDeleted={close} />
      </SheetContent>
    </Sheet>
  );
}
