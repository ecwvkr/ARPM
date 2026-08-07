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

  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";
  const memberIds = formData
    .getAll("userIds")
    .filter((v): v is string => typeof v === "string" && v !== session.user.id);

  const project = await prisma.project.create({
    data: {
      name,
      visibility,
      ownerId: session.user.id,
      members: {
        create: [
          { userId: session.user.id, role: "OWNER" },
          ...memberIds.map((userId) => ({ userId, role: "MEMBER" as const })),
        ],
      },
    },
  });

  if (memberIds.length > 0) {
    await prisma.notification.createMany({
      data: memberIds.map((userId) => ({
        userId,
        type: "PROJECT_INVITED",
        refId: project.id,
        message: `"${project.name}" 프로젝트에 초대되었습니다.`,
      })),
    });
  }

  revalidatePath("/");
  redirect(`/projects/${project.id}`);
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updateProjectColor(
  projectId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getProjectAccess(projectId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return "프로젝트 owner만 색상을 변경할 수 있습니다.";

  const reset = formData.get("reset") === "1";
  const raw = (formData.get("color") as string | null)?.trim();
  if (!reset && !HEX_COLOR.test(raw ?? "")) return "올바른 색상 값을 선택하세요.";

  await prisma.project.update({ where: { id: projectId }, data: { color: reset ? null : raw } });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/canvas");
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

  const userIds = formData.getAll("userIds").filter((v): v is string => typeof v === "string");
  if (userIds.length === 0) return "초대할 계정을 선택하세요.";

  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { name: true } });

  await prisma.$transaction(
    userIds.flatMap((userId) => [
      prisma.projectMember.upsert({
        where: { projectId_userId: { projectId, userId } },
        update: {},
        create: { projectId, userId, role: "MEMBER" },
      }),
      prisma.notification.create({
        data: {
          userId,
          type: "PROJECT_INVITED",
          refId: projectId,
          message: `"${project.name}" 프로젝트에 초대되었습니다.`,
        },
      }),
    ]),
  );

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
