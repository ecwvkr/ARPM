import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"
import { DATE_INPUT_MIN, DATE_INPUT_MAX } from "@/lib/date-input"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // 날짜 칸은 연도에 6자리까지 들어가서 202609-04 같은 값이 만들어진다(lib/date-input.ts).
  // 범위를 걸어 두면 브라우저가 잘못된 값으로 제출되는 것을 막고 안내도 띄운다.
  // 호출부가 직접 min/max를 준 경우에는 그쪽을 존중한다.
  const dateRange =
    type === "date" ? { min: DATE_INPUT_MIN, max: DATE_INPUT_MAX } : undefined;

  return (
    <InputPrimitive
      type={type}
      {...dateRange}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
