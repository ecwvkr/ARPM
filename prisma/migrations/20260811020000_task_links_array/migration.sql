-- 링크 1개(link) → 여러 개(links). 기존 값은 1개짜리 배열로 옮긴다.
ALTER TABLE "Task" ADD COLUMN "links" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Task" SET "links" = ARRAY["link"] WHERE "link" IS NOT NULL;

ALTER TABLE "Task" DROP COLUMN "link";
