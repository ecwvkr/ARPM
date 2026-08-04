export const PRIORITY_LABEL: Record<string, string> = {
  URGENT: "긴급",
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};

export const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#ef4444",
  HIGH: "#f97316",
  NORMAL: "#d4d4d8",
  LOW: "#e4e4e7",
};

export const STATUS_LABEL: Record<string, string> = {
  TODO: "진행전",
  IN_PROGRESS: "진행중",
  DONE: "종료",
};

export function toPriorityBadges(priorities: { userId: string; level: string; user: { name: string } }[]) {
  return priorities.map((p) => ({ userId: p.userId, userName: p.user.name, level: p.level }));
}

export function isOverdue(dueDate: Date | null, status: string) {
  return !!dueDate && dueDate < new Date() && status !== "DONE";
}
