"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken, revokeGoogleToken } from "@/lib/google/client";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) throw new Error("총관리자만 접근할 수 있습니다.");
  return session;
}

export async function getGoogleConnectionStatus() {
  await requireSuperAdmin();

  const conn = await prisma.googleConnection.findFirst({
    select: { googleEmail: true, connectedAt: true, connectedBy: { select: { name: true } } },
  });
  if (!conn) return null;
  return { googleEmail: conn.googleEmail, connectedAt: conn.connectedAt, connectedByName: conn.connectedBy.name };
}

export async function disconnectGoogleAccount() {
  await requireSuperAdmin();

  const conn = await prisma.googleConnection.findFirst();
  if (!conn) return;

  await revokeGoogleToken(decryptToken(conn.refreshToken));
  await prisma.googleConnection.delete({ where: { id: conn.id } });
  revalidatePath("/settings/google");
}
