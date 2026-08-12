"use client";

import dynamic from "next/dynamic";

// 캔버스 뷰(React Flow + dagre)는 무거우므로 선택했을 때만 로드한다.
// next/dynamic의 ssr:false는 클라이언트 컴포넌트 안에서만 허용되므로 별도 파일로 분리.
export const ProjectCanvas = dynamic(() => import("./project-canvas").then((m) => m.ProjectCanvas), {
  ssr: false,
  loading: () => <p className="text-sm text-muted-foreground">불러오는 중...</p>,
});
