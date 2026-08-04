"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProjectAccess } from "@/lib/permissions";

export async function createProject(
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return "프로젝트 이름을 입력하세요.";

  const goalDateRaw = formData.get("goalDate") as string | null;
  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";

  const project = await prisma.project.create({
    data: {
      name,
      goalDate: goalDateRaw ? new Date(goalDateRaw) : null,
      visibility,
      ownerId: session.user.id,
      members: {
        create: { userId: session.user.id, role: "OWNER" },
      },
    },
  });

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

export async function updateProjectVisibility(projectId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) throw new Error("프로젝트 owner만 공개 범위를 변경할 수 있습니다.");

  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";
  await prisma.project.update({ where: { id: projectId }, data: { visibility } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function inviteMember(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return "프로젝트 owner만 멤버를 초대할 수 있습니다.";

  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return "이메일을 입력하세요.";

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return "해당 이메일의 유저를 찾을 수 없습니다.";

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });

  await prisma.$transaction([
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: user.id } },
      update: {},
      create: { projectId, userId: user.id, role: "MEMBER" },
    }),
    prisma.notification.create({
      data: {
        userId: user.id,
        type: "PROJECT_INVITED",
        refId: projectId,
        message: `"${project.name}" 프로젝트에 초대되었습니다.`,
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
}

export async function toggleProjectArchive(projectId: string) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) throw new Error("총관리자만 숨김을 변경할 수 있습니다.");

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  await prisma.project.update({
    where: { id: projectId },
    data: { isArchived: !project.isArchived },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
}

export async function softDeleteProject(projectId: string) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) throw new Error("총관리자만 삭제할 수 있습니다.");

  await prisma.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  redirect("/");
}
