import Link from "next/link";
import { Suspense } from "react";
import { getProfile } from "@/lib/auth";
import { Logo } from "./logo";
import { SearchBox } from "./search-box";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const profile = await getProfile();

  return (
    <header className="fixed inset-x-0 top-0 z-20 bg-linear-to-b from-black/80 to-transparent">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 pr-3 pl-4 sm:pr-4 sm:pl-8">
        <Logo height={22} priority />

        <Suspense>
          <SearchBox className="mx-auto" />
        </Suspense>

        <div className="ml-auto flex shrink-0 items-center gap-3 sm:ml-0">
          {profile ? (
            <UserMenu
              nickname={profile.nickname}
              avatarUrl={profile.avatarUrl}
            />
          ) : (
            <Link
              href="/login"
              className="bg-ink text-paper hover:bg-ink-2 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors duration-[var(--dur-base)]"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
