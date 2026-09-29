import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { Logo } from "./logo";
import { UserMenu } from "./user-menu";

export async function SiteHeader() {
  const profile = await getProfile();

  return (
    <header className="fixed inset-x-0 top-0 z-20 bg-linear-to-b from-black/80 to-transparent">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-8">
        <Logo height={22} priority />

        <nav
          aria-label="주요 메뉴"
          className="hidden items-center gap-5 text-sm sm:flex"
        >
          <Link
            href="/"
            className="text-ink hover:text-ink-2 transition-colors duration-[var(--dur-base)]"
          >
            홈
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
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
