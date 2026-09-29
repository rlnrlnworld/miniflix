"use client";

import { useActionState, useState } from "react";
import { signIn, signInWithGoogle, signUp, type AuthState } from "./actions";

type Mode = "signin" | "signup";

const ERRORS: Record<string, string> = {
  oauth: "Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  callback: "로그인 처리 중 문제가 생겼습니다. 다시 시도해 주세요.",
};

export function LoginForm({
  next,
  initialMode,
  oauthError,
}: {
  next: string;
  initialMode: Mode;
  oauthError: string | null;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    null,
  );
  const error = state?.error ?? (oauthError ? ERRORS[oauthError] : null);

  return (
    <section className="bg-paper-2 border-rule w-full max-w-sm rounded-2xl border p-6 sm:p-8">
      <div
        role="tablist"
        aria-label="로그인 방식"
        className="bg-paper mb-6 flex rounded-full p-1"
      >
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className="text-muted aria-selected:bg-paper-3 aria-selected:text-ink h-10 flex-1 rounded-full text-sm font-medium transition-colors duration-[var(--dur-base)]"
          >
            {m === "signin" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="bg-ink text-paper hover:bg-ink-2 flex h-11 w-full items-center justify-center gap-3 rounded-full text-sm font-semibold transition-colors duration-[var(--dur-base)] active:translate-y-px"
        >
          <GoogleMark />
          Google로 계속하기
        </button>
      </form>

      <div className="text-muted my-5 flex items-center gap-3 text-xs">
        <span className="bg-rule h-px flex-1" />
        또는 이메일로
        <span className="bg-rule h-px flex-1" />
      </div>

      <form action={action} className="flex flex-col gap-4" key={mode}>
        <input type="hidden" name="next" value={next} />
        <Field
          label="이메일"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="8자 이상"
          minLength={8}
        />

        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}
        {state?.notice && (
          <p role="status" className="text-ink-2 text-sm">
            {state.notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-white mt-1 h-11 rounded-full text-sm font-semibold transition-[filter] duration-[var(--dur-base)] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "처리 중…" : mode === "signin" ? "로그인" : "가입하기"}
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  ...rest
}: {
  label: string;
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink-2 text-sm">{label}</span>
      <input
        name={name}
        required
        {...rest}
        className="bg-paper border-rule text-ink placeholder:text-muted hover:bg-paper-3/60 h-11 rounded-lg border px-3 text-sm outline-2 outline-offset-1 outline-transparent transition-colors duration-[var(--dur-base)] focus-visible:outline-[var(--color-focus)]"
      />
    </label>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.3 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
