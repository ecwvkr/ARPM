"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken, getValidAccessToken, revokeGoogleToken } from "@/lib/google/client";
import { redirect } from "next/navigation";
import {
  listCalendars,
  syncProjectToGoogle,
  createGoogleCalendarEvent,
  type GoogleCalendarListItem,
} from "@/lib/google/calendar";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) throw new Error("총관리자만 접근할 수 있습니다.");
  return session;
}

// 캘린더 뷰의 '일정 추가'에서 고를 수 있는 캘린더 목록. 관리자가 표시 대상으로 고른
// 캘린더만 후보이므로 총관리자 전용인 listAvailableCalendars와 달리 모든 로그인 사용자가 쓴다.
export async function listWritableCalendars(): Promise<
  { calendars: { id: string; summary: string }[] } | { error: "not_connected" | "no_selection" | "reconnect_needed" }
> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const conn = await prisma.googleConnection.findFirst();
  if (!conn) return { error: "not_connected" };
  if (conn.enabledCalendarIds.length === 0) return { error: "no_selection" };
  // 일정 쓰기에는 calendar.events 스코프가 필요하다 — 그 전에 연결된 계정은 다시 연결해야 한다.
  if (!conn.scope.includes("calendar.events")) return { error: "reconnect_needed" };

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken();
  } catch {
    return { error: "reconnect_needed" };
  }
  if (!accessToken) return { error: "not_connected" };

  try {
    const all = await listCalendars(accessToken);
    return {
      calendars: all
        .filter((c) => conn.enabledCalendarIds.includes(c.id))
        .map((c) => ({ id: c.id, summary: c.summary })),
    };
  } catch {
    return { error: "reconnect_needed" };
  }
}

export async function addCalendarEvent(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const calendarId = (formData.get("calendarId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const startRaw = formData.get("startDate") as string | null;
  const endRaw = formData.get("endDate") as string | null;

  if (!calendarId) return "캘린더를 선택하세요.";
  if (!title) return "일정 제목을 입력하세요.";
  if (!startRaw) return "시작일을 입력하세요.";

  const startDate = new Date(`${startRaw}T00:00:00`);
  const endDate = endRaw ? new Date(`${endRaw}T00:00:00`) : startDate;
  if (endDate < startDate) return "종료일은 시작일보다 빠를 수 없습니다.";

  try {
    await createGoogleCalendarEvent(calendarId, { title, startDate, endDate });
  } catch (e) {
    // 스코프가 모자라면 구글이 403/404를 준다 — 재연결이 필요하다는 걸 알려준다.
    const message = e instanceof Error ? e.message : "일정을 추가할 수 없습니다.";
    return /401|403|404|insufficient|permission|credential/i.test(message)
      ? "이 캘린더에 쓸 권한이 없습니다. 설정 > 구글 연동에서 계정을 다시 연결해 주세요."
      : message;
  }

  revalidatePath("/calendar");
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

// 드리프트 복구용 수동 재동기화. 평소엔 revalidateProjectViews가 바뀐 프로젝트만
// 즉시 내보내지만(G4), 구글 쪽 실패가 누적됐거나 DB를 직접 건드린 경우를 대비해
// "공개+마감일 있는 프로젝트 전부"와 "예전에 내보낸 적 있는 프로젝트 전부"를 다시 맞춘다.
// 관리자가 명시적으로 누른 조작이라 결과를 바로 보여줘야 하므로 after()로 미루지 않는다.
export async function resyncAllProjects(): Promise<{ synced: number; failed: number }> {
  await requireSuperAdmin();

  const targets = await prisma.project.findMany({
    where: {
      OR: [
        { visibility: "PUBLIC", dueDate: { not: null }, deletedAt: null },
        { googleEventId: { not: null } },
      ],
    },
    select: { id: true },
  });

  const results = await Promise.allSettled(targets.map((p) => syncProjectToGoogle(p.id)));
  const failed = results.filter((r) => r.status === "rejected").length;
  revalidatePath("/calendar");
  return { synced: results.length - failed, failed };
}
