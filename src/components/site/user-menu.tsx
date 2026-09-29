"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type Props = { nickname: string; avatarUrl: string | null };

export function UserMenu({ nickname, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-paper-3/70 aria-expanded:bg-paper-3/70 flex h-10 items-center gap-2 rounded-lg pr-2 pl-1 transition-colors duration-[var(--dur-base)]"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-md object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-paper-3 text-ink inline-flex size-8 items-center justify-center rounded-md text-sm font-semibold"
          >
            {nickname.slice(0, 1)}
          </span>
        )}
        <span className="text-ink max-w-32 truncate text-sm font-medium">
          {nickname}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`text-ink-2 transition-transform duration-[var(--dur-base)] ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="bg-paper-2 border-rule absolute top-full right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border py-1 shadow-xl"
        >
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="text-ink hover:bg-paper-3 flex h-11 items-center px-4 text-sm transition-colors duration-[var(--dur-fast)]"
          >
            계정 설정
          </Link>
          <form action="/auth/signout" method="post" role="none">
            <button
              type="submit"
              role="menuitem"
              className="text-ink hover:bg-paper-3 flex h-11 w-full items-center px-4 text-left text-sm transition-colors duration-[var(--dur-fast)]"
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
