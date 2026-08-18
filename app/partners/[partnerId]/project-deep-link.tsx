"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectDetail } from "./project-detail";

// 알림에서 "?project=" 파라미터로 들어오면 해당 프로젝트 상세를 바로 연다.
export function ProjectDeepLink() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  if (!projectId) return null;

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("project");
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>프로젝트 상세</DialogTitle>
        </DialogHeader>
        <ProjectDetail projectId={projectId} onDeleted={close} />
      </DialogContent>
    </Dialog>
  );
}
