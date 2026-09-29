"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const DEBOUNCE_MS = 300;
const MAX_QUERY = 100;

export function SearchBox({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | undefined>(undefined);
  const lastPushed = useRef(params.get("q") ?? "");

  const navigate = (q: string) => {
    const trimmed = q.trim().slice(0, MAX_QUERY);
    if (trimmed === lastPushed.current) return;
    lastPushed.current = trimmed;
    const href = trimmed
      ? `/search?q=${encodeURIComponent(trimmed)}`
      : "/search";
    startTransition(() => {
      if (pathname === "/search") router.replace(href);
      else router.push(href);
    });
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        window.clearTimeout(timer.current);
        navigate(value);
      }}
      className={`relative w-10 transition-[width] duration-[var(--dur-slow)] ease-[var(--ease-out)] focus-within:w-48 sm:w-28 sm:focus-within:w-72 ${className}`}
    >
      <label htmlFor="site-search" className="sr-only">
        콘텐츠 검색
      </label>
      <span
        aria-hidden="true"
        className="text-ink-2 pointer-events-none absolute top-1/2 left-3.5 z-10 flex -translate-y-1/2"
      >
        {pending ? (
          <span className="border-ink/30 border-t-ink size-4 animate-spin rounded-full border-2" />
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        )}
      </span>
      <input
        id="site-search"
        name="q"
        type="search"
        placeholder="검색"
        autoComplete="off"
        maxLength={MAX_QUERY}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => navigate(next), DEBOUNCE_MS);
        }}
        className="text-ink placeholder:text-muted hover:bg-paper-3/70 focus-visible:bg-paper-3/70 h-10 w-full rounded-full border border-white/10 bg-black/40 pr-4 pl-10 text-sm outline-2 outline-offset-1 outline-transparent backdrop-blur transition-colors duration-[var(--dur-base)] focus-visible:outline-[var(--color-focus)]"
      />
    </form>
  );
}
