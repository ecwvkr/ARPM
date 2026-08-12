"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";

export async function createPartner(
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return "파트너 이름을 입력하세요.";

  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";
  const memberIds = formData
    .getAll("userIds")
    .filter((v): v is string => typeof v === "string" && v !== session.user.id);

  const partner = await prisma.partner.create({
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
        type: "PARTNER_INVITED",
        refId: partner.id,
        message: `"${partner.name}" 파트너에 초대되었습니다.`,
      })),
    });
  }

  revalidatePath("/");
  redirect(`/partners/${partner.id}`);
}

export async function updatePartnerName(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return "파트너 owner만 이름을 변경할 수 있습니다.";

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return "파트너 이름을 입력하세요.";

  await prisma.partner.update({ where: { id: partnerId }, data: { name, lastActivityAt: new Date() } });
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/calendar");
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function updatePartnerColor(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return "파트너 owner만 색상을 변경할 수 있습니다.";

  const reset = formData.get("reset") === "1";
  const raw = (formData.get("color") as string | null)?.trim();
  if (!reset && !HEX_COLOR.test(raw ?? "")) return "올바른 색상 값을 선택하세요.";

  await prisma.partner.update({
    where: { id: partnerId },
    data: { color: reset ? null : raw, lastActivityAt: new Date() },
  });
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function updatePartnerVisibility(partnerId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) throw new Error("파트너 owner만 공개 범위를 변경할 수 있습니다.");

  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";
  await prisma.partner.update({ where: { id: partnerId }, data: { visibility, lastActivityAt: new Date() } });
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
}

export async function inviteMember(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return "파트너 owner만 멤버를 초대할 수 있습니다.";

  const userIds = formData.getAll("userIds").filter((v): v is string => typeof v === "string");
  if (userIds.length === 0) return "초대할 계정을 선택하세요.";

  const partner = await prisma.partner.findUniqueOrThrow({ where: { id: partnerId }, select: { name: true } });

  await prisma.$transaction(
    userIds.flatMap((userId) => [
      prisma.partnerMember.upsert({
        where: { partnerId_userId: { partnerId, userId } },
        update: {},
        create: { partnerId, userId, role: "MEMBER" },
      }),
      prisma.notification.create({
        data: {
          userId,
          type: "PARTNER_INVITED",
          refId: partnerId,
          message: `"${partner.name}" 파트너에 초대되었습니다.`,
        },
      }),
    ]),
  );

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
}

export async function removeMember(partnerId: string, userId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { partner, isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!partner || !isOwner) throw new Error("파트너 owner만 멤버를 제외할 수 있습니다.");
  if (userId === partner.ownerId) throw new Error("owner는 제외할 수 없습니다.");

  await prisma.partnerMember.deleteMany({ where: { partnerId, userId } });
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
}

// 숨김은 계정별 개인 설정이다(D2) — 이 파트너를 볼 수 있는 사람이면 누구나 자신의
// 대시보드에서만 켜고 끌 수 있고, 다른 사람의 화면에는 영향을 주지 않는다.
export async function togglePartnerHide(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) throw new Error("접근할 수 없는 파트너입니다.");

  const existing = await prisma.partnerHide.findUnique({
    where: { userId_partnerId: { userId: session.user.id, partnerId } },
  });

  if (existing) {
    await prisma.partnerHide.delete({ where: { userId_partnerId: { userId: session.user.id, partnerId } } });
  } else {
    await prisma.partnerHide.create({ data: { userId: session.user.id, partnerId } });
  }

  revalidatePath("/");
}

// 즐겨찾기도 숨김과 마찬가지로 계정별 개인 설정 — 대시보드 정렬과 무관하게 항상 최상단에 고정된다.
export async function togglePartnerPin(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { canView } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!canView) throw new Error("접근할 수 없는 파트너입니다.");

  const existing = await prisma.partnerPin.findUnique({
    where: { userId_partnerId: { userId: session.user.id, partnerId } },
  });

  if (existing) {
    await prisma.partnerPin.delete({ where: { userId_partnerId: { userId: session.user.id, partnerId } } });
  } else {
    await prisma.partnerPin.create({ data: { userId: session.user.id, partnerId } });
  }

  revalidatePath("/");
}

export async function softDeletePartner(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // 소프트 삭제라 총관리자가 언제든 복구할 수 있으므로 owner에게도 연다.
  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner && !session.user.isSuperAdmin) {
    throw new Error("파트너 owner 또는 총관리자만 삭제할 수 있습니다.");
  }

  await prisma.partner.update({
    where: { id: partnerId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/");
  redirect("/");
}

export async function restorePartner(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new Error("존재하지 않는 파트너입니다.");
  if (partner.ownerId !== session.user.id && !session.user.isSuperAdmin) {
    throw new Error("owner 또는 총관리자만 복구할 수 있습니다.");
  }

  await prisma.partner.update({
    where: { id: partnerId },
    data: { deletedAt: null },
  });

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
  revalidatePath("/settings");
}

// 보관함에서의 2차 삭제 — 되돌릴 수 없다(D3). 하위 프로젝트·멤버·숨김 기록은 FK cascade로 함께 지워진다.
export async function hardDeletePartner(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner || !partner.deletedAt) throw new Error("보관된 파트너가 아닙니다.");
  if (partner.ownerId !== session.user.id && !session.user.isSuperAdmin) {
    throw new Error("owner 또는 총관리자만 영구 삭제할 수 있습니다.");
  }

  const confirmText = formData.get("confirm") as string | null;
  if (confirmText !== "영구삭제") return "'영구삭제'를 정확히 입력하세요.";

  await prisma.partner.delete({ where: { id: partnerId } });
  revalidatePath("/settings");
}
