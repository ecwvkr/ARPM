import { IconFolder } from "@tabler/icons-react";
import { TaskRow } from "./task-row";
import type { GroupedTaskPartner } from "@/lib/tasks";

// 보드 뷰: 파트너 > 프로젝트명 순으로 묶어 프로젝트별 카드에 태스크를 모아본다.
export function TaskBoardView({ partners }: { partners: GroupedTaskPartner[] }) {
  return (
    <div className="space-y-6">
      {partners.map((partner) => (
        <section key={partner.id} className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: partner.color ?? undefined }}>
            <IconFolder className="size-4" />
            {partner.name}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {partner.projects.map((project) => (
              <div
                key={project.id}
                className="rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10"
              >
                <h3 className="mb-1 truncate text-sm font-medium">{project.title}</h3>
                <div className="divide-y divide-foreground/5">
                  {project.tasks.map((task) => (
                    <TaskRow key={task.id} projectId={project.id} partnerId={partner.id} task={task} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
