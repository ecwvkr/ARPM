-- D1: 최상위 단위(기존 Project)를 Partner로, 하위 단위(기존 Task)를 Project로 리네임.
-- D2: 파트너 숨김을 개인별 설정으로 전환(PartnerHide), 전역 isArchived 제거.
-- D3: 프로젝트(구 Task)에도 소프트 삭제(deletedAt) 추가.
-- D4: 참여자 역할(MEMBER/VIEWER) 추가.

-- 1) 기존 Project(최상위) -> Partner
ALTER TABLE "Project" RENAME TO "Partner";
ALTER TABLE "Partner" DROP COLUMN "isArchived";

-- 2) ProjectMember -> PartnerMember
ALTER TABLE "ProjectMember" RENAME TO "PartnerMember";
ALTER TABLE "PartnerMember" RENAME COLUMN "projectId" TO "partnerId";

-- 3) 기존 Task(하위) -> Project. projectId(구 최상위 FK) -> partnerId. deletedAt 추가.
ALTER TABLE "Task" RENAME COLUMN "projectId" TO "partnerId";
ALTER TABLE "Task" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Task" RENAME TO "Project";

-- 4) TaskParticipant -> ProjectParticipant. role(VIEWER/MEMBER) 추가.
CREATE TYPE "ParticipantRole" AS ENUM ('MEMBER', 'VIEWER');
ALTER TABLE "TaskParticipant" RENAME COLUMN "taskId" TO "projectId";
ALTER TABLE "TaskParticipant" ADD COLUMN "role" "ParticipantRole" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "TaskParticipant" RENAME TO "ProjectParticipant";

-- 5) TaskPriority -> ProjectPriority
ALTER TABLE "TaskPriority" RENAME COLUMN "taskId" TO "projectId";
ALTER TABLE "TaskPriority" RENAME TO "ProjectPriority";

-- 6) TaskRead -> ProjectRead
ALTER TABLE "TaskRead" RENAME COLUMN "taskId" TO "projectId";
ALTER TABLE "TaskRead" RENAME TO "ProjectRead";

-- 7) Comment.taskId -> projectId
ALTER TABLE "Comment" RENAME COLUMN "taskId" TO "projectId";

-- 8) AuditLog.projectId -> partnerId
ALTER TABLE "AuditLog" RENAME COLUMN "projectId" TO "partnerId";

-- 9) enum 리네임
ALTER TYPE "ProjectRole" RENAME TO "PartnerRole";
ALTER TYPE "TaskStatus" RENAME TO "ProjectStatus";

-- 10) PartnerHide (D2 신규): 파트너 숨김을 계정별로 관리
CREATE TABLE "PartnerHide" (
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "hiddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerHide_pkey" PRIMARY KEY ("userId", "partnerId")
);

ALTER TABLE "PartnerHide" ADD CONSTRAINT "PartnerHide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerHide" ADD CONSTRAINT "PartnerHide_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "PartnerHide_partnerId_idx" ON "PartnerHide"("partnerId");
