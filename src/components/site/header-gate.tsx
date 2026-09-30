"use client";

import { usePathname } from "next/navigation";

/** 플레이어 페이지(/watch)는 자체 헤더가 있으므로 사이트 헤더를 아예 렌더하지 않는다. */
export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/watch/")) return null;
  return children;
}
