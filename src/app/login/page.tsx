import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { getUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "로그인 · miniflix" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error, mode } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/";
  if (await getUser()) redirect(nextPath);

  return (
    <main className="bg-paper text-ink relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip px-4 py-12">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(58%_0.24_29_/_0.18),transparent_70%)]"
      />
      <div className="relative flex w-full flex-col items-center">
        <div className="mb-12">
          <Logo height={72} priority />
        </div>
        <LoginForm
          next={nextPath}
          initialMode={mode === "signup" ? "signup" : "signin"}
          oauthError={typeof error === "string" ? error : null}
        />
        <p className="text-muted mt-6 text-xs">스트리밍 토이 프로젝트 데모</p>
      </div>
    </main>
  );
}
