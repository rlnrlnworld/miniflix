import Image from "next/image";
import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { storagePublicUrl } from "@/lib/storage";

type HeroContent = {
  slug: string;
  title: string;
  description: string | null;
  durationSec: number;
  posterPath: string | null;
  subtitles: { lang: string; label: string }[];
};

export function Hero({
  content,
  preview = false,
}: {
  content: HeroContent;
  preview?: boolean;
}) {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative min-h-[70dvh] w-full overflow-hidden sm:min-h-[80dvh]"
    >
      {content.posterPath && (
        <Image
          src={storagePublicUrl(content.posterPath)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/85 via-black/45 to-black/20 sm:bg-linear-to-r sm:from-black/85 sm:via-black/40 sm:to-transparent"
      />
      <div
        aria-hidden="true"
        className="from-paper absolute inset-x-0 bottom-0 h-40 bg-linear-to-t to-transparent"
      />

      <div className="relative mx-auto flex min-h-[70dvh] w-full max-w-7xl flex-col justify-end px-4 pb-14 sm:min-h-[80dvh] sm:px-8 sm:pb-20">
        <h1
          id="hero-title"
          className="text-ink max-w-2xl text-4xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-6xl"
        >
          {content.title}
        </h1>
        <p className="text-ink-2 mt-3 text-sm">
          {formatDuration(content.durationSec)}
          {content.subtitles.length > 0 && (
            <>
              <span aria-hidden="true"> · </span>
              자막 {content.subtitles.map((s) => s.label).join(", ")}
            </>
          )}
        </p>
        {content.description && (
          <p className="text-ink-2 mt-4 max-w-xl text-base leading-relaxed break-keep sm:text-lg">
            {content.description}
          </p>
        )}
        <div className="mt-7 flex gap-3">
          <Link
            href={`/watch/${content.slug}`}
            className="bg-ink text-paper hover:bg-ink-2 inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-semibold transition-colors duration-[var(--dur-base)] active:translate-y-px"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M7 4.5v15l12-7.5z" />
            </svg>
            {preview ? "미리보기" : "재생"}
          </Link>
          <Link
            href={`/title/${content.slug}`}
            scroll={false}
            className="text-ink hover:bg-paper-3/70 inline-flex h-12 items-center gap-2 rounded-full border border-white/20 bg-black/40 px-6 text-base font-medium backdrop-blur transition-colors duration-[var(--dur-base)]"
          >
            상세 정보
          </Link>
        </div>
      </div>
    </section>
  );
}
