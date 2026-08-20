export const PRIORITY_LABEL: Record<string, string> = {
  URGENT: "긴급",
  NORMAL: "보통",
  HOLD: "보류",
};

export const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#ef4444",
  NORMAL: "#22c55e",
  HOLD: "transparent",
};

export const STATUS_LABEL: Record<string, string> = {
  TODO: "진행전",
  IN_PROGRESS: "진행중",
  DONE: "완료",
};

// 대시보드 프로젝트 목록의 기본 노출 순서: 진행중 -> 진행전 -> 완료
export const STATUS_ORDER: Record<string, number> = {
  IN_PROGRESS: 0,
  TODO: 1,
  DONE: 2,
};

// dueDate는 <input type="date">에서 해당 날짜의 UTC 자정으로 저장된다
// (예: "2026-08-07" -> 2026-08-07T00:00:00Z). 이는 한국시간 기준 그 날짜를
// 의미하므로, "마감을 넘겼다"는 판정은 서버 타임존과 무관하게 한국시간 기준
// 그 날의 23:59:59.999를 기준으로 계산한다.
export const KST_DUE_DAY_END_OFFSET_MS = 53_999_999;

export function isOverdue(dueDate: Date | null, status: string) {
  if (!dueDate || status === "DONE") return false;
  return dueDate.getTime() + KST_DUE_DAY_END_OFFSET_MS < Date.now();
}

// 내가 참여(마스터 포함) 중인 프로젝트에 한해, 마지막으로 읽은 시각 이후 코멘트가 달렸거나
// 내용이 수정됐으면 "미확인"으로 본다. 관여하지 않는 프로젝트는 항상 false.
export function isProjectUnread(
  project: {
    masterId: string;
    updatedAt: Date;
    participants: { userId: string }[];
    reads: { lastReadAt: Date }[];
    comments: { createdAt: Date }[];
  },
  userId: string,
): boolean {
  const isInvolved = project.masterId === userId || project.participants.some((p) => p.userId === userId);
  if (!isInvolved) return false;

  const lastRead = project.reads[0]?.lastReadAt;
  if (!lastRead) return true;

  const latestCommentAt = project.comments[0]?.createdAt;
  const latestActivity =
    latestCommentAt && latestCommentAt > project.updatedAt ? latestCommentAt : project.updatedAt;
  return lastRead < latestActivity;
}

// 목록 화면의 카드에 '참여하기'를 띄울지. 상세 화면의 canJoin(lib/projects.ts)과 같은 규칙을
// 목록이 이미 들고 있는 데이터만으로 판정한다 — 카드마다 getProjectAccess를 부르지 않기 위해서다.
// 비공개 프로젝트는 애초에 미참여자 목록에 뜨지 않으므로 여기서는 나타나지 않는다.
export function canJoinProject(
  project: {
    masterId: string;
    completedAt: Date | null;
    participants: { userId: string }[];
  },
  userId: string,
  isPartnerMember: boolean,
): boolean {
  if (!isPartnerMember) return false;
  if (project.completedAt !== null) return false;
  if (project.masterId === userId) return false;
  return !project.participants.some((p) => p.userId === userId);
}

export type ParticipantChipData = {
  userId: string;
  userName: string;
  level: string;
  isMaster: boolean;
};

// 참여자 이름칩용 데이터: 우선순위가 없으면 기본값 '보류'. master가 아직 참여자로
// 기록되지 않은 과거 데이터도 항상 첫 칩으로 노출한다.
export function buildParticipantChips(project: {
  masterId: string;
  master: { name: string };
  participants: { userId: string; user: { name: string } }[];
  priorities: { userId: string; level: string }[];
}): ParticipantChipData[] {
  const priorityByUser = new Map(project.priorities.map((p) => [p.userId, p.level]));
  const chips = project.participants.map((p) => ({
    userId: p.userId,
    userName: p.user.name,
    level: priorityByUser.get(p.userId) ?? "HOLD",
    isMaster: p.userId === project.masterId,
  }));
  if (!chips.some((c) => c.userId === project.masterId)) {
    chips.unshift({
      userId: project.masterId,
      userName: project.master.name,
      level: priorityByUser.get(project.masterId) ?? "HOLD",
      isMaster: true,
    });
  }
  return chips;
}
