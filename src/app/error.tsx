"use client";

import Link from "next/link";
import { Logo } from "@/components/site/logo";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="bg-paper text-ink flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo height={32} />
      <h1 className="mt-10 text-3xl font-bold tracking-tight">
        문제가 생겼습니다
      </h1>
      <p className="text-ink-2 mt-3 max-w-md text-base break-keep">
        잠시 후 다시 시도해 주세요. 계속되면 새로고침해 보세요.
      </p>
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="bg-ink text-paper hover:bg-ink-2 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold transition-colors duration-[var(--dur-base)]"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="text-ink hover:bg-paper-2 inline-flex h-11 items-center rounded-full border border-white/15 px-6 text-sm font-medium transition-colors duration-[var(--dur-base)]"
        >
          홈으로
        </Link>
      </div>
    </main>
  );
}
