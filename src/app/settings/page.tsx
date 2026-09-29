import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, getUser } from "@/lib/auth";
import { NicknameForm } from "./nickname-form";
import { rerollNickname } from "./actions";

export const metadata: Metadata = {
  title: "설정",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/settings");
  const profile = (await getProfile())!;

  return (
    <main className="bg-paper text-ink min-h-dvh px-4 py-10 sm:px-8">
      <div className="mx-auto w-full max-w-lg">
        <Link
          href="/"
          className="text-muted hover:text-ink mb-8 inline-flex items-center gap-1 text-sm"
        >
          ← 홈
        </Link>
        <h1 className="mb-8 text-3xl font-bold tracking-tight">설정</h1>

        <section className="bg-paper-2 border-rule rounded-2xl border p-6">
          <h2 className="mb-1 text-lg font-semibold">프로필</h2>
          <p className="text-muted mb-6 text-sm">{user.email}</p>
          <NicknameForm nickname={profile.nickname} />
          <form action={rerollNickname} className="mt-3">
            <button
              type="submit"
              className="text-ink-2 hover:text-ink h-11 text-sm underline-offset-4 hover:underline"
            >
              랜덤 닉네임 다시 뽑기
            </button>
          </form>
        </section>

        <form action="/auth/signout" method="post" className="mt-8">
          <button
            type="submit"
            className="border-rule text-ink-2 hover:bg-paper-2 h-11 rounded-full border px-5 text-sm transition-colors duration-[var(--dur-base)]"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
