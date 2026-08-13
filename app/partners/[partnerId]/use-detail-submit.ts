"use client";

import { useState, useTransition } from "react";

// useActionState의 formAction은 액션이 돌려준 오류 문자열을 호출부에 넘겨주지 않는다.
// 그래서 실패해도 그대로 닫히고 사용자가 입력한 내용이 조용히 사라지는 문제가 있었다.
// 액션을 직접 호출해 성공했을 때만 닫는다.
export function useDetailSubmit(
  action: (prevState: string | undefined, formData: FormData) => Promise<string | undefined>,
) {
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData, onSuccess: () => void) {
    startTransition(async () => {
      const error = await action(undefined, formData);
      setErrorMessage(error);
      if (!error) onSuccess();
    });
  }

  return { errorMessage, isPending, submit };
}
