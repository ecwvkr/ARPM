import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="max-w-sm space-y-3 rounded-4xl bg-card p-6 shadow-md ring-1 ring-foreground/5 dark:ring-foreground/10">
        <h1 className="text-base font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          주소가 잘못되었거나 삭제된 페이지일 수 있습니다.
        </p>
        <div className="flex justify-center pt-1">
          {/* render 대상이 <a>라 nativeButton을 꺼야 Base UI가 경고하지 않는다. */}
          <Button size="sm" nativeButton={false} render={<Link href="/">대시보드로 돌아가기</Link>} />
        </div>
      </div>
    </div>
  );
}
