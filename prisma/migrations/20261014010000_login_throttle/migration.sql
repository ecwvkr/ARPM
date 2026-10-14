-- 로그인 시도 제한(lib/login-throttle.ts). 연속 실패 횟수와 잠금 해제 시각.
-- 기존 테이블에 컬럼만 더한다 — 배포 전 코드는 이 컬럼을 모르고 그대로 동작한다.

ALTER TABLE "User" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "loginLockedUntil" TIMESTAMP(3);
