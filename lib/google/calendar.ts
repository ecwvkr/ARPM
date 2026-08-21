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
  // 시간 지정 일정의 실제 시각. 종일 일정은 null이다. 표시는 브라우저 시간대로 하면
  // 되므로 인스턴트만 넘긴다.
  startAt: Date | null;
  endAt: Date | null;
  // 이 일정을 이미 업무로 전환한 프로젝트가 있으면 채워진다(G5) — 있으면 원본 칩에
  // "전환됨" 표시를 하고 재전환을 막는다.
  convertedProjectId: string | null;
  convertedPartnerId: string | null;
};

function dateOnly(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// 이 앱은 한국에서만 쓰이지만 서버는 UTC에서 돈다. 시간 지정 일정의 "무슨 날인가"를
// 서버 시간대로 계산하면 새벽 일정이 하루 앞당겨진다(01:00 KST = 전날 16:00 UTC).
// 항상 한국 벽시계 기준으로 연·월·일을 뽑고, 서버 시간대와 무관하게 같은 값이 나오도록
// Date.UTC로 만든다.
export const APP_TIME_ZONE = "Asia/Seoul";

const ZONED_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function zonedDateOnly(d: Date) {
  const [year, month, day] = ZONED_PARTS.format(d).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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
  let startAt: Date | null = null;
  let endAt: Date | null = null;
  if (allDay && item.start.date && item.end.date) {
    startDate = new Date(`${item.start.date}T00:00:00`);
    // 구글 종일 일정의 종료일은 배타적(다음날 자정)이라 하루를 빼야 실제 마지막 날이 된다.
    const endExclusive = new Date(`${item.end.date}T00:00:00`);
    endDate = new Date(endExclusive.getTime() - 86_400_000);
  } else if (item.start.dateTime && item.end.dateTime) {
    startAt = new Date(item.start.dateTime);
    endAt = new Date(item.end.dateTime);
    startDate = zonedDateOnly(startAt);
    endDate = zonedDateOnly(endAt);
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
    startAt,
    endAt,
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

// 캘린더 뷰의 '일정 추가' — 관리자가 표시 대상으로 고른 캘린더 중 하나에 종일 일정을 만든다.
// 종일 일정의 end.date는 배타적이라 마지막 날 +1일로 넣는다(조회 쪽 normalizeEvent와 짝).
export async function createGoogleCalendarEvent(
  calendarId: string,
  { title, ...timing }: EventTiming & { title: string },
): Promise<string> {
  const conn = await prisma.googleConnection.findFirst();
  if (!conn) throw new Error("연결된 구글 계정이 없습니다.");
  if (!conn.enabledCalendarIds.includes(calendarId) && calendarId !== conn.syncCalendarId) {
    throw new Error("표시 대상으로 선택된 캘린더에만 추가할 수 있습니다.");
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("연결된 구글 계정이 없습니다.");

  return createEvent(accessToken, calendarId, { summary: title, ...rangeOf(timing) });
}

// 캘린더 뷰에서 손댈 수 있는 대상인지 확인하고 액세스 토큰을 돌려준다.
// 앱이 프로젝트를 내보내는 동기화 캘린더는 여기서 제외한다 — 직접 고치면 다음 동기화 때
// 프로젝트 내용으로 되돌아가 사용자 입장에서는 수정이 사라진 것처럼 보이기 때문이다.
async function requireEditableCalendar(calendarId: string): Promise<string> {
  const conn = await prisma.googleConnection.findFirst();
  if (!conn) throw new Error("연결된 구글 계정이 없습니다.");
  if (calendarId === conn.syncCalendarId) {
    throw new Error("웹앱 업무 캘린더의 일정은 프로젝트에서 수정해 주세요.");
  }
  if (!conn.enabledCalendarIds.includes(calendarId)) {
    throw new Error("표시 대상으로 선택된 캘린더의 일정만 수정할 수 있습니다.");
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("연결된 구글 계정이 없습니다.");
  return accessToken;
}

// 종일 일정의 end.date는 배타적이라 마지막 날 +1일로 넣는다(조회 쪽 normalizeEvent와 짝).
function allDayRange(startDate: Date, endDate: Date) {
  const endExclusive = new Date(endDate);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { start: { date: toDateOnlyString(startDate) }, end: { date: toDateOnlyString(endExclusive) } };
}

// 시간 지정 일정. 서버 시간대에 휘둘리지 않도록 UTC로 환산하지 않고, 벽시계 문자열
// ("2026-08-21T14:00:00")과 시간대 이름을 그대로 구글에 넘긴다.
function timedRange(startDate: Date, endDate: Date, startTime: string, endTime: string) {
  return {
    start: { dateTime: `${toDateOnlyString(startDate)}T${startTime}:00`, timeZone: APP_TIME_ZONE },
    end: { dateTime: `${toDateOnlyString(endDate)}T${endTime}:00`, timeZone: APP_TIME_ZONE },
  };
}

export type EventTiming = {
  startDate: Date;
  endDate: Date;
  // 둘 다 있으면 시간 지정 일정("HH:MM"), 없으면 종일 일정.
  startTime?: string | null;
  endTime?: string | null;
};

function rangeOf({ startDate, endDate, startTime, endTime }: EventTiming) {
  return startTime && endTime
    ? timedRange(startDate, endDate, startTime, endTime)
    : allDayRange(startDate, endDate);
}

export async function updateGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  { title, ...timing }: EventTiming & { title: string },
): Promise<void> {
  const accessToken = await requireEditableCalendar(calendarId);
  const ok = await updateEvent(accessToken, calendarId, eventId, {
    summary: title,
    ...rangeOf(timing),
  });
  if (!ok) throw new Error("일정을 수정할 수 없습니다. 구글에서 삭제되었거나 권한이 없습니다.");
}

// 드래그로 옮길 때는 제목을 건드리지 않는다 — 날짜만 바꾸고, 시간 지정 일정이면
// 시각은 그대로 둔다(오후 2시 회의를 옮겨도 오후 2시여야 한다).
export async function moveGoogleCalendarEvent(
  calendarId: string,
  eventId: string,
  timing: EventTiming,
): Promise<void> {
  const accessToken = await requireEditableCalendar(calendarId);
  const ok = await updateEvent(accessToken, calendarId, eventId, rangeOf(timing));
  if (!ok) throw new Error("일정을 옮길 수 없습니다. 구글에서 삭제되었거나 권한이 없습니다.");
}

export async function deleteGoogleCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  const accessToken = await requireEditableCalendar(calendarId);
  await deleteEvent(accessToken, calendarId, eventId);
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
