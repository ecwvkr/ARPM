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
  updateGoogleCalendarEvent,
  moveGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
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

// 시간 지정 여부와 시각을 폼에서 읽어 검증한다. 형식이 어긋나면 구글이 400을 주므로
// 여기서 먼저 막는다.
function readTiming(formData: FormData): { startDate: Date; endDate: Date; startTime: string | null; endTime: string | null } | string {
  const startRaw = formData.get("startDate") as string | null;
  const endRaw = formData.get("endDate") as string | null;
  if (!startRaw) return "시작일을 입력하세요.";

  const startDate = new Date(`${startRaw}T00:00:00`);
  const endDate = endRaw ? new Date(`${endRaw}T00:00:00`) : startDate;
  if (endDate < startDate) return "종료일은 시작일보다 빠를 수 없습니다.";

  const timed = formData.get("timed") === "on";
  if (!timed) return { startDate, endDate, startTime: null, endTime: null };

  const startTime = (formData.get("startTime") as string | null)?.trim();
  const endTime = (formData.get("endTime") as string | null)?.trim();
  const valid = /^\d{2}:\d{2}$/;
  if (!startTime || !valid.test(startTime)) return "시작 시간을 입력하세요.";
  if (!endTime || !valid.test(endTime)) return "종료 시간을 입력하세요.";
  // 같은 날이면 끝나는 시각이 시작보다 빠를 수 없다(여러 날에 걸치면 상관없다).
  if (endDate.getTime() === startDate.getTime() && endTime <= startTime) {
    return "종료 시간은 시작 시간보다 늦어야 합니다.";
  }

  return { startDate, endDate, startTime, endTime };
}

export async function addCalendarEvent(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const calendarId = (formData.get("calendarId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();

  if (!calendarId) return "캘린더를 선택하세요.";
  if (!title) return "일정 제목을 입력하세요.";

  const timing = readTiming(formData);
  if (typeof timing === "string") return timing;

  try {
    await createGoogleCalendarEvent(calendarId, { title, ...timing });
  } catch (e) {
    return calendarErrorMessage(e, "일정을 추가할 수 없습니다.");
  }

  revalidatePath("/calendar");
}

// 스코프가 모자라거나 토큰이 만료되면 구글이 401/403/404를 준다 — 재연결이 필요하다는 걸 알려준다.
function calendarErrorMessage(e: unknown, fallback: string) {
  const message = e instanceof Error ? e.message : fallback;
  return /401|403|insufficient|permission|credential/i.test(message)
    ? "이 캘린더를 수정할 권한이 없습니다. 설정 > 구글 연동에서 계정을 다시 연결해 주세요."
    : message;
}

export async function updateCalendarEvent(_prevState: string | undefined, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const calendarId = (formData.get("calendarId") as string | null)?.trim();
  const eventId = (formData.get("eventId") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();

  if (!calendarId || !eventId) return "잘못된 요청입니다.";
  if (!title) return "일정 제목을 입력하세요.";

  const timing = readTiming(formData);
  if (typeof timing === "string") return timing;

  try {
    await updateGoogleCalendarEvent(calendarId, eventId, { title, ...timing });
  } catch (e) {
    return calendarErrorMessage(e, "일정을 수정할 수 없습니다.");
  }

  revalidatePath("/calendar");
}

// 월간뷰 드래그 이동 전용 — 제목은 그대로 두고 날짜만 옮긴다. 시간 지정 일정이면
// 원래 시각(startTime/endTime)을 그대로 다시 넘겨 시각이 유지되게 한다.
export async function moveCalendarEvent(
  calendarId: string,
  eventId: string,
  startIso: string,
  endIso: string,
  startTime?: string | null,
  endTime?: string | null,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await moveGoogleCalendarEvent(calendarId, eventId, {
    startDate: new Date(`${startIso}T00:00:00`),
    endDate: new Date(`${endIso}T00:00:00`),
    startTime,
    endTime,
  });
  revalidatePath("/calendar");
}

export async function deleteCalendarEvent(calendarId: string, eventId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await deleteGoogleCalendarEvent(calendarId, eventId);
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
