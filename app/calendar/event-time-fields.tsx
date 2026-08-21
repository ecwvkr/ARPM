"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// 일정 추가·수정 창에서 함께 쓰는 기간 입력. 기본은 종일이고, 체크하면 시각 칸이
// 열린다. 날짜·시간 입력은 브라우저 기본 위젯(type="date"/"time")을 그대로 쓴다 —
// 모바일에서 OS 피커가 뜨고 별도 라이브러리가 필요 없다.
export function EventTimeFields({
  idPrefix,
  defaultStartDate,
  defaultEndDate,
  defaultTimed = false,
  defaultStartTime = "09:00",
  defaultEndTime = "10:00",
}: {
  idPrefix: string;
  defaultStartDate: string;
  defaultEndDate: string;
  defaultTimed?: boolean;
  defaultStartTime?: string;
  defaultEndTime?: string;
}) {
  const [timed, setTimed] = useState(defaultTimed);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-start`}>시작일</Label>
          <Input
            id={`${idPrefix}-start`}
            name="startDate"
            type="date"
            defaultValue={defaultStartDate}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-end`}>종료일</Label>
          <Input id={`${idPrefix}-end`} name="endDate" type="date" defaultValue={defaultEndDate} />
        </div>
      </div>

      <label className="flex w-fit items-center gap-2 text-sm">
        {/* name을 주면 체크됐을 때만 "on"이 폼에 실린다 — 서버는 그걸로 종일 여부를 판단한다. */}
        <Checkbox name="timed" checked={timed} onCheckedChange={(next) => setTimed(next === true)} />
        시간 지정
      </label>

      {timed && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-start-time`}>시작 시간</Label>
            <Input
              id={`${idPrefix}-start-time`}
              name="startTime"
              type="time"
              defaultValue={defaultStartTime}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-end-time`}>종료 시간</Label>
            <Input
              id={`${idPrefix}-end-time`}
              name="endTime"
              type="time"
              defaultValue={defaultEndTime}
              required
            />
          </div>
        </div>
      )}
    </div>
  );
}
