-- public 스키마 전 테이블에 RLS를 켠다. 정책은 일부러 하나도 만들지 않는다 —
-- RLS가 켜져 있고 정책이 없으면 기본값이 "전부 거부"이므로, 이것만으로 완전 차단이다.
--
-- 왜 필요한가: Supabase는 프로젝트 생성 시 anon/authenticated 역할에 public 스키마
-- 전 테이블의 SELECT/INSERT/UPDATE/DELETE 권한을 기본 부여한다(실측: 19개 테이블 ×
-- 7종 = 133개 권한). 지금은 anon key가 외부에 없어 안전하지만, 브라우저에 키를 넣는
-- 순간(예: Realtime 도입) User.passwordHash까지 열린다. 잠그고 나서 키를 내보내야 한다.
--
-- 앱에는 영향이 없다: Prisma는 DATABASE_URL의 postgres 역할로 접속하고, 이 역할은
-- rolbypassrls=true이며 19개 테이블 전부의 소유자다(둘 중 하나만으로도 RLS를 우회한다).
--
-- 주의: 앞으로 새로 만드는 테이블은 RLS가 꺼진 채로 생성된다. 새 모델을 추가하는
-- 마이그레이션마다 아래 한 줄을 함께 넣어야 한다.

ALTER TABLE "AppSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GoogleConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Partner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerHide" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerJoinRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PartnerPin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectPin" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectPriority" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectRead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedFilter" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
-- 마이그레이션 이력 테이블도 anon 권한 대상이라 함께 잠근다. Prisma는 위와 같은
-- 이유로 영향받지 않는다.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
