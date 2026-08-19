"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/projects";
import { revalidateProjectViews } from "@/lib/revalidate";

export async function createTask(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { project, canParticipantAct } = await getProjectAccess(
    projectId,
    session.user.id,
    !!session.user.isSuperAdmin,
  );
  if (!project || !canParticipantAct) throw new Error("권한이 없습니다.");
  if (project.completedAt) throw new Error("완료된 프로젝트는 수정할 수 없습니다.");

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return;

  await prisma.taskItem.create({
    data: { projectId, title, createdById: session.user.id },
  });
  await revalidateProjectViews(project.partnerId);
}

export async function toggleTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const task = await prisma.taskItem.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return;

  const { canParticipantAct } = await getProjectAccess(task.projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!canParticipantAct) throw new Error("권한이 없습니다.");
  if (task.project.completedAt) throw new Error("완료된 프로젝트는 수정할 수 없습니다.");

  const done = !task.done;
  await prisma.taskItem.update({
    where: { id: taskId },
    data: { done, completedAt: done ? new Date() : null },
  });
  await revalidateProjectViews(task.project.partnerId);
}

export async function deleteTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const task = await prisma.taskItem.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return;

  const { canParticipantAct } = await getProjectAccess(task.projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!canParticipantAct) throw new Error("권한이 없습니다.");

  await prisma.taskItem.delete({ where: { id: taskId } });
  await revalidateProjectViews(task.project.partnerId);
}
