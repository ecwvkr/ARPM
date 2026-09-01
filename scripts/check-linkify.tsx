// 글 안의 주소를 링크로 바꾸는 처리(components/linkify.tsx)를 확인한다. 실행:
//   npm run check:linkify
//
// 여기서 http/https만 통과시키는 것이 곧 방어선이다 — 아무 문자열이나 <a href>로 넣으면
// javascript: 같은 주소가 눌렀을 때 그대로 실행된다.
//
// 순수 함수만 본다 — DB도 브라우저도 필요 없다.
import type { ReactElement } from "react";
import { linkifyText, linkifyWithMentions } from "../components/linkify";

let ok = 0, fail = 0;
function check(label: string, got: unknown, want: unknown) {
  const same = JSON.stringify(got) === JSON.stringify(want);
  if (same) { ok++; console.log("  OK  ", label, JSON.stringify(got)); }
  else { fail++; console.log("  FAIL", label, JSON.stringify(got), "기대:", JSON.stringify(want)); }
}

// 결과에서 링크로 잡힌 주소만 뽑아낸다.
function hrefs(text: string): string[] {
  return linkifyText(text, "t")
    .filter((n): n is ReactElement<{ href: string }> => typeof n === "object" && n !== null && "props" in n)
    .map((n) => n.props.href);
}

// 링크가 아닌 부분까지 합쳐 원문이 그대로 남는지 본다(글자가 새면 내용이 사라진 것이다).
function roundTrip(text: string): string {
  return linkifyText(text, "t")
    .map((n) => (typeof n === "string" ? n : (n as ReactElement<{ href: string }>).props.href))
    .join("");
}

function main() {
  check("평범한 주소", hrefs("자료는 https://example.com/a 참고"), ["https://example.com/a"]);
  check("http도 잡는다", hrefs("http://example.com"), ["http://example.com"]);
  check("한 줄에 두 개", hrefs("https://a.com 와 https://b.com"), ["https://a.com", "https://b.com"]);
  check("주소 없음", hrefs("링크 없는 코멘트"), []);

  // 프로토콜이 없으면 링크로 만들지 않는다 — 어디로 갈지 알 수 없다.
  check("www만 있으면 제외", hrefs("www.example.com"), []);
  // 이게 통과하면 누른 사람 브라우저에서 코드가 실행된다.
  check("javascript: 제외", hrefs("javascript:alert(1)"), []);
  check("data: 제외", hrefs("data:text/html,<script>"), []);

  // 문장 끝 구두점은 주소가 아니다.
  check("끝의 마침표 제외", hrefs("https://example.com/a."), ["https://example.com/a"]);
  check("끝의 쉼표 제외", hrefs("https://example.com/a, 그리고"), ["https://example.com/a"]);
  check("짝 없는 닫는 괄호 제외", hrefs("(https://example.com/a)"), ["https://example.com/a"]);
  // 위키처럼 주소 안에 괄호가 있으면 그건 주소의 일부다.
  check("짝 맞는 괄호는 유지", hrefs("https://ko.wikipedia.org/wiki/문서_(항목)"),
    ["https://ko.wikipedia.org/wiki/문서_(항목)"]);

  // 잘라 붙이는 과정에서 글자가 사라지면 안 된다.
  for (const text of [
    "앞 https://example.com/a 뒤",
    "https://example.com/a. 끝",
    "(https://example.com/a) 괄호",
    "주소 없음",
  ]) {
    check(`원문 보존: ${text}`, roundTrip(text), text);
  }

  // 코멘트 멘션은 "@이름" 글자로만 저장되므로 아는 이름과 대조해 칩으로 그린다.
  const NAMES = ["이대균", "이대", "박천성"];
  const opts = { chipClass: "chip", meChipClass: "me", myName: "박천성" };
  // 칩으로 잡힌 이름만 뽑아낸다.
  const chips = (text: string) =>
    linkifyWithMentions(text, NAMES, opts)
      .filter((n): n is ReactElement<{ className: string; children: unknown[] }> =>
        typeof n === "object" && n !== null && "props" in n && "className" in (n.props as object))
      .map((n) => `${n.props.className}:${n.props.children[1]}`);

  check("이름을 칩으로", chips("@이대균 확인 부탁드립니다"), ["chip:이대균"]);
  check("나를 부른 멘션은 다르게", chips("@박천성 봐주세요"), ["me:박천성"]);
  check("긴 이름이 먼저 잡힌다(이대 < 이대균)", chips("@이대균"), ["chip:이대균"]);
  check("모르는 이름은 그냥 글자", chips("@홍길동 안녕"), []);
  check("이메일은 멘션이 아니다", chips("a@이대균.com"), []);
  check("여러 멘션", chips("@이대균 과 @박천성"), ["chip:이대균", "me:박천성"]);

  // 멘션과 주소가 섞여도 원문이 그대로 남아야 한다.
  const mixed = "@이대균 자료 https://example.com/a 확인";
  const restored = linkifyWithMentions(mixed, NAMES, opts)
    .map((n) => {
      if (typeof n === "string") return n;
      const props = (n as ReactElement<{ href?: string; children: unknown[] }>).props;
      return props.href ?? `${props.children[0]}${props.children[1]}`;
    })
    .join("");
  check("멘션+주소 원문 보존", restored, mixed);

  console.log(`\n${ok} OK, ${fail} FAIL`);
  if (fail > 0) process.exitCode = 1;
}

main();
