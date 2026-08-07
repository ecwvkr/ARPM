-- Drop Task.tags (기능 삭제)
ALTER TABLE "Task" DROP COLUMN "tags";

-- Drop TaskLink (관련 링크 기능 삭제)
ALTER TABLE "TaskLink" DROP CONSTRAINT "TaskLink_taskId_fkey";
ALTER TABLE "TaskLink" DROP CONSTRAINT "TaskLink_authorId_fkey";
DROP TABLE "TaskLink";

-- Drop Project.goalDate (미사용 필드 삭제)
ALTER TABLE "Project" DROP COLUMN "goalDate";

-- Priority enum: URGENT/HIGH/NORMAL/LOW -> URGENT/NORMAL/HOLD
ALTER TYPE "Priority" RENAME TO "Priority_old";
CREATE TYPE "Priority" AS ENUM ('URGENT', 'NORMAL', 'HOLD');

ALTER TABLE "TaskPriority" ALTER COLUMN "level" DROP DEFAULT;
ALTER TABLE "TaskPriority" ALTER COLUMN "level" TYPE "Priority" USING (
  CASE "level"::text
    WHEN 'HIGH' THEN 'URGENT'
    WHEN 'LOW' THEN 'HOLD'
    ELSE "level"::text
  END
)::"Priority";
ALTER TABLE "TaskPriority" ALTER COLUMN "level" SET DEFAULT 'NORMAL';

DROP TYPE "Priority_old";
