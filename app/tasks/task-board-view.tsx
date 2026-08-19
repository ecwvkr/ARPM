import { IconFolder, IconChevronRight } from "@tabler/icons-react";
import { TaskRow } from "./task-row";
import type { GroupedTaskPartner } from "@/lib/tasks";

// 보드 뷰: 파트너 > 프로젝트명 순으로 묶어 카드에 태스크를 모아본다. 파트너·프로젝트
// 두 단계 모두 캐럿으로 접었다 펼 수 있다.
export function TaskBoardView({ partners }: { partners: GroupedTaskPartner[] }) {
  return (
    <div className="space-y-4">
      {partners.map((partner) => (
        <details key={partner.id} open className="group/partner space-y-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-bold">
            <IconChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/partner:rotate-90" />
            <IconFolder className="size-4 shrink-0" style={{ color: partner.color ?? undefined }} />
            <span style={{ color: partner.color ?? undefined }}>{partner.name}</span>
            <span className="font-normal text-muted-foreground">({partner.projects.length})</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partner.projects.map((project) => (
              <details
                key={project.id}
                open
                className="group/project rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10"
              >
                <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium">
                  <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/project:rotate-90" />
                  <span className="min-w-0 flex-1 truncate">{project.title}</span>
                  <span className="shrink-0 text-xs font-normal text-muted-foreground">
                    {project.tasks.filter((t) => !t.done).length}/{project.tasks.length}
                  </span>
                </summary>
                <div className="mt-1 divide-y divide-foreground/5">
                  {project.tasks.map((task) => (
                    <TaskRow key={task.id} projectId={project.id} partnerId={partner.id} task={task} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
