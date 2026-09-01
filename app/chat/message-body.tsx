import { Fragment } from "react";
import Link from "next/link";
import { splitChatMarkup } from "@/lib/chat-markup";
import { linkifyText } from "@/components/linkify";

// 칩은 말풍선 색을 물려받되 살짝 눌러 구분한다 — 내 말풍선(진한 배경)과 남의
// 말풍선(연한 배경) 양쪽에서 같은 규칙으로 읽히게 하려는 것.
const CHIP_CLASS =
  "rounded-md bg-current/15 px-1 py-0.5 font-medium decoration-current/40 underline-offset-2";

export function MessageBody({
  text,
  partnerId,
  currentUserId,
}: {
  text: string;
  // 1:1·단체방은 파트너에 매이지 않는다. 이때 태그는 파트너를 특정할 수 없으므로
  // 프로젝트 id만으로 링크를 만들 수 없어 칩만 그린다.
  partnerId: string | null;
  currentUserId: string;
}) {
  const segments = splitChatMarkup(text);

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.kind === "mention") {
          const isMe = segment.userId === currentUserId;
          return (
            <span
              key={i}
              // 나를 부른 멘션은 더 진하게 — 대화를 훑을 때 내 차례를 먼저 찾게 한다.
              className={`${CHIP_CLASS} ${isMe ? "bg-current/30" : ""}`}
            >
              @{segment.label}
            </span>
          );
        }
        if (segment.kind === "tag") {
          // 태그 마커가 파트너를 함께 담고 있으면 그걸 쓰고, 없으면 이 방의 파트너를 쓴다.
          const target = segment.partnerId ?? partnerId;
          if (!target) {
            return (
              <span key={i} className={CHIP_CLASS}>
                /{segment.label}
              </span>
            );
          }
          return (
            <Link
              key={i}
              href={`/partners/${target}?project=${segment.projectId}`}
              className={`${CHIP_CLASS} underline`}
            >
              /{segment.label}
            </Link>
          );
        }
        return <Fragment key={i}>{linkifyText(segment.text, String(i))}</Fragment>;
      })}
    </>
  );
}
