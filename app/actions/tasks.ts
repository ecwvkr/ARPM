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

// 체크(완료 토글)는 프로젝트 참여자 누구나 할 수 있는 공유 체크리스트 동작이다.
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

// 내용 수정·삭제는 체크와 달리 "내가 쓴 것" 또는 프로젝트 master(+총관리자)만 가능하다.
async function assertCanEditTask(taskId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const task = await prisma.taskItem.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return null;

  const isAuthor = task.createdById === session.user.id;
  const isMaster = task.project.masterId === session.user.id;
  if (!isAuthor && !isMaster && !session.user.isSuperAdmin) {
    throw new Error("작성자 또는 master만 수정·삭제할 수 있습니다.");
  }
  return task;
}

export async function updateTask(taskId: string, formData: FormData) {
  const task = await assertCanEditTask(taskId);
  if (!task) return;
  if (task.project.completedAt) throw new Error("완료된 프로젝트는 수정할 수 없습니다.");

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) return;

  await prisma.taskItem.update({ where: { id: taskId }, data: { title } });
  await revalidateProjectViews(task.project.partnerId);
}

export async function deleteTask(taskId: string) {
  const task = await assertCanEditTask(taskId);
  if (!task) return;

  await prisma.taskItem.delete({ where: { id: taskId } });
  await revalidateProjectViews(task.project.partnerId);
}

// 태스크 담당(작성자)을 다른 참여자에게 넘긴다. 작성자 본인 또는 프로젝트 master만 가능하고,
// 넘길 대상은 그 프로젝트에 참여 중인 사람으로 제한한다.
export async function transferTaskOwner(taskId: string, newOwnerId: string) {
  const task = await assertCanEditTask(taskId);
  if (!task) return;
  if (task.createdById === newOwnerId) return;

  const eligible =
    newOwnerId === task.project.masterId ||
    (await prisma.projectParticipant.findUnique({
      where: { projectId_userId: { projectId: task.projectId, userId: newOwnerId } },
      select: { userId: true },
    })) !== null;
  if (!eligible) throw new Error("이 프로젝트 참여자에게만 넘길 수 있습니다.");

  await prisma.taskItem.update({ where: { id: taskId }, data: { createdById: newOwnerId } });
  await revalidateProjectViews(task.project.partnerId);
}
