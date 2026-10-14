@AGENTS.md

# 프로젝트 문서

코드를 고치기 전에 아래 개발 규칙을 따른다. 모두 실제로 한 번 터졌던 것이다.

@docs/ENGINEERING-NOTES.md

필요할 때 찾아볼 문서:
- 제품 정의·역할·용어: `PRODUCT.md`
- 디자인 규칙: `DESIGN.md`
- 무엇이 언제 왜 바뀌었나: `docs/HISTORY.md` — 결정을 되돌리기 전에 확인
- 남은 과제와 우선순위: `docs/BACKLOG.md`

# 문서 유지

- 의미 있는 변경을 커밋하면 `docs/HISTORY.md`의 해당 시기 절에 **무엇을, 왜** 바꿨는지 남긴다. 처음 결정을 뒤집었다면 "뒤집힌 결정" 표에도 한 줄 추가한다. 이유는 기록된 것만 적고 지어내지 않는다.
- 같은 종류의 실수를 두 번 하지 않도록, 새로 겪은 함정은 `docs/ENGINEERING-NOTES.md`에 규칙으로 추가한다.
- 끝낸 과제는 `docs/BACKLOG.md`에서 지운다.
- 역할·권한·용어·화면 구성이 바뀌면 `PRODUCT.md`를, 색·컴포넌트 규칙이 바뀌면 `DESIGN.md`와 `.impeccable/design.json`을 함께 고친다.
