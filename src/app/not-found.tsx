import Link from "next/link";
import { Logo } from "@/components/site/logo";

export default function NotFound() {
  return (
    <main className="bg-paper text-ink flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Logo height={32} />
      <p className="text-muted mt-10 text-sm font-medium">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-ink-2 mt-3 max-w-md text-base break-keep">
        주소가 잘못됐거나 콘텐츠가 삭제됐을 수 있습니다.
      </p>
      <Link
        href="/"
        className="bg-ink text-paper hover:bg-ink-2 mt-8 inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold transition-colors duration-[var(--dur-base)]"
      >
        홈으로
      </Link>
    </main>
  );
}
