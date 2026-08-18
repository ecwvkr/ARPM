import { prisma } from "@/lib/prisma";
import { getValidAccessToken, GoogleAuthError } from "./client";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// calendar.app.created 범위는 "앱이 만든 캘린더"에만 쓸 수 있다 — 기존 캘린더에는 못 쓴다.
// 그래서 연결 시점에 이 보조 캘린더를 앱이 직접 만들고, 웹앱 업무는 항상 여기로만 내보낸다.
export async function createSyncCalendar(accessToken: string): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: "AR_PM 업무",
      description: "AR_PM 웹앱에서 등록한 업무 일정입니다. 이 캘린더의 일정은 웹앱에서 관리되며, 여기서 직접 수정한 내용은 반영되지 않습니다.",
    }),
  });
  if (!res.ok) throw new Error(`동기화 캘린더 생성 실패: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  backgroundColor: string;
  accessRole: string;
};

// calendarList는 이 계정이 접근 가능한 캘린더 전부를 돌려준다 — 본인 소유든, 남이
// 공유해서 추가된 것이든, 구독한 공개 캘린더든 구분 없이 전부 포함된다.
export async function listCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`캘린더 목록 조회 실패: ${await res.text()}`);
  const data = await res.json();
  return (data.items ?? []).map((c: { id: string; summary?: string; backgroundColor?: string; accessRole: string }) => ({
    id: c.id,
    summary: c.summary ?? c.id,
    backgroundColor: c.backgroundColor ?? "#6b7280",
    accessRole: c.accessRole,
  }));
}

export type NormalizedGoogleEvent = {
  id: string;
  calendarId: string;
  calendarSummary: string;
  calendarColor: string;
  title: string;
  startDate: Date; // 로컬 자정 기준 시작일
  endDate: Date; // 로컬 자정 기준 종료일(포함, exclusive 아님)
  allDay: boolean;
};

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type RawGoogleEvent = {
  id: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

async function listEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<RawGoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true", // 반복 일정을 개별 인스턴스로 펼쳐서 받는다.
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`일정 조회 실패(${calendarId}): ${await res.text()}`);
  const data = await res.json();
  return data.items ?? [];
}

function normalizeEvent(item: RawGoogleEvent, calendarId: string, meta: GoogleCalendarListItem | undefined): NormalizedGoogleEvent | null {
  if (!item.start || !item.end) return null;
  const allDay = !!item.start.date;

  let startDate: Date;
  let endDate: Date;
  if (allDay && item.start.date && item.end.date) {
    startDate = new Date(`${item.start.date}T00:00:00`);
    // 구글 종일 일정의 종료일은 배타적(다음날 자정)이라 하루를 빼야 실제 마지막 날이 된다.
    const endExclusive = new Date(`${item.end.date}T00:00:00`);
    endDate = new Date(endExclusive.getTime() - 86_400_000);
  } else if (item.start.dateTime && item.end.dateTime) {
    startDate = dateOnly(new Date(item.start.dateTime));
    endDate = dateOnly(new Date(item.end.dateTime));
  } else {
    return null;
  }

  return {
    id: item.id,
    calendarId,
    calendarSummary: meta?.summary ?? "구글 캘린더",
    calendarColor: meta?.backgroundColor ?? "#6b7280",
    title: item.summary ?? "(제목 없음)",
    startDate,
    endDate,
    allDay,
  };
}

// 캘린더 뷰에 표시할 구글 일정을 실시간으로 가져온다. 연결이 없거나, 선택된 캘린더가
// 없거나, 구글 호출이 실패해도(토큰 만료·네트워크 오류) 예외를 던지지 않고 빈 배열을
// 돌려준다 — 구글 쪽 장애가 웹앱 업무 일정 표시까지 막으면 안 되기 때문이다.
export async function getSyncedGoogleEvents(rangeStart: Date, rangeEnd: Date): Promise<NormalizedGoogleEvent[]> {
  const conn = await prisma.googleConnection.findFirst();
  if (!conn || conn.enabledCalendarIds.length === 0) return [];

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken();
  } catch (e) {
    if (e instanceof GoogleAuthError) return [];
    throw e;
  }
  if (!accessToken) return [];

  const timeMinISO = rangeStart.toISOString();
  const timeMaxISO = rangeEnd.toISOString();

  const [calendarsResult, ...eventResults] = await Promise.allSettled([
    listCalendars(accessToken),
    ...conn.enabledCalendarIds.map((id) => listEventsForCalendar(accessToken!, id, timeMinISO, timeMaxISO)),
  ]);
  const calendarById = new Map(
    calendarsResult.status === "fulfilled" ? calendarsResult.value.map((c) => [c.id, c]) : [],
  );

  const events: NormalizedGoogleEvent[] = [];
  conn.enabledCalendarIds.forEach((calendarId, i) => {
    const result = eventResults[i];
    if (result.status !== "fulfilled") return;
    const meta = calendarById.get(calendarId);
    for (const item of result.value) {
      if (item.status === "cancelled") continue;
      const normalized = normalizeEvent(item, calendarId, meta);
      if (normalized) events.push(normalized);
    }
  });
  return events;
}
