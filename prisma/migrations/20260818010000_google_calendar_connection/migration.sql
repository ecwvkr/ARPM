-- G1: 구글 캘린더 연동 기반.
-- Project: startDate는 구글 장기 일정을 업무로 전환할 때만 채워진다(생성/수정 UI 미노출).
-- googleEventId는 이 업무를 구글로 내보낸 이벤트, sourceGoogleEventId는 전환 원본 이벤트.
ALTER TABLE "Project" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Project" ADD COLUMN "sourceGoogleEventId" TEXT;

CREATE INDEX "Project_sourceGoogleEventId_idx" ON "Project"("sourceGoogleEventId");

-- GoogleConnection: 회사 공용 계정 1개. AppSetting과 동일하게 단일 행만 유지한다.
CREATE TABLE "GoogleConnection" (
    "id" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "syncCalendarId" TEXT,
    "connectedById" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleConnection_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GoogleConnection" ADD CONSTRAINT "GoogleConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
