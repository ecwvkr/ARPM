import { listProjectsForPartner } from "@/lib/projects";
import { ProjectListFilterable } from "./project-list-filterable";

export async function ProjectList({
  partnerId,
  userId,
  isSuperAdmin,
}: {
  partnerId: string;
  userId: string;
  isSuperAdmin: boolean;
}) {
  const projects = await listProjectsForPartner(partnerId, userId, isSuperAdmin);

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">아직 프로젝트가 없습니다.</p>;
  }

  return <ProjectListFilterable projects={projects} currentUserId={userId} />;
}

export type PartnerProjectSummary = Awaited<ReturnType<typeof listProjectsForPartner>>[number];
