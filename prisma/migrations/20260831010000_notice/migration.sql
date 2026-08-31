-- 공지사항. partnerId가 없으면 전체공지(대시보드), 있으면 그 파트너 전용 공지다.

CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notice_partnerId_createdAt_idx" ON "Notice"("partnerId", "createdAt");
CREATE INDEX "Notice_createdById_idx" ON "Notice"("createdById");
CREATE INDEX "Notice_updatedById_idx" ON "Notice"("updatedById");

ALTER TABLE "Notice" ADD CONSTRAINT "Notice_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 새로 만드는 테이블은 RLS가 꺼진 채로 생성된다(20260822010000_enable_rls 참고).
-- 정책 없이 켜 두면 기본이 "전부 거부"라, 앱(rolbypassrls인 postgres 역할) 외에는 닫힌다.
ALTER TABLE "Notice" ENABLE ROW LEVEL SECURITY;
