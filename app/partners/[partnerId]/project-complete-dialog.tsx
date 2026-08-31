"use client";

import { useEffect, useState, useTransition } from "react";
import { completeProject, listUnfinishedTasks } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showToast } from "@/components/ui/global-toast";

// 프로젝트를 완료할 때 거치는 확인 창. 남은 태스크가 있으면 그것들도 같이 완료할지
// 함께 고른다 — 완료된 프로젝트는 수정이 막혀서, 미완으로 남은 태스크는 완료를
// 취소하기 전까지 손댈 수 없기 때문이다.
//
// 열려 있을 때만 마운트되는 것을 전제로 한다(호출부에서 조건부 렌더). 그래야 열 때마다
// 남은 태스크를 새로 읽으면서도 effect 안에서 상태를 되돌릴 필요가 없다.
export function ProjectCompleteDialog({
  projectId,
  onClose,
  onDone,
}: {
  projectId: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [tasks, setTasks] = useState<{ id: string; title: string }[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    listUnfinishedTasks(projectId).then(setTasks);
  }, [projectId]);

  function run(completeTasks: boolean) {
    startTransition(async () => {
      try {
        await completeProject(projectId, completeTasks);
        showToast(completeTasks ? "프로젝트와 남은 태스크를 완료했습니다" : "'완료'로 변경되었습니다");
        onClose();
        onDone?.();
      } catch {
        alert("완료할 수 없습니다. 권한을 확인하세요.");
      }
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>프로젝트 완료</DialogTitle>
        </DialogHeader>

        {tasks === null ? (
          <p className="text-sm text-muted-foreground">남은 태스크를 확인하는 중...</p>
        ) : tasks.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">완료 시 수정이 불가능합니다. 완료하시겠습니까?</p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={isPending} onClick={onClose}>
                아니요
              </Button>
              <Button size="sm" disabled={isPending} onClick={() => run(false)}>
                네
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm">남아있는 태스크도 완료 처리 하시겠습니까?</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted/50 p-2 text-sm">
                {tasks.map((t) => (
                  <li key={t.id} className="truncate">
                    · {t.title}
                  </li>
                ))}
              </ul>
              {/* 두 버튼 다 프로젝트는 완료시킨다 — 취소는 창을 닫는 쪽이라 따로 적어 둔다. */}
              <p className="text-xs text-muted-foreground">
                완료 시 수정이 불가능합니다. &apos;아니요&apos;를 눌러도 프로젝트는 완료되며, 그만두려면 창을
                닫으세요.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(false)}>
                아니요
              </Button>
              <Button size="sm" disabled={isPending} onClick={() => run(true)}>
                예
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
