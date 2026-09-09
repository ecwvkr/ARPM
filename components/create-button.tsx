"use client";

import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";

// 만들기 버튼의 생김새를 한곳에 둔다. 파트너·프로젝트·태스크 세 가지를 서로 다른
// 화면에서 만들 수 있는데, 화면마다 모양이 다르면 "여기서 뭘 만들 수 있는지"가 한눈에
// 안 들어온다.
//
// 각 만들기 창(NewPartnerDialog 등)에 trigger로 넘겨 쓴다. 창 쪽에서 이 엘리먼트를
// 복제하면서 onClick 같은 것을 얹으므로 받은 props를 반드시 그대로 넘겨야 한다 —
// 안 넘기면 버튼을 눌러도 창이 열리지 않는다.
//
// "use client"가 반드시 필요하다. 서버 컴포넌트인 채로 창에 넘기면 이미 그려진 결과가
// 건너가서 브라우저에서는 복제가 안 되고, 서버가 그린 것과 속성이 어긋난다
// (하이드레이션 오류). 실제로 그렇게 났다.
export function CreateButton({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button size="sm" variant="outline" title={label} aria-label={label} {...props}>
      <IconPlus className="size-3.5" />
      {label}
    </Button>
  );
}
