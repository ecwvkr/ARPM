"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";

// 파트너 이름은 중복을 허용하지 않는다. 보관함(deletedAt)에 있는 것도 복구하면 되살아나므로
// 중복 판정에 포함한다. excludeId는 이름 수정 시 자기 자신을 제외하기 위한 것.
async function findDuplicateName(name: string, excludeId?: string) {
  return prisma.partner.findFirst({
    where: { name, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
}

// "이름" 이 이미 있으면 "이름 (1)", 그것도 있으면 "이름 (2)"... 로 비어 있는 첫 번호를 찾는다.
async function suggestUniqueName(baseName: string, excludeId?: string) {
  const taken = await prisma.partner.findMany({
    where: {
      name: { startsWith: baseName },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { name: true },
  });
  const takenSet = new Set(taken.map((p) => p.name));
  for (let i = 1; i < 1000; i++) {
    const candidate = `${baseName} (${i})`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${baseName} (${Date.now()})`;
}

// 생성/수정 폼이 저장 전에 중복 여부를 물어보는 용도. 중복이면 제안 이름을 함께 돌려줘
// 클라이언트가 "'이름 (1)'로 만들까요?" 안내를 띄울 수 있게 한다.
export async function checkPartnerName(name: string, excludeId?: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const trimmed = name.trim();
  if (!trimmed) return { duplicate: false, suggested: trimmed };

  const existing = await findDuplicateName(trimmed, excludeId);
  if (!existing) return { duplicate: false, suggested: trimmed };

  return { duplicate: true, suggested: await suggestUniqueName(trimmed, excludeId) };
}

export async function createPartner(
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return "파트너 이름을 입력하세요.";
  if (await findDuplicateName(name)) return "이미 같은 이름의 파트너가 있습니다.";

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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// 이름·공개범위·색상을 한 폼/한 업데이트로 묶는다(P5). 셋 다 Partner 한 행의
// 컬럼이라 update() 한 번이 곧 "전부 성공 또는 전부 실패"라 별도 트랜잭션이 필요 없다.
export async function updatePartnerSettings(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return "파트너 owner만 설정을 변경할 수 있습니다.";

  const name = (formData.get("name") as string | null)?.trim();
  if (!name) return "파트너 이름을 입력하세요.";
  if (await findDuplicateName(name, partnerId)) return "이미 같은 이름의 파트너가 있습니다.";

  const visibility = formData.get("visibility") === "PUBLIC" ? "PUBLIC" : "PRIVATE";

  const rawColor = (formData.get("color") as string | null)?.trim() || null;
  if (rawColor && !HEX_COLOR.test(rawColor)) return "올바른 색상 값을 선택하세요.";

  // 공개 파트너는 어차피 모두에게 보이므로 discoverable 값은 비공개일 때만 의미가 있다.
  const discoverable = visibility === "PRIVATE" && formData.get("discoverable") === "on";

  await prisma.partner.update({
    where: { id: partnerId },
    data: { name, visibility, discoverable, color: rawColor, lastActivityAt: new Date() },
  });
  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/calendar");
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

// alsoRemoveFromProjects: 파트너에서만 빼는 게 아니라 이 파트너의 프로젝트 참여자에서도
// 함께 빼낸다. 다만 어떤 프로젝트의 master인 경우는 그 프로젝트가 주인 없이 남으므로 건너뛴다.
export async function removeMember(
  partnerId: string,
  userId: string,
  alsoRemoveFromProjects = false,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { partner, isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!partner || !isOwner) throw new Error("파트너 owner만 멤버를 제외할 수 있습니다.");
  if (userId === partner.ownerId) throw new Error("owner는 제외할 수 없습니다.");

  await prisma.partnerMember.deleteMany({ where: { partnerId, userId } });

  if (alsoRemoveFromProjects) {
    const masteredIds = (
      await prisma.project.findMany({ where: { partnerId, masterId: userId }, select: { id: true } })
    ).map((p) => p.id);
    await prisma.projectParticipant.deleteMany({
      where: { userId, project: { partnerId }, projectId: { notIn: masteredIds } },
    });
  }

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/projects");
  revalidatePath("/tasks");
  revalidatePath("/");
}

// 파트너 관리자(owner) 변경. 새 owner가 멤버가 아니면 멤버로 함께 올린다.
export async function transferPartnerOwner(partnerId: string, newOwnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { partner, isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!partner) throw new Error("존재하지 않는 파트너입니다.");
  if (!isOwner && !session.user.isSuperAdmin) throw new Error("파트너 owner만 변경할 수 있습니다.");
  if (newOwnerId === partner.ownerId) return;

  const newOwner = await prisma.user.findUnique({ where: { id: newOwnerId }, select: { id: true, name: true } });
  if (!newOwner) throw new Error("존재하지 않는 사용자입니다.");

  await prisma.$transaction([
    prisma.partner.update({ where: { id: partnerId }, data: { ownerId: newOwnerId } }),
    prisma.partnerMember.upsert({
      where: { partnerId_userId: { partnerId, userId: newOwnerId } },
      update: { role: "OWNER" },
      create: { partnerId, userId: newOwnerId, role: "OWNER" },
    }),
    prisma.partnerMember.updateMany({
      where: { partnerId, userId: partner.ownerId },
      data: { role: "MEMBER" },
    }),
    prisma.notification.create({
      data: {
        userId: newOwnerId,
        type: "PARTNER_OWNER_CHANGED",
        refId: partnerId,
        message: `"${partner.name}" 파트너의 관리자로 지정되었습니다.`,
      },
    }),
  ]);

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/");
}

// '업무 참여하기'. 공개 파트너는 승인 단계 없이 바로 참여시키고, 비공개 파트너만
// 관리자 승인을 거친다(요청 행 + 알림 생성).
export async function joinPartner(partnerId: string): Promise<{ joined: boolean }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { partner, canDiscover, isMember } = await getPartnerAccess(
    partnerId,
    session.user.id,
    !!session.user.isSuperAdmin,
  );
  if (!partner || !canDiscover) throw new Error("접근할 수 없는 파트너입니다.");
  if (isMember) throw new Error("이미 참여 중인 파트너입니다.");

  if (partner.visibility === "PUBLIC") {
    await prisma.$transaction([
      prisma.partnerMember.upsert({
        where: { partnerId_userId: { partnerId, userId: session.user.id } },
        update: {},
        create: { partnerId, userId: session.user.id, role: "MEMBER" },
      }),
      // 요청 이력이 남아 있었다면 함께 정리한다.
      prisma.partnerJoinRequest.deleteMany({ where: { partnerId, userId: session.user.id } }),
      prisma.notification.create({
        data: {
          userId: partner.ownerId,
          type: "PARTNER_JOINED",
          refId: partnerId,
          message: `${session.user.name}님이 "${partner.name}" 파트너 업무에 참여했습니다.`,
        },
      }),
    ]);

    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath(`/partners/${partnerId}`);
    return { joined: true };
  }

  await prisma.$transaction([
    prisma.partnerJoinRequest.upsert({
      where: { partnerId_userId: { partnerId, userId: session.user.id } },
      // 거부됐던 요청도 다시 신청하면 대기 상태로 되돌린다.
      update: { status: "PENDING", respondedAt: null, createdAt: new Date() },
      create: { partnerId, userId: session.user.id },
    }),
    prisma.notification.create({
      data: {
        userId: partner.ownerId,
        type: "PARTNER_JOIN_REQUESTED",
        refId: partnerId,
        message: `${session.user.name}님이 "${partner.name}" 파트너 업무 참여를 신청했습니다.`,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/partners/${partnerId}`);
  return { joined: false };
}

export async function listPartnerJoinRequests(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner) return [];

  const requests = await prisma.partnerJoinRequest.findMany({
    where: { partnerId, status: "PENDING" },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return requests.map((r) => ({ userId: r.userId, userName: r.user.name, createdAt: r.createdAt }));
}

// accept=true면 멤버로 추가하고, false면 거부 이력만 남긴다. 어느 쪽이든 신청자에게 알린다.
export async function respondToPartnerJoin(partnerId: string, userId: string, accept: boolean) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { partner, isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!partner || !isOwner) throw new Error("파트너 관리자만 처리할 수 있습니다.");

  await prisma.$transaction([
    prisma.partnerJoinRequest.update({
      where: { partnerId_userId: { partnerId, userId } },
      data: { status: accept ? "ACCEPTED" : "REJECTED", respondedAt: new Date() },
    }),
    ...(accept
      ? [
          prisma.partnerMember.upsert({
            where: { partnerId_userId: { partnerId, userId } },
            update: {},
            create: { partnerId, userId, role: "MEMBER" },
          }),
        ]
      : []),
    prisma.notification.create({
      data: {
        userId,
        type: "PARTNER_INVITED",
        refId: partnerId,
        message: accept
          ? `"${partner.name}" 파트너 업무 참여가 수락되었습니다.`
          : `"${partner.name}" 파트너 업무 참여가 거부되었습니다.`,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath(`/partners/${partnerId}`);
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

// 프로젝트 보관(archiveProject)과 같이 typed confirm으로 한 번 더 확인받는다.
export async function softDeletePartner(
  partnerId: string,
  _prevState: string | undefined,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // 소프트 삭제라 총관리자가 언제든 복구할 수 있으므로 owner에게도 연다.
  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner && !session.user.isSuperAdmin) {
    return "파트너 owner 또는 총관리자만 삭제할 수 있습니다.";
  }

  if ((formData.get("confirm") as string | null) !== "보관함") return "'보관함'을 정확히 입력하세요.";

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
