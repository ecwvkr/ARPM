-- 화면별로 마지막에 고른 보기 설정. 계정에 붙으므로 기기를 옮겨도 따라간다.

CREATE TABLE "ViewPreference" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ViewPreference_pkey" PRIMARY KEY ("userId","key")
);

ALTER TABLE "ViewPreference" ADD CONSTRAINT "ViewPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 새로 만드는 테이블은 RLS가 꺼진 채로 생성된다(20260822010000_enable_rls 참고).
ALTER TABLE "ViewPreference" ENABLE ROW LEVEL SECURITY;
