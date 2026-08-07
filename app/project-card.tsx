import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type ProjectCardData = {
  id: string;
  name: string;
  goalDate: Date | null;
  visibility: "PUBLIC" | "PRIVATE";
  isArchived: boolean;
  deletedAt: Date | null;
  color: string | null;
  tasks: { status: string }[];
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const hidden = project.isArchived || project.deletedAt !== null;
  const inProgressCount = project.tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <Link
      href={`/projects/${project.id}`}
      style={project.color ? { borderLeftColor: project.color } : undefined}
      className={`flex aspect-4/3 flex-col justify-between rounded-4xl bg-card p-4 shadow-md ring-1 ring-foreground/5 transition-shadow hover:shadow-lg dark:ring-foreground/10 ${
        project.color ? "border-l-4" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold">{project.name}</h3>
        <Badge
          variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}
          className="rounded-full bg-background px-3"
        >
          {project.visibility === "PUBLIC" ? "공개" : "비공개"}
        </Badge>
      </div>
      <div className="space-y-0.5 text-sm text-muted-foreground">
        {hidden && (
          <Badge variant="destructive" className="mb-1 rounded-full">
            {project.deletedAt ? "삭제됨" : "숨김"}
          </Badge>
        )}
        <p>업무 {project.tasks.length}개</p>
        <p>진행중 {inProgressCount}개</p>
      </div>
    </Link>
  );
}
