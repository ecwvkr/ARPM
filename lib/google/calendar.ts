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
  // 이 일정을 이미 업무로 전환한 프로젝트가 있으면 채워진다(G5) — 있으면 원본 칩에
  // "전환됨" 표시를 하고 재전환을 막는다.
  convertedProjectId: string | null;
  convertedPartnerId: string | null;
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
    convertedProjectId: null,
    convertedPartnerId: null,
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
  if (events.length === 0) return events;

  // 이미 업무로 전환된 일정이 있으면 표시해 준다(G5) — 보관된(deletedAt) 전환 결과는
  // 무시해, 전환한 업무를 보관하면 원본 일정을 다시 전환할 수 있게 한다.
  const converted = await prisma.project.findMany({
    where: { sourceGoogleEventId: { in: events.map((e) => e.id) }, deletedAt: null },
    select: { id: true, partnerId: true, sourceGoogleEventId: true },
  });
  const convertedByEventId = new Map(converted.map((p) => [p.sourceGoogleEventId!, p]));
  for (const event of events) {
    const match = convertedByEventId.get(event.id);
    if (match) {
      event.convertedProjectId = match.id;
      event.convertedPartnerId = match.partnerId;
    }
  }
  return events;
}

function toDateOnlyString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function createEvent(accessToken: string, calendarId: string, body: object): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`이벤트 생성 실패: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

// 실패 시 false만 돌려준다 — 외부에서 이벤트가 지워진 경우(404) 등 호출부가 새로
// 만들지 판단하도록, 여기서 예외를 던지지 않는다.
async function updateEvent(accessToken: string, calendarId: string, eventId: string, body: object): Promise<boolean> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return res.ok;
}

async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  // 이미 지워졌거나(410) 네트워크 오류여도 로컬 정리(googleEventId 비우기)는 계속 진행한다.
  await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch(() => {});
}

// 다른 사람이 직접 발급받은 이벤트 id로 구글에서 지운다. hardDeleteProject처럼 DB 행이
// 이미 사라져 syncProjectToGoogle로 다시 조회할 수 없는 경우에 쓴다.
export async function deleteGoogleEventsById(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;
  const conn = await prisma.googleConnection.findFirst();
  if (!conn || !conn.syncCalendarId) return;

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken();
  } catch (e) {
    if (e instanceof GoogleAuthError) return;
    throw e;
  }
  if (!accessToken) return;

  await Promise.allSettled(eventIds.map((id) => deleteEvent(accessToken!, conn.syncCalendarId!, id)));
}

// 프로젝트 하나를 구글 보조 캘린더("AR_PM 업무")와 맞춘다. 공개 + 마감일 있음 + 보관 안 됨
// 조건을 만족하면 만들거나 갱신하고, 아니면(비공개 전환·보관·마감일 삭제) 이미 나가 있던
// 이벤트를 지운다. 연결이 없거나 구글 호출이 실패해도 조용히 넘어간다 — 구글 쪽 문제가
// 웹앱 저장 자체를 막으면 안 된다(호출부에서 이미 응답 이후로 분리했다).
export async function syncProjectToGoogle(projectId: string): Promise<void> {
  const conn = await prisma.googleConnection.findFirst();
  if (!conn || !conn.syncCalendarId) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      title: true,
      dueDate: true,
      startDate: true,
      visibility: true,
      deletedAt: true,
      googleEventId: true,
    },
  });
  if (!project) return;

  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken();
  } catch (e) {
    if (e instanceof GoogleAuthError) return;
    throw e;
  }
  if (!accessToken) return;

  const eligible = project.visibility === "PUBLIC" && project.dueDate !== null && project.deletedAt === null;

  if (!eligible) {
    if (project.googleEventId) {
      await deleteEvent(accessToken, conn.syncCalendarId, project.googleEventId);
      await prisma.project.update({ where: { id: project.id }, data: { googleEventId: null } });
    }
    return;
  }

  // 구글 종일 일정의 종료일은 배타적이라 실제 마지막 날(dueDate)의 다음 날을 넣는다.
  const endExclusive = new Date(project.dueDate!);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const body = {
    summary: project.title,
    start: { date: toDateOnlyString(project.startDate ?? project.dueDate!) },
    end: { date: toDateOnlyString(endExclusive) },
  };

  if (project.googleEventId) {
    const updated = await updateEvent(accessToken, conn.syncCalendarId, project.googleEventId, body);
    if (updated) return;
    // 외부에서 이벤트가 지워졌거나 한 경우 — 새로 만든다.
  }

  const newEventId = await createEvent(accessToken, conn.syncCalendarId, body);
  await prisma.project.update({ where: { id: project.id }, data: { googleEventId: newEventId } });
}
