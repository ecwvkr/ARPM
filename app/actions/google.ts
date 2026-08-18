"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken, getValidAccessToken, revokeGoogleToken } from "@/lib/google/client";
import { listCalendars, type GoogleCalendarListItem } from "@/lib/google/calendar";

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
  revalidatePath("/calendar");
}

export async function listAvailableCalendars(): Promise<
  | { calendars: GoogleCalendarListItem[]; enabledCalendarIds: string[] }
  | { error: "not_connected" | "reconnect_needed" }
> {
  await requireSuperAdmin();

  const conn = await prisma.googleConnection.findFirst();
  if (!conn) return { error: "not_connected" };

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    return { error: "reconnect_needed" };
  }
  if (!accessToken) return { error: "not_connected" };

  const all = await listCalendars(accessToken);
  // 앱이 내부적으로 쓰는 동기화 캘린더는 선택 대상에서 뺀다 — 고르면 웹앱 업무가
  // 그대로 되읽혀 프로젝트 칩과 중복 표시된다.
  const calendars = all.filter((c) => c.id !== conn.syncCalendarId);
  return { calendars, enabledCalendarIds: conn.enabledCalendarIds };
}

export async function updateEnabledCalendarSelection(calendarIds: string[]) {
  await requireSuperAdmin();

  const conn = await prisma.googleConnection.findFirst();
  if (!conn) throw new Error("연결된 구글 계정이 없습니다.");

  await prisma.googleConnection.update({
    where: { id: conn.id },
    data: { enabledCalendarIds: calendarIds },
  });
  revalidatePath("/settings/google");
  revalidatePath("/calendar");
}
