-- G2: 캘린더 뷰에 표시할 구글 캘린더를 관리자가 고르는 선택 목록.
ALTER TABLE "GoogleConnection" ADD COLUMN "enabledCalendarIds" TEXT[] NOT NULL DEFAULT '{}';
