import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type ProjectCardData = {
  id: string;
  name: string;
  goalDate: Date | null;
  visibility: "PUBLIC" | "PRIVATE";
  isArchived: boolean;
  deletedAt: Date | null;
  owner: { name: string };
  members: { userId: string }[];
  _count: { tasks: number };
};

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const hidden = project.isArchived || project.deletedAt !== null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex aspect-4/3 flex-col justify-between rounded-xl border-[0.5px] bg-card p-4 transition-colors hover:bg-accent/50"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium">{project.name}</h3>
        <Badge variant={project.visibility === "PUBLIC" ? "secondary" : "outline"}>
          {project.visibility === "PUBLIC" ? "공개" : "비공개"}
        </Badge>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>owner: {project.owner.name}</p>
        <p>멤버 {project.members.length}명 · 업무 {project._count.tasks}개</p>
        {project.goalDate && (
          <p>목표일 {new Date(project.goalDate).toLocaleDateString("ko-KR")}</p>
        )}
        {hidden && (
          <Badge variant="destructive">
            {project.deletedAt ? "삭제됨" : "숨김"}
          </Badge>
        )}
      </div>
    </Link>
  );
}
