// 알림(벨)과 웹 푸시가 같은 화면으로 보내는지 확인한다. 실행:
//   npm run check:notify
//
// 알림 종류마다 refId의 의미가 달라서(파트너 알림은 partnerId, 나머지는 projectId),
// 새 종류를 추가할 때 lib/notify.ts의 목록에 빠뜨리면 그 알림은 눌러도 아무 데도 가지
// 않는다. 실제로 그런 상태였던 종류가 있어서 이 검사를 둔다.
//
// 읽기만 한다 — 아무것도 만들거나 지우지 않는다.
import { prisma } from "../lib/prisma";
import { notificationHrefs, PARTNER_REF_TYPES, CALENDAR_REF_TYPES } from "../lib/notify";

let ok = 0, fail = 0;
function check(label: string, cond: boolean, extra = "") {
  if (cond) { ok++; console.log("  OK  ", label, extra); }
  else { fail++; console.log("  FAIL", label, extra); }
}

// 코드에서 실제로 만드는 알림 종류. 새로 추가하면 여기에도 넣어야 한다.
const PARTNER_TYPES = [
  "PARTNER_INVITED", "PARTNER_JOINED", "PARTNER_JOIN_REQUESTED",
  "PARTNER_OWNER_CHANGED", "PROJECT_ARCHIVED", "CHAT_MENTION",
];
const PROJECT_TYPES = [
  "SUBTASK_CREATED", "MASTER_DELEGATED", "PROJECT_INVITED",
  "COMMENT_MENTION", "OVERDUE", "DUE_SOON",
];
// 지금은 안 만들지만 옛 데이터로 남아 있는 종류. '업무 삭제'는 파트너/프로젝트 체계로
// 넘어오면서 PROJECT_ARCHIVED로 대체됐다(73c9b4e).
const LEGACY_TYPES = ["TASK_DELETED"];
// 캘린더 일정은 우리 DB에 없다. refId(구글 일정 id)로 화면을 못 만드니 캘린더로 보낸다.
const CALENDAR_TYPES = ["CALENDAR_EVENT_ADDED", "CALENDAR_DUE_SOON"];

async function main() {
  const project = await prisma.project.findFirstOrThrow({
    where: { deletedAt: null },
    select: { id: true, partnerId: true },
  });

  // 파트너 알림은 partnerId를, 프로젝트 알림은 projectId를 refId로 받는다.
  const probes = [
    ...PARTNER_TYPES.map((type) => ({ type, refId: project.partnerId, want: `/partners/${project.partnerId}` })),
    ...PROJECT_TYPES.map((type) => ({
      type,
      refId: project.id,
      want: `/partners/${project.partnerId}?project=${project.id}`,
    })),
    // 구글 일정 id는 우리 DB에 없는 값이라도 캘린더 화면이 나와야 한다.
    ...CALENDAR_TYPES.map((type) => ({ type, refId: "google-event-id-없는값", want: "/calendar" })),
  ];
  const hrefs = await notificationHrefs(probes);

  probes.forEach((probe, i) => {
    check(`${probe.type} -> 주소`, hrefs[i] === probe.want, hrefs[i] ?? "(없음)");
  });

  // 저장된 알림도 같은 규칙으로 훑는다. 단, 가리키던 프로젝트가 영구 삭제된 옛 알림은
  // 주소가 없는 게 맞으므로, 대상이 아직 남아 있는데도 주소가 안 나오는 것만 잡는다.
  const saved = await prisma.notification.findMany({ select: { type: true, refId: true } });
  const savedHrefs = await notificationHrefs(saved);
  const refIds = saved.map((n) => n.refId).filter((id): id is string => !!id);
  const [aliveProjects, alivePartners] = await Promise.all([
    prisma.project.findMany({ where: { id: { in: refIds } }, select: { id: true } }),
    prisma.partner.findMany({ where: { id: { in: refIds } }, select: { id: true } }),
  ]);
  const alive = new Set([...aliveProjects, ...alivePartners].map((r) => r.id));

  const broken = saved
    .map((n, i) => ({ ...n, href: savedHrefs[i] }))
    .filter((n) => n.refId && alive.has(n.refId) && !n.href);
  // 이건 통과/실패로 세지 않고 알려만 준다. 옛 데이터에는 지금과 refId 의미가 다른 행이
  // 섞여 있어서(파트너/프로젝트 체계 전환 이전) 실패로 잡으면 영영 빨간불이 된다.
  // 규칙 자체의 회귀는 위의 종류별 검사가 잡는다.
  console.log(
    `  참고  저장된 알림 ${saved.length}건 중 눌러도 이동 못 하는 옛 행 ${broken.length}건` +
      (broken.length ? ` (${broken.map((b) => b.type).join(", ")})` : ""),
  );

  // 목록에 없는 종류가 코드에 새로 생겼는지도 함께 본다.
  const unknown = [...new Set(saved.map((n) => n.type))]
    .filter((t) => ![...PARTNER_TYPES, ...PROJECT_TYPES, ...CALENDAR_TYPES, ...LEGACY_TYPES].includes(t));
  check("모르는 알림 종류 없음", unknown.length === 0, unknown.join(", "));
  check("lib/notify.ts 파트너 목록이 이 스크립트와 일치",
    PARTNER_TYPES.every((t) => PARTNER_REF_TYPES.has(t)) && PARTNER_REF_TYPES.size === PARTNER_TYPES.length);
  check("lib/notify.ts 캘린더 목록이 이 스크립트와 일치",
    CALENDAR_TYPES.every((t) => CALENDAR_REF_TYPES.has(t)) && CALENDAR_REF_TYPES.size === CALENDAR_TYPES.length);

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
