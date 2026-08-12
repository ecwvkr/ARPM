"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPartnerAccess } from "@/lib/permissions";

export async function listPartnerAuditLog(partnerId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { isOwner } = await getPartnerAccess(partnerId, session.user.id, !!session.user.isSuperAdmin);
  if (!isOwner && !session.user.isSuperAdmin) return [];

  const logs = await prisma.auditLog.findMany({
    where: { partnerId },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return logs.map((l) => ({
    id: l.id,
    actorName: l.actor.name,
    message: l.message,
    createdAt: l.createdAt,
  }));
}
