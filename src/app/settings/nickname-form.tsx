"use client";

import { useActionState } from "react";
import { NICKNAME_MAX } from "@/lib/nickname";
import { updateNickname, type NicknameState } from "./actions";

export function NicknameForm({ nickname }: { nickname: string }) {
  const [state, action, pending] = useActionState<NicknameState, FormData>(
    updateNickname,
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2" key={nickname}>
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-2 text-sm">닉네임</span>
        <div className="flex gap-2">
          <input
            name="nickname"
            defaultValue={nickname}
            maxLength={NICKNAME_MAX}
            required
            aria-invalid={Boolean(state?.error)}
            aria-describedby="nickname-msg"
            className="bg-paper border-rule text-ink hover:bg-paper-3/60 aria-invalid:border-danger h-11 flex-1 rounded-lg border px-3 text-sm outline-2 outline-offset-1 outline-transparent transition-colors duration-[var(--dur-base)] focus-visible:outline-[var(--color-focus)]"
          />
          <button
            type="submit"
            disabled={pending}
            className="bg-ink text-paper hover:bg-ink-2 h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-colors duration-[var(--dur-base)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </label>
      <p
        id="nickname-msg"
        role={state?.error ? "alert" : "status"}
        className={`min-h-5 text-sm ${state?.error ? "text-danger" : "text-muted"}`}
      >
        {state?.error ??
          (state?.saved ? "저장했습니다." : `${NICKNAME_MAX}자 이내`)}
      </p>
    </form>
  );
}
