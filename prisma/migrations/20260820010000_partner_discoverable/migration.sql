-- 비공개 파트너를 미참여자 목록에도 노출할지. true면 카드는 보이되 내부 프로젝트는
-- 참여 승인 후에만 볼 수 있다. 기존 비공개 파트너는 지금처럼 숨김이 기본이라 false.
ALTER TABLE "Partner" ADD COLUMN "discoverable" BOOLEAN NOT NULL DEFAULT false;
