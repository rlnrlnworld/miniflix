import Image from "next/image";
import Link from "next/link";
import { getProfile } from "@/lib/auth";
import { Logo } from "./logo";

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
            <Link
              href="/settings"
              className="hover:bg-paper-3/70 flex h-10 items-center gap-2 rounded-lg pr-3 pl-1 transition-colors duration-[var(--dur-base)]"
            >
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
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
                  {profile.nickname.slice(0, 1)}
                </span>
              )}
              <span className="text-ink max-w-32 truncate text-sm font-medium">
                {profile.nickname}
              </span>
            </Link>
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
