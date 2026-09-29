"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function TitleModal({
  children,
  labelledBy,
}: {
  children: React.ReactNode;
  labelledBy: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{ outline: "none" }}
        className="relative w-full overflow-hidden rounded-t-2xl shadow-2xl outline-none sm:max-w-3xl sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="닫기"
          className="text-ink hover:bg-paper-3 absolute top-3 right-3 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/60 backdrop-blur transition-colors duration-[var(--dur-base)]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="max-h-dvh overflow-y-auto sm:max-h-[90dvh]">
          {children}
        </div>
      </div>
    </div>
  );
}
